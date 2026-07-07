"use server";

/**
 * lib/server/actions.ts — draft / approve / reject server actions.
 *
 * draftAction   — creates Draft + Action (status "draft"). Drafting is NOT
 *                 activation (26A.4): nothing customer-facing happens here.
 * approveAction — THE activation path. Order is law:
 *                 approval -> governance checkAction (no way around it) ->
 *                 holdout assignment when eligible (PRD 14.2/14.3, 26A.1) ->
 *                 SIMULATED activation ladder (PRD 13, 25.1, 26B.17) ->
 *                 measurement windows (26A.2) -> ledger.
 * rejectAction  — rejection reason -> 26B.18 learned-preferences hook.
 */

import type {
  ActivationLevel,
  ContractActionType,
  ContractContaminationRisk,
  MeasurementMode,
  RecipeResult,
} from "../contracts";
import {
  ACTIVATION_LEVELS,
  MEASUREMENT_LABELS,
  MEASUREMENT_LABEL_COPY,
} from "../contracts";
import db from "../db";
import { checkAction, type GovernanceDecision } from "../governance";
import {
  recordEditPreference,
  recordRejectionPreference,
  writeGovernanceDecision,
  writeLedger,
} from "../ledger";
import {
  assignHoldout,
  buildMeasurementWindows,
  checkContamination,
  persistMeasurementWindows,
} from "../measurement";
import { runRecipeForAccount } from "../recipes";
import {
  buildDraftCopy,
  buildDraftSequence,
  copyTexts,
  maxOfferPercent,
  parseDraftCopy,
} from "./draft-templates";
import {
  accountClock,
  buildSourceFreshness,
  loadExistingFlowReachSources,
  parseAudienceCustomerIds,
  requireAccount,
  requireConstitution,
  requireRecipeId,
  toInputJson,
} from "./shared";
import type {
  ActivationLadderStep,
  ApproveActionResult,
  DraftActionResult,
  GovernanceDecisionView,
  RejectActionResult,
} from "./types";

function channelFor(actionType: ContractActionType): "klaviyo" | "meta" {
  return actionType === "meta_audience_sync" ? "meta" : "klaviyo";
}

function governanceView(decision: GovernanceDecision): GovernanceDecisionView {
  return {
    verdict: decision.verdict,
    gates: decision.gates,
    reasons: decision.reasons,
    remediations: decision.remediations,
    claimFindings: decision.claimFindings.map((finding) => ({
      claim: finding.claim,
      why: finding.why,
      saferAlternative: finding.saferAlternative,
      overrideable: !finding.nonOverrideable,
    })),
    constitutionVersion: decision.constitutionVersion,
    checkedAt: decision.checkedAt,
    destinationCompatibilitySummary: decision.destinationCompatibility.logSummary,
  };
}

// ---------------------------------------------------------------------------
// draftAction — draft is not activation (26A.4)
// ---------------------------------------------------------------------------

