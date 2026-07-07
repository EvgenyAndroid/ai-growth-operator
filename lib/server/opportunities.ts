"use server";

/**
 * lib/server/opportunities.ts — the opportunity feed (PRD 7.2/7.3, 26B.16).
 *
 * listOpportunities   — run the three deterministic recipes over the demo data,
 *                       dedup/update cards in place, compute the found-money
 *                       header (PRD 16.2, net-of-flows framing 26B.11), and
 *                       surface 26A.10 "what was checked" when nothing qualifies.
 * getOpportunityDetail— card + fresh deterministic re-run detail + audit trail.
 * dismissOpportunity  — reason + cooldown (PRD 9.6) + 26B.18 preference hook.
 */

import type { IdentifiedCoverage, RecipeResult } from "../contracts";
import db from "../db";
import {
  getOpportunityAuditTrail,
  recordRejectionPreference,
  writeLedger,
} from "../ledger";
import {
  applyRedetection,
  computeFoundMoneyHeader,
  foundMoneyItemFromOpportunity,
  runAllRecipesForAccount,
  runRecipeForAccount,
  DEFAULT_DISMISSAL_COOLDOWN_DAYS,
  dismissalPatch,
} from "../recipes";
import { MEASUREMENT_LABEL_COPY } from "../contracts";
import { getVerticalDefinition } from "../verticals";
import { parseDraftCopy } from "./draft-templates";
import {
  accountClock,
  ledgerEntryToView,
  loadRejectionDemotions,
  opportunityToCard,
  rankOpportunityCards,
  requireAccount,
  requireRecipeId,
  toInputJson,
} from "./shared";
import type {
  ActionSummaryView,
  DismissOpportunityResult,
  DraftView,
  FeedView,
  NoOpportunityView,
  OpportunityDetailView,
} from "./types";

/**
 * The feed (PRD 7.2). Every call re-runs the deterministic recipes and applies
 * 26B.16 re-detection: one active card per recipe per account, updated in
 * place — never duplicated. Cooldown-dismissed cards are skipped.
 */
export async function listOpportunities(accountId: string): Promise<FeedView> {
  const account = await requireAccount(accountId);
  // Demo accounts run on the demo dataset's fixed reference clock (PRD 25.1).
  const asOf = accountClock(account);

  // Vertical routing (trust rule #10): the registry decides which recipes run
  // — runAllRecipesForAccount resolves the account's vertical and routes
  // through lib/verticals. DTC accounts run the identical three v0 recipes in
  // the identical order as before.
  const vertical = getVerticalDefinition(account.vertical).vertical;
  const results: RecipeResult[] = await runAllRecipesForAccount(accountId, asOf);
  const noOpportunity: NoOpportunityView[] = [];

  for (const result of results) {
    if (result.noOpportunity) {
      // 26A.10 — nothing qualified: show what was checked, persist no card.
      noOpportunity.push({
        recipeId: result.recipeId,
        checked: result.noOpportunity.checked,
        whyNotQualified: result.noOpportunity.whyNotQualified,
        nearestNextAction: result.noOpportunity.nearestNextAction,
        unlocks: result.noOpportunity.unlocks,
      });
      continue;
    }
    await persistRedetection(accountId, result, asOf);
  }

  const rows = await db.opportunity.findMany({
    where: { accountId },
    orderBy: { createdAt: "asc" },
  });
  // The historical demo action's measured card uses a suffixed dedupKey; only
  // the three 26B.16 active-card keys belong in the feed.
  const activeCardKeys = new Set(results.map((result) => result.dedupKey));
  const feedRows = rows.filter((row) => activeCardKeys.has(row.dedupKey));

  const activeRows = feedRows.filter((row) => row.status !== "dismissed");
  const dismissedRows = feedRows.filter((row) => row.status === "dismissed");

  // LOCAL trust rule #9 — attach each fresh result's POS coverage disclosure
  // to its card (coverage is not persisted on the Opportunity row). DTC
  // results never carry coverage, so DTC cards keep coverage: null.
  const coverageByDedupKey = new Map<string, IdentifiedCoverage>();
  for (const result of results) {
    if (result.coverage) coverageByDedupKey.set(result.dedupKey, result.coverage);
  }
  const toCard = (row: (typeof feedRows)[number]) =>
    opportunityToCard(row, coverageByDedupKey.get(row.dedupKey) ?? null);

  const demoted = await loadRejectionDemotions(accountId);
  const cards = rankOpportunityCards(activeRows.map(toCard), demoted);

  // PRD 16.2 — the header sums ONLY Medium/High recovery + win-back estimates.
  const foundMoney = computeFoundMoneyHeader(
    feedRows.map(foundMoneyItemFromOpportunity),
  );

  return {
    accountId,
    vertical,
    demoMode: account.demoMode,
    generatedAt: asOf.toISOString(),
    foundMoney,
    // Account-level disclosure under the found-money header (trust rule #9).
    coverage: results.find((r) => r.coverage)?.coverage ?? null,
    opportunities: cards,
    dismissed: dismissedRows.map(toCard),
    noOpportunity,
  };
}

