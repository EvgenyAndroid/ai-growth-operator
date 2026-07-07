/**
 * lib/recipes/local/coverage.ts — POS identified-coverage helpers (trust rule #9).
 *
 * LOCAL vertical law: estimates cover identified (loyalty-matched) customers
 * ONLY, and every local card/readout states the identified-transaction share.
 *
 * Snapshot convention (soft contract with lib/demo/local): every POS
 * transaction is an Event row with a purchase-like eventType. Transactions
 * matched to a loyalty customer carry `customerId`; unidentified walk-in
 * sales are Event rows with `customerId = null`. The identified share is
 * therefore derivable from the snapshot alone — no extra I/O.
 */

import type { IdentifiedCoverage } from "../../contracts";
import { buildIdentifiedCoverage } from "../../verticals";
import { isPurchaseEvent } from "../shared";
import type { RecipeDataSnapshot } from "../types";

export interface PosCoverageStats {
  /** All POS purchase-like transactions in the snapshot. */
  totalPosTransactions: number;
  /** Transactions matched to an identified (loyalty) customer. */
  identifiedPosTransactions: number;
  /** identified / total, in [0, 1]. 0 when no transactions exist. */
  identifiedShare: number;
  /** The disclosure object every local RecipeResult must carry. */
  coverage: IdentifiedCoverage;
}

/** Deterministic identified-transaction share over the snapshot's POS purchases. */
export function computePosCoverage(snapshot: RecipeDataSnapshot): PosCoverageStats {
  let total = 0;
  let identified = 0;
  for (const e of snapshot.events) {
    if (!isPurchaseEvent(e)) continue;
    total += 1;
    if (e.customerId !== null) identified += 1;
  }
  const identifiedShare = total > 0 ? identified / total : 0;
  return {
    totalPosTransactions: total,
    identifiedPosTransactions: identified,
    identifiedShare,
    coverage: buildIdentifiedCoverage(identifiedShare),
  };
}

/**
 * Average identified ticket: mean value of purchase events that are BOTH
 * valued and matched to an identified customer. Falls back to customer
 * aggregates (identified by definition — Customer rows are loyalty-matched).
 * Returns null when no identified purchase history exists.
 */
export function computeIdentifiedAvgTicket(
  snapshot: RecipeDataSnapshot,
): number | null {
  let sum = 0;
  let n = 0;
  for (const e of snapshot.events) {
    if (
      isPurchaseEvent(e) &&
      e.customerId !== null &&
      typeof e.value === "number" &&
      e.value > 0
    ) {
      sum += e.value;
      n += 1;
    }
  }
  if (n > 0) return sum / n;
  let revenue = 0;
  let orders = 0;
  for (const c of snapshot.customers) {
    revenue += c.totalRevenue;
    orders += c.totalOrders;
  }
  return orders > 0 ? revenue / orders : null;
}

/**
 * Trust rule #9 confidence hook: the identified-transaction share LOWERS the
 * source-completeness input of the confidence composite. A 60%-identified POS
 * stream can never claim the >= 80% completeness the HIGH bar requires.
 */
export function coverageAdjustedCompleteness(
  identityJoinCoverage: number,
  identifiedShare: number,
): number {
  return identityJoinCoverage * identifiedShare;
}

/** Human-readable confidence-input line for the identified share. */
export function coverageConfidenceInput(stats: PosCoverageStats): string {
  return `${Math.round(stats.identifiedShare * 100)}% of POS transactions identified (${stats.identifiedPosTransactions} of ${stats.totalPosTransactions}) — estimate covers identified customers only`;
}