export async function draftAction(params: {
  accountId: string;
  opportunityId: string;
  userId?: string;
}): Promise<DraftActionResult> {
  const account = await requireAccount(params.accountId);
  const constitution = await requireConstitution(params.accountId);

  const opportunity = await db.opportunity.findFirst({
    where: { id: params.opportunityId, accountId: params.accountId },
  });
  if (!opportunity) throw new Error(`Opportunity ${params.opportunityId} not found.`);
  if (opportunity.status === "dismissed") {
    throw new Error("This opportunity was dismissed — resurface it before drafting.");
  }

  const recipeId = requireRecipeId(opportunity.recipeId);
  // Deterministic re-run to get the current audience + measurement plan
  // (demo accounts run on the demo dataset's fixed reference clock).
  const result: RecipeResult = await runRecipeForAccount(
    params.accountId,
    recipeId,
    accountClock(account),
  );
  if (result.noOpportunity) {
    throw new Error(
      `Recipe ${recipeId} no longer finds a qualifying audience: ${result.noOpportunity.whyNotQualified}`,
    );
  }

  // 26B.18 — learned offer stance shapes the template.
  const offerPref = await db.preference.findUnique({
    where: { accountId_key: { accountId: params.accountId, key: "offer_stance" } },
  });
  const avoidDiscounts =
    typeof offerPref?.value === "object" &&
    offerPref?.value !== null &&
    !Array.isArray(offerPref.value) &&
    (offerPref.value as Record<string, unknown>).stance === "avoid_discounts";

  const copy = buildDraftCopy(recipeId, result, {
    brandName: account.name,
    constitution,
    avoidDiscounts,
  });

  // Tighten the audience to channel consent + suppression BEFORE anything is
  // drafted (PRD 23.4: suppression is checked before draft approval; 26B.13:
  // consentAds gates ad audiences). This does not bypass governance — the
  // same gates re-check the persisted audience at approval time.
  const channel = channelFor(result.recommendedAction);
  const audienceCustomers = await db.customer.findMany({
    where: { accountId: params.accountId, id: { in: result.audience.customerIds } },
    select: { id: true, consentEmail: true, consentAds: true, suppressionStatus: true },
  });
  const eligibleIds = audienceCustomers
    .filter(
      (customer) =>
        customer.suppressionStatus === "none" &&
        (channel === "meta" ? customer.consentAds : customer.consentEmail),
    )
    .map((customer) => customer.id);
  const consentFiltered = result.audience.customerIds.length - eligibleIds.length;

  const audience = await db.audience.create({
    data: {
      accountId: params.accountId,
      name: result.audience.name,
      creationMethod: "recipe",
      inclusionRules: toInputJson({
        ...result.audience.inclusionRules,
        customerIds: eligibleIds,
        consentSuppressionFiltered: consentFiltered,
      }),
      exclusionRules: toInputJson(result.audience.exclusionRules),
      size: eligibleIds.length,
      eligibleChannels: toInputJson(result.audience.eligibleChannels),
    },
  });
  if (result.suppressionAudience) {
    await db.audience.create({
      data: {
        accountId: params.accountId,
        name: result.suppressionAudience.name,
        creationMethod: "recipe",
        inclusionRules: toInputJson({
          ...result.suppressionAudience.inclusionRules,
          customerIds: result.suppressionAudience.customerIds,
        }),
        exclusionRules: toInputJson(result.suppressionAudience.exclusionRules),
        size: result.suppressionAudience.size,
        eligibleChannels: toInputJson(result.suppressionAudience.eligibleChannels),
      },
    });
  }

  const action = await db.action.create({
    data: {
      accountId: params.accountId,
      type: result.recommendedAction,
      objective: result.title,
      channel: channelFor(result.recommendedAction),
      audienceId: audience.id,
      opportunityId: opportunity.id,
      status: "draft", // 26A.4 — NOT activation
      createdBy: params.userId,
      constitutionVersion: constitution.version,
      measurementMode: result.measurementPlan.mode,
      activationLevel: result.activationLevel,
      expectedOutcome: result.estimate ? toInputJson(result.estimate) : undefined,
      sourceReferences: toInputJson({
        recipeId,
        recipeVersion: result.recipeVersion,
        dataAsOf: result.dataAsOf,
      }),
    },
  });

  const draft = await db.draft.create({
    data: {
      accountId: params.accountId,
      opportunityId: opportunity.id,
      actionId: action.id,
      copy: toInputJson(copy),
      sequence: toInputJson(buildDraftSequence(copy)),
      activationTarget: result.activationLevel,
      status: "draft",
    },
  });

  const approval = await db.approval.create({
    data: {
      accountId: params.accountId,
      actionId: action.id,
      draftId: draft.id,
      status: "pending",
    },
  });

  if (opportunity.status !== "launched") {
    await db.opportunity.update({
      where: { id: opportunity.id },
      data: { status: "drafted" },
    });
  }

  await writeLedger({
    accountId: params.accountId,
    eventType: "opportunity_drafted",
    userId: params.userId,
    actionId: action.id,
    opportunityId: opportunity.id,
    skillInvoked: recipeId,
    constitutionVersion: constitution.version,
    sourceDataUsed: {
      draftId: draft.id,
      audienceSize: result.audience.size,
      activationTarget: result.activationLevel,
      steps: copy.length,
    },
    sourceFreshness: result.explanation.dataFreshness,
    reasoningSummary: `Drafted "${result.title}" as ${ACTIVATION_LEVELS[result.activationLevel]} (template copy, no LLM). Draft is not activation — approval required (26A.4).`,
    confidence: result.confidence,
    approvalStatus: "pending",
    destination: channelFor(result.recommendedAction),
    activationLevel: result.activationLevel,
    actionTaken: "draft created; awaiting approval",
    measurementMode: result.measurementPlan.mode,
  });

  return {
    actionId: action.id,
    draftId: draft.id,
    approvalId: approval.id,
    opportunityId: opportunity.id,
    copy,
    activationLevel: result.activationLevel,
    approvalNeeded:
      "Creating a draft is not activation. No send, sync, suppression change, or spend happens until you explicitly approve (PRD 26A.4).",
    explanation: result.explanation,
    measurementMode: result.measurementPlan.mode,
    measurementLabelCopy: MEASUREMENT_LABEL_COPY[result.measurementPlan.mode],
  };
}

