/**
 * lib/recipes/lifecycle.ts — opportunity lifecycle helpers (PRD 9.6, 26 DoD #8, 26B.16).
 *
 *  - dedupKey = `${accountId}:${recipeId}` — one active card per recipe per account.
 *  - Re-detection updates the existing card IN PLACE (26B.16), never a new card.
 *  - Dismissal sets a cooldown; re-detection during cooldown is skipped.
 *
 * These are pure builders — persistence (prisma.opportunity.upsert etc.) is
 * owned by lib/server, which feeds these field maps straight into Prisma.
 */

import type {
  EstimateLabel,
  OpportunityStatus,
  RecipeId,
  RecipeResult,
} from "../contracts";
import { MS_PER_DAY } from "./shared";

/** 26B.16 — the one dedup key shape in v0. */
export function buildDedupKey(accountId: string, recipeId: RecipeId): string {
  return `${accountId}:${recipeId}`;
}

/** Default dismissal cooldown before the same recipe may re-surface a card. */
export const DEFAULT_DISMISSAL_COOLDOWN_DAYS = 14;

/**
 * EstimateLabel to persist on Opportunity.estimateLabel.
 * Recipe 3 carries no dollar estimate by design -> "directional" (PRD 10.4);
 * a null estimate elsewhere means no baseline -> "unavailable" (PRD 16.1).
 */
export function estimateLabelForResult(result: RecipeResult): EstimateLabel {
  if (result.estimate) return result.estimate.label;
  return result.recipeId === "meta_seed_suppression" ? "directional" : "unavailable";
}

/** Field map for creating/updating an Opportunity row from a RecipeResult. */
export interface OpportunityRecordFields {
  dedupKey: string;
  recipeId: RecipeId;
  recipeVersion: string;
  title: string;
  category: string;
  estimatedValueLow: number | null;
  estimatedValueHigh: number | null;
  estimateLabel: EstimateLabel;
  confidence: string;
  dataAsOf: Date;
  recommendedAction: string;
  explanation: unknown; // full ExplanationContract Json (PRD 4.4 — required to render)
  status: OpportunityStatus;
}

/**
 * Map a RecipeResult onto Opportunity columns. Status starts at "found" and
 * moves to "sized" when a defensible estimate exists (PRD 9.6 lifecycle).
 */
export function toOpportunityRecord(result: RecipeResult): OpportunityRecordFields {
  return {
    dedupKey: result.dedupKey,
    recipeId: result.recipeId,
    recipeVersion: result.recipeVersion,
    title: result.title,
    category: result.category,
    estimatedValueLow: result.estimate?.low ?? null,
    estimatedValueHigh: result.estimate?.high ?? null,
    estimateLabel: estimateLabelForResult(result),
    confidence: result.confidence,
    dataAsOf: new Date(result.dataAsOf),
    recommendedAction: result.recommendedAction,
    explanation: result.explanation,
    status: result.estimate ? "sized" : "found",
  };
}

/** Minimal shape of a persisted opportunity the lifecycle helpers care about. */
export interface OpportunityLifecycleView {
  status: string;
  cooldownUntil: Date | null;
}

/** True while a dismissed opportunity's cooldown window is still running. */
export function isInCooldown(opp: OpportunityLifecycleView, asOf: Date): boolean {
  return (
    opp.status === "dismissed" &&
    opp.cooldownUntil !== null &&
    opp.cooldownUntil.getTime() > asOf.getTime()
  );
}

/** Patch to apply when the merchant dismisses an opportunity (with reason). */
export function dismissalPatch(
  reason: string,
  asOf: Date,
  cooldownDays: number = DEFAULT_DISMISSAL_COOLDOWN_DAYS,
): { status: "dismissed"; dismissedReason: string; cooldownUntil: Date } {
  return {
    status: "dismissed",
    dismissedReason: reason,
    cooldownUntil: new Date(asOf.getTime() + cooldownDays * MS_PER_DAY),
  };
}

/** Statuses where re-detection must NOT clobber in-flight work (PRD 9.6). */
const IN_FLIGHT_STATUSES: ReadonlySet<string> = new Set([
  "drafted",
  "approved",
  "launched",
]);

export type RedetectionDecision =
  | { action: "skip"; reason: string }
  | { action: "create"; fields: OpportunityRecordFields }
  | {
      action: "update_in_place";
      /** 26B.16 — same card, refreshed sizing/explanation; status preserved when in flight. */
      fields: OpportunityRecordFields;
    };

/**
 * Decide what a re-detection run does to the existing card (26B.16):
 *  - no existing card -> create
 *  - dismissed + cooldown running -> skip
 *  - in-flight (drafted/approved/launched) -> refresh data but keep status
 *  - otherwise -> update in place (including resurfacing after cooldown expiry)
 */
export function applyRedetection(
  existing: (OpportunityLifecycleView & { status: string }) | null,
  result: RecipeResult,
  asOf: Date,
): RedetectionDecision {
  const fields = toOpportunityRecord(result);
  if (!existing) return { action: "create", fields };
  if (isInCooldown(existing, asOf)) {
    return {
      action: "skip",
      reason: `dismissed and in cooldown until ${existing.cooldownUntil?.toISOString()}`,
    };
  }
  if (IN_FLIGHT_STATUSES.has(existing.status)) {
    return {
      action: "update_in_place",
      fields: { ...fields, status: existing.status as OpportunityRecordFields["status"] },
    };
  }
  return { action: "update_in_place", fields };
}