async function persistRedetection(
  accountId: string,
  result: RecipeResult,
  asOf: Date,
): Promise<void> {
  const existing = await db.opportunity.findUnique({
    where: { dedupKey: result.dedupKey },
  });
  const decision = applyRedetection(existing, result, asOf);

  if (decision.action === "skip") return;

  if (decision.action === "create") {
    const created = await db.opportunity.create({
      data: {
        accountId,
        ...decision.fields,
        explanation: toInputJson(decision.fields.explanation),
      },
    });
    await writeLedger({
      accountId,
      eventType: "opportunity_found",
      opportunityId: created.id,
      skillInvoked: result.recipeId,
      sourceDataUsed: {
        recipeVersion: result.recipeVersion,
        audienceSize: result.audience.size,
        exclusionsApplied: result.exclusionsApplied,
      },
      sourceFreshness: result.explanation.dataFreshness,
      reasoningSummary: result.explanation.found,
      confidence: result.confidence,
      measurementMode: result.measurementPlan.mode,
    });
    if (result.estimate) {
      await writeLedger({
        accountId,
        eventType: "opportunity_sized",
        opportunityId: created.id,
        skillInvoked: result.recipeId,
        sourceDataUsed: { estimate: result.estimate },
        reasoningSummary: `Estimated range $${Math.round(result.estimate.low)}-$${Math.round(result.estimate.high)} (${result.estimate.label}).`,
        confidence: result.confidence,
      });
    }
    return;
  }

  // update_in_place (26B.16)
  const estimateChanged =
    existing !== null &&
    (existing.estimatedValueLow !== decision.fields.estimatedValueLow ||
      existing.estimatedValueHigh !== decision.fields.estimatedValueHigh ||
      existing.confidence !== decision.fields.confidence);
  const updated = await db.opportunity.update({
    where: { dedupKey: result.dedupKey },
    data: {
      ...decision.fields,
      explanation: toInputJson(decision.fields.explanation),
      // Resurfacing after cooldown expiry clears the dismissal state.
      dismissedReason: decision.fields.status === "dismissed" ? undefined : null,
      cooldownUntil: decision.fields.status === "dismissed" ? undefined : null,
    },
  });
  if (estimateChanged) {
    await writeLedger({
      accountId,
      eventType: "opportunity_sized",
      opportunityId: updated.id,
      skillInvoked: result.recipeId,
      sourceDataUsed: { estimate: result.estimate },
      reasoningSummary:
        "Re-detection refreshed the existing card in place (26B.16) with updated sizing.",
      confidence: result.confidence,
    });
  }
}