// ---------------------------------------------------------------------------
// approveAction — the ONLY path to (simulated) activation
// ---------------------------------------------------------------------------

/** Simulated Klaviyo/Meta activation ladder (PRD 13, 25.1 Alpha, 26B.17). */
function simulateActivationLadder(
  channel: "klaviyo" | "meta",
  targetLevel: ActivationLevel,
): { finalLevel: ActivationLevel; ladder: ActivationLadderStep[] } {
  if (channel === "meta") {
    return {
      finalLevel: "meta_audience_sync",
      ladder: [
        {
          level: "meta_audience_sync",
          levelCopy: ACTIVATION_LEVELS.meta_audience_sync,
          outcome: "succeeded_simulated",
          detail:
            "Seed + suppression audiences accepted by the mocked Meta connector (Alpha simulation, PRD 25.1).",
        },
      ],
    };
  }
  const ladder: ActivationLadderStep[] = [
    {
      level: "klaviyo_flow_draft",
      levelCopy: ACTIVATION_LEVELS.klaviyo_flow_draft,
      outcome: "unavailable",
      detail:
        "Klaviyo flow-draft creation is unavailable in the public API at build time (26B.17) — falling back.",
    },
  ];
  if (targetLevel === "klaviyo_campaign_draft" || targetLevel === "klaviyo_flow_draft") {
    ladder.push({
      level: "klaviyo_campaign_draft",
      levelCopy: ACTIVATION_LEVELS.klaviyo_campaign_draft,
      outcome: "succeeded_simulated",
      detail:
        "Campaign draft created in the mocked Klaviyo connector with audience, copy, suppression rules, and timing (Alpha simulation).",
    });
    return { finalLevel: "klaviyo_campaign_draft", ladder };
  }
  // Exportable brief / manual setup: 26A.1 downgrade territory.
  ladder.push({
    level: "klaviyo_campaign_draft",
    levelCopy: ACTIVATION_LEVELS.klaviyo_campaign_draft,
    outcome: "skipped",
    detail: "Campaign-draft level not targeted by this action.",
  });
  ladder.push({
    level: targetLevel,
    levelCopy: ACTIVATION_LEVELS[targetLevel],
    outcome: "succeeded_simulated",
    detail:
      targetLevel === "exportable_brief"
        ? "Exportable brief generated (PRD 13.3). Holdout exclusion cannot be enforced at this level (26A.1)."
        : "Manual setup instructions generated (PRD 13.1 Level 4). Holdout exclusion cannot be enforced at this level (26A.1).",
  });
  return { finalLevel: targetLevel, ladder };
}

