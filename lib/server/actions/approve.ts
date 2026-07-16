/**
 * lib/server/actions/approve.ts — approveAction implementation (P11 split).
 *
 * THE activation path. Order is law:
 *   approval -> governance checkAction (no way around it) ->
 *   holdout assignment when eligible (PRD 14.2/14.3, 26A.1) ->
 *   SIMULATED activation ladder (PRD 13, 25.1, 26B.17) ->
 *   measurement windows (26A.2) -> ledger.
 *
 * Callers reach this ONLY through the "use server" wrapper in ./index.ts,
 * which runs guardMutation (P7) + zod validation (P5) first; this module
 * starts at the account boundary (P4).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type {
  ActivationLevel,
  ContractActionType,
  ContractContaminationRisk,
  MeasurementMode,
} from "../../contracts";
import {
  ACTIVATION_LEVELS,
  MEASUREMENT_LABELS,
  MEASUREMENT_LABEL_COPY,
} from "../../contracts";
import db from "../../db";
import { checkAction } from "../../governance";
import { writeGovernanceDecision, writeLedger } from "../../ledger";
import {
  MIN_HOLDOUT_AUDIENCE,
  assignHoldout,
  buildMeasurementWindows,
  checkContamination,
  persistMeasurementWindows,
} from "../../measurement";
import { resolveRecipeConfig } from "../../recipes";
import { assertAccountAccess } from "../account-context";
import { copyTexts, maxOfferPercent, parseDraftCopy } from "../draft-templates";
import {
  accountClock,
  buildSourceFreshness,
  loadExistingFlowReachSources,
  parseAudienceCustomerIds,
  requireRecipeId,
} from "../shared";
import type { ApproveActionResult } from "../types";
import {
  channelFor,
  governanceView,
  simulateActivationLadder,
} from "./activation-ladder";

export async function runApproveAction(params: {
  accountId: string;
  actionId: string;
  approver?: string;
  /** 26A.8 — required true for Meta audience actions. */
  metaIdentifierRightsConfirmed?: boolean;
  /** Canonical claim keys the user explicitly overrode (overrideable claims only). */
  claimOverrides?: string[];
}): Promise<ApproveActionResult> {
  const account = await assertAccountAccess(params.accountId); // P4 — account boundary
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
  // Honor a merchant-raised minHoldoutAudience (26A.9 RecipeConfig). The 500
  // default (PRD 14.2) is a hard FLOOR: configs may raise it, never lower it.
  const storedRecipeConfig = await db.recipeConfig.findUnique({
    where: { accountId_recipeId: { accountId: params.accountId, recipeId } },
  });
  const { minHoldoutAudience: configuredMinHoldoutAudience } =
    resolveRecipeConfig(
      recipeId,
      storedRecipeConfig?.params,
      storedRecipeConfig?.overrides,
    ) as { minHoldoutAudience?: number }; // absent for meta_seed_suppression
  const holdoutResult = await assignHoldout({
    accountId: params.accountId,
    customerIds,
    actionType,
    activationLevel,
    minHoldoutAudience: Math.max(
      MIN_HOLDOUT_AUDIENCE,
      configuredMinHoldoutAudience ?? MIN_HOLDOUT_AUDIENCE,
    ),
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
              mde: holdoutResult.plan.mde,
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