/** Opportunity detail (PRD 7.3): card + audience/exclusions + drafts + audit. */
export async function getOpportunityDetail(params: {
  accountId: string;
  opportunityId: string;
}): Promise<OpportunityDetailView> {
  const account = await requireAccount(params.accountId);
  const row = await db.opportunity.findFirst({
    where: { id: params.opportunityId, accountId: params.accountId },
    include: {
      drafts: { orderBy: { createdAt: "desc" } },
      actions: {
        orderBy: { createdAt: "desc" },
        include: {
          approvals: { orderBy: { timestamp: "desc" }, take: 1 },
          audience: { select: { size: true } },
        },
      },
    },
  });
  if (!row) throw new Error(`Opportunity ${params.opportunityId} not found.`);

  const recipeId = requireRecipeId(row.recipeId);
  // Deterministic re-run at read time for audience/exclusion/confidence detail
  // (this data is not persisted on the card; same inputs => same outputs).
  const fresh = await runRecipeForAccount(
    params.accountId,
    recipeId,
    accountClock(account),
  );

  const drafts: DraftView[] = row.drafts.map((draft) => ({
    draftId: draft.id,
    actionId: draft.actionId,
    opportunityId: draft.opportunityId,
    copy: parseDraftCopy(draft.copy),
    activationTarget: draft.activationTarget as DraftView["activationTarget"],
    currentVersion: draft.currentVersion,
    status: draft.status,
    createdAt: draft.createdAt.toISOString(),
  }));

  const actions: ActionSummaryView[] = row.actions.map((action) => ({
    actionId: action.id,
    type: action.type,
    channel: action.channel,
    status: action.status as ActionSummaryView["status"],
    activationLevel:
      (action.activationLevel as ActionSummaryView["activationLevel"]) ?? null,
    measurementMode: action.measurementMode as ActionSummaryView["measurementMode"],
    measurementLabelCopy:
      MEASUREMENT_LABEL_COPY[
        action.measurementMode as ActionSummaryView["measurementMode"]
      ],
    launchedAt: action.launchedAt ? action.launchedAt.toISOString() : null,
    constitutionVersion: action.constitutionVersion,
    approvalStatus:
      (action.approvals[0]?.status as ActionSummaryView["approvalStatus"]) ?? null,
    holdoutId: action.holdoutId,
    audienceSize: action.audience?.size ?? null,
  }));

  const audit = await getOpportunityAuditTrail(params.accountId, row.id);

  return {
    // Coverage disclosure re-attached from the fresh deterministic re-run
    // (LOCAL trust rule #9; null for DTC recipes).
    card: opportunityToCard(row, fresh.coverage ?? null),
    audience: fresh.noOpportunity
      ? null
      : {
          name: fresh.audience.name,
          size: fresh.audience.size,
          eligibleChannels: fresh.audience.eligibleChannels,
        },
    suppressionAudience: fresh.suppressionAudience
      ? {
          name: fresh.suppressionAudience.name,
          size: fresh.suppressionAudience.size,
        }
      : null,
    exclusionsApplied: fresh.exclusionsApplied,
    confidenceInputs: fresh.confidenceInputs,
    drafts,
    actions,
    auditTrail: audit.map(ledgerEntryToView),
  };
}

/**
 * Dismiss with reason (PRD 26 DoD #11). Sets the cooldown window (default 14
 * days) so re-detection skips the card (26B.16), logs the dismissal, and feeds
 * the 26B.18 learned-preferences hook.
 */
export async function dismissOpportunity(params: {
  accountId: string;
  opportunityId: string;
  reason: string;
  cooldownDays?: number;
  userId?: string;
}): Promise<DismissOpportunityResult> {
  await requireAccount(params.accountId);
  if (!params.reason.trim()) {
    throw new Error("A dismissal reason is required (PRD 26 DoD #11).");
  }
  const row = await db.opportunity.findFirst({
    where: { id: params.opportunityId, accountId: params.accountId },
  });
  if (!row) throw new Error(`Opportunity ${params.opportunityId} not found.`);

  const now = new Date();
  const patch = dismissalPatch(
    params.reason,
    now,
    params.cooldownDays ?? DEFAULT_DISMISSAL_COOLDOWN_DAYS,
  );
  await db.opportunity.update({ where: { id: row.id }, data: patch });

  await writeLedger({
    accountId: params.accountId,
    eventType: "dismissal",
    userId: params.userId,
    opportunityId: row.id,
    skillInvoked: row.recipeId,
    reasoningSummary: `User dismissed with reason: "${params.reason}". Cooldown until ${patch.cooldownUntil.toISOString()}.`,
    actionTaken: "opportunity dismissed; re-detection paused for cooldown",
  });

  // 26B.18 — dismissal reasons are learning signals like rejection reasons.
  const learned = await recordRejectionPreference({
    accountId: params.accountId,
    reason: params.reason,
    userId: params.userId,
    opportunityId: row.id,
    recipeId: requireRecipeId(row.recipeId),
  });

  return {
    opportunityId: row.id,
    status: "dismissed",
    cooldownUntil: patch.cooldownUntil.toISOString(),
    preferenceKeys: learned.preferenceKeys,
  };
}