export async function approveAction(params: {
  accountId: string;
  actionId: string;
  approver?: string;
  /** 26A.8 — required true for Meta audience actions. */
  metaIdentifierRightsConfirmed?: boolean;
  /** Canonical claim keys the user explicitly overrode (overrideable claims only). */
  claimOverrides?: string[];
}): Promise<ApproveActionResult> {
  const account = await requireAccount(params.accountId);
  // DATA clock: freshness, holdout start, launch time, and measurement windows
  // are anchored to the account clock (demo reference date for demo accounts).
  // USER clock (real time) is used for the approval timestamp itself.
  const now = accountClock(account);
  const approvedAt = new Date();

  const action = await db.action.findFirst({
    where: { id: params.actionId, accountId: params.accountId },
    include: {
      audience: true,
      opportunity: true,
      drafts: { orderBy: { createdAt: "desc" }, take: 1 },
      approvals: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });
  if (!action) throw new Error(`Action ${params.actionId} not found.`);
  if (action.status === "launched") {
    throw new Error("This action is already launched.");
  }
  const draft = action.drafts[0];
  if (!draft) throw new Error("Action has no draft to approve (draft first, 26A.4).");
  const approvalRow = action.approvals[0];
  if (!approvalRow) throw new Error("Action has no approval record.");

  const actionType = action.type as ContractActionType;
  const channel = channelFor(actionType);
  const activationLevel = (action.activationLevel ?? "klaviyo_campaign_draft") as ActivationLevel;
  if (!action.opportunity) {
    throw new Error("Action has no linked opportunity — cannot resolve recipe windows.");
  }
  const recipeId = requireRecipeId(action.opportunity.recipeId);

  // --- 1. Record the explicit human approval (PRD 2.1 #6) ------------------
  await db.approval.update({
    where: { id: approvalRow.id },
    data: { status: "approved", approver: params.approver, timestamp: approvedAt },
  });
  await writeLedger({
    accountId: params.accountId,
    eventType: "approval",
    userId: params.approver,
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    constitutionVersion: action.constitutionVersion,
    approvalStatus: "approved",
    reasoningSummary: `User approved action "${action.objective ?? action.type}".`,
    actionTaken: "approval recorded",
  });

  // --- 2. Governance chokepoint — NO code path around this (PRD 12.7) ------
  const copy = parseDraftCopy(draft.copy);
  const customerIds = parseAudienceCustomerIds(action.audience?.inclusionRules);
  const sourceFreshness = await buildSourceFreshness(params.accountId, now);

  const decision = await checkAction(
    {
      accountId: params.accountId,
      constitutionVersion: action.constitutionVersion,
      actionType,
      channel,
      activationLevel,
      audienceCustomerIds: customerIds,
      copyText: copyTexts(copy),
      discountPercent: maxOfferPercent(copy),
      estimatedSpend: 0, // v0: no direct paid-media budget changes (PRD 2.3)
      sourceFreshness,
      approvalId: approvalRow.id,
    },
    {
      claimOverrides: params.claimOverrides,
      metaIdentifierRightsConfirmed: params.metaIdentifierRightsConfirmed,
      now,
    },
  );

  await writeGovernanceDecision({
    accountId: params.accountId,
    userId: params.approver,
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    constitutionVersion: decision.constitutionVersion,
    decision,
    destinationCompatibilitySummary: decision.destinationCompatibility.logSummary,
    destination: channel,
    activationLevel,
    sourceFreshness,
  });

  if (decision.verdict !== "pass") {
    // Approved by the human, blocked by governance. Action stays "approved",
    // nothing activates; blocked attempt is already in the ledger (PRD 8.5).
    await db.action.update({
      where: { id: action.id },
      data: { status: "approved", approvedBy: params.approver },
    });
    return {
      activated: false,
      actionId: action.id,
      actionStatus: "approved",
      governance: governanceView(decision),
    };
  }

  // --- 3. Holdout assignment when eligible (PRD 14.2/14.3, 26A.1, 26B.14) --
  const holdoutResult = await assignHoldout({
    accountId: params.accountId,
    customerIds,
    actionType,
    activationLevel,
    // Unique per launch so concurrent holdouts stay independent (26B.14).
    seed: `${params.accountId}:${actionType}:${action.id}`,
    startedAt: now,
  });
  const measurementMode: MeasurementMode = holdoutResult.decision.mode;

  // Contamination risk check + disclosure (PRD 14.4, 26A.5).
  let contamination: {
    risk: ContractContaminationRisk;
    disclosure: string | null;
    caveats: string[];
  } | null = null;
  if (holdoutResult.holdoutId && holdoutResult.heldOutCustomerIds.length > 0) {
    const heldOutCustomers = await db.customer.findMany({
      where: { id: { in: holdoutResult.heldOutCustomerIds } },
      select: { emailLower: true },
    });
    const contaminationResult = checkContamination({
      holdoutEmailsLower: heldOutCustomers
        .map((customer) => customer.emailLower)
        .filter((email): email is string => email !== null),
      sources: await loadExistingFlowReachSources(params.accountId),
    });
    await db.holdout.update({
      where: { id: holdoutResult.holdoutId },
      data: { contaminationRisk: contaminationResult.risk },
    });
    contamination = {
      risk: contaminationResult.risk,
      disclosure: contaminationResult.disclosure,
      caveats: contaminationResult.caveats,
    };
    await writeLedger({
      accountId: params.accountId,
      eventType: "holdout_assignment",
      userId: params.approver,
      actionId: action.id,
      opportunityId: action.opportunityId ?? undefined,
      constitutionVersion: action.constitutionVersion,
      sourceDataUsed: {
        holdoutId: holdoutResult.holdoutId,
        eligibleAudienceSize: customerIds.length,
        holdoutSize: holdoutResult.heldOutCustomerIds.length,
        contaminationRisk: contaminationResult.risk,
      },
      reasoningSummary: `10% randomized customer-level holdout assigned (${holdoutResult.heldOutCustomerIds.length} of ${customerIds.length}). ${holdoutResult.decision.reasons.join(" ")}`,
      measurementMode,
      actionTaken: "holdout assigned and persisted",
    });
  }

  // --- 4. SIMULATED activation (Alpha, PRD 25.1) ----------------------------
  const { finalLevel, ladder } = simulateActivationLadder(channel, activationLevel);

  await db.action.update({
    where: { id: action.id },
    data: {
      status: "launched",
      approvedBy: params.approver,
      launchedAt: now,
      holdoutId: holdoutResult.holdoutId,
      measurementMode,
      activationLevel: finalLevel,
    },
  });
  await db.draft.update({
    where: { id: draft.id },
    data: { status: "activated" },
  });
  if (action.opportunityId) {
    await db.opportunity.update({
      where: { id: action.opportunityId },
      data: { status: "launched" },
    });
  }

  // --- 5. Measurement windows (26A.2) ---------------------------------------
  const windows = await persistMeasurementWindows({
    accountId: params.accountId,
    actionId: action.id,
    recipeId,
    mode: measurementMode,
    launchedAt: now,
  });

  await writeLedger({
    accountId: params.accountId,
    eventType: "activation_success",
    userId: params.approver,
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    constitutionVersion: action.constitutionVersion,
    sourceDataUsed: {
      simulated: true,
      ladder: ladder.map((step) => `${step.level}:${step.outcome}`),
      audienceSize: customerIds.length,
      holdoutId: holdoutResult.holdoutId,
    },
    sourceFreshness,
    reasoningSummary: `Simulated activation at level "${ACTIVATION_LEVELS[finalLevel]}" (PRD 25.1). Measurement: ${MEASUREMENT_LABEL_COPY[measurementMode]}${holdoutResult.decision.downgradedByActivationLevel ? " (downgraded from holdout by activation level — 26A.1)" : ""}.`,
    approvalStatus: "approved",
    destination: channel,
    activationLevel: finalLevel,
    actionTaken: "activation simulated successfully",
    measurementMode,
  });

  const windowDefaults = buildMeasurementWindows(recipeId, now);

  return {
    activated: true,
    actionId: action.id,
    actionStatus: "launched",
    governance: governanceView(decision),
    activation: {
      level: finalLevel,
      levelCopy: ACTIVATION_LEVELS[finalLevel],
      simulated: true,
      ladder,
    },
    measurement: {
      mode: measurementMode,
      label: MEASUREMENT_LABELS[measurementMode],
      labelCopy: MEASUREMENT_LABEL_COPY[measurementMode],
      downgradedByActivationLevel:
        holdoutResult.decision.downgradedByActivationLevel,
      reasons: holdoutResult.decision.reasons,
      holdout:
        holdoutResult.holdoutId && holdoutResult.plan
          ? {
              holdoutId: holdoutResult.holdoutId,
              eligibleAudienceSize: holdoutResult.plan.eligibleAudienceSize,
              holdoutPercent: holdoutResult.plan.holdoutPercent,
              holdoutSize: holdoutResult.plan.holdoutSize,
              exclusionWindow: holdoutResult.plan.exclusionWindow,
            }
          : null,
      contamination,
      windows: windows.map((window, index) => ({
        readType: window.readType,
        days: windowDefaults[index]?.days ?? 0,
        start: window.start,
        end: window.end,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// rejectAction — reason feeds the 26B.18 learning loop
// ---------------------------------------------------------------------------

export async function rejectAction(params: {
  accountId: string;
  actionId: string;
  reason: string;
  userId?: string;
}): Promise<RejectActionResult> {
  await requireAccount(params.accountId);
  if (!params.reason.trim()) {
    throw new Error("A rejection reason is required (PRD 26 DoD #11).");
  }

  const action = await db.action.findFirst({
    where: { id: params.actionId, accountId: params.accountId },
    include: {
      opportunity: true,
      approvals: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });
  if (!action) throw new Error(`Action ${params.actionId} not found.`);
  if (action.status === "launched") {
    throw new Error("Launched actions cannot be rejected — they are already live.");
  }

  const approvalRow = action.approvals[0];
  if (approvalRow) {
    await db.approval.update({
      where: { id: approvalRow.id },
      data: {
        status: "rejected",
        approver: params.userId,
        changesRequested: params.reason,
      },
    });
  }
  await db.action.update({
    where: { id: action.id },
    data: { status: "rejected" },
  });
  if (action.opportunityId && action.opportunity?.status === "drafted") {
    await db.opportunity.update({
      where: { id: action.opportunityId },
      data: { status: "proposed" },
    });
  }

  // 26B.18 — deterministic preference learning + rejection ledger entry.
  const learned = await recordRejectionPreference({
    accountId: params.accountId,
    reason: params.reason,
    userId: params.userId,
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    recipeId: action.opportunity
      ? requireRecipeId(action.opportunity.recipeId)
      : undefined,
    constitutionVersion: action.constitutionVersion,
  });

  return {
    actionId: action.id,
    actionStatus: "rejected",
    preferenceKeys: learned.preferenceKeys,
    ledgerId: learned.ledgerId,
  };
}

// ---------------------------------------------------------------------------
// recordDraftEdit — user edits feed the same learning loop (26B.18)
// ---------------------------------------------------------------------------

export async function recordDraftEdit(params: {
  accountId: string;
  draftId: string;
  editSummary: string;
  /** Full replacement copy after the edit (validated template steps). */
  copy?: unknown;
  userId?: string;
}): Promise<{ draftId: string; currentVersion: number; preferenceKeys: string[] }> {
  await requireAccount(params.accountId);
  const draft = await db.draft.findFirst({
    where: { id: params.draftId, accountId: params.accountId },
    include: { opportunity: true },
  });
  if (!draft) throw new Error(`Draft ${params.draftId} not found.`);

  const newCopy = params.copy !== undefined ? parseDraftCopy(params.copy) : null;
  const priorEdits = Array.isArray(draft.edits) ? draft.edits : [];
  const updated = await db.draft.update({
    where: { id: draft.id },
    data: {
      ...(newCopy && newCopy.length > 0 ? { copy: toInputJson(newCopy) } : {}),
      status: "edited",
      currentVersion: draft.currentVersion + 1,
      edits: toInputJson([
        ...priorEdits,
        {
          version: draft.currentVersion + 1,
          editedBy: params.userId ?? null,
          at: new Date().toISOString(),
          diffSummary: params.editSummary,
        },
      ]),
    },
  });

  const learned = await recordEditPreference({
    accountId: params.accountId,
    editSummary: params.editSummary,
    userId: params.userId,
    actionId: draft.actionId ?? undefined,
    opportunityId: draft.opportunityId ?? undefined,
    recipeId: draft.opportunity
      ? requireRecipeId(draft.opportunity.recipeId)
      : undefined,
  });

  return {
    draftId: updated.id,
    currentVersion: updated.currentVersion,
    preferenceKeys: learned.preferenceKeys,
  };
}
