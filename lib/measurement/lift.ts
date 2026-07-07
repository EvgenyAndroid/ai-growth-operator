/**
 * lib/measurement/lift.ts — lift calculation as a RANGE (PRD 14.5).
 *
 * Alpha is a SIMULATED READBACK (PRD 25.1): outcome events come from the demo
 * dataset, not live connectors. The math is the same math the beta will run
 * against real Klaviyo/Shopify events.
 *
 * METHOD (documented per task requirement):
 *   1. Split outcome events by holdout arm (treated = exposed, held_out = control).
 *   2. Per arm compute: n (members), purchasers (unique members with a
 *      purchase/repeat_purchase in the window), gross revenue, refunds.
 *      Revenue is REFUND-NETTED: net = gross - refunds (PRD 14.5/14.8).
 *   3. Purchase rates: pT = purchasersT / nT, pC = purchasersC / nC.
 *   4. Uncertainty band: normal approximation for the difference of two
 *      independent proportions —
 *        d  = pT - pC
 *        SE = sqrt( pT(1-pT)/nT + pC(1-pC)/nC )
 *        95% band: [d - 1.96·SE, d + 1.96·SE]
 *      This is a deliberately simple Wald interval; it is honest about small
 *      holdouts (wide bands) and cheap to compute. Beta may upgrade to
 *      Newcombe/Wilson without changing the interface.
 *   5. Relative lift range = band / pC (only when pC > 0; otherwise relative
 *      lift is undefined and we report absolute-only with a caveat).
 *   6. Incremental (recovered) revenue range = band × nT × netAOV, where
 *      netAOV = treated net revenue / treated purchasers. Floored at 0 for
 *      the low bound — we never claim negative "recovered revenue"; a band
 *      crossing zero instead drops confidence and adds a caveat.
 *
 * OUTPUT is ALWAYS a range — no point estimate is ever exposed (PRD 14.5/14.8).
 */

import type { Confidence, ContractContaminationRisk } from "../contracts";
import type { HoldoutArm } from "./holdout";

// ---------------------------------------------------------------------------
// Arm outcomes
// ---------------------------------------------------------------------------

export interface ArmOutcome {
  /** Members assigned to the arm. */
  size: number;
  /** Unique members with >=1 purchase in the window. */
  purchasers: number;
  /** Gross revenue from the arm's purchases in the window. */
  revenue: number;
  /** Refund value in the window (subtracted; PRD 14.8 "net refunds where data allows"). */
  refunds: number;
}

export type OutcomeEventType = "purchase" | "repeat_purchase" | "refund";

export interface OutcomeEvent {
  customerId: string;
  eventType: OutcomeEventType;
  /** ISO timestamp. */
  eventTimestamp: string;
  /** Order / refund value. Refund values may be positive or negative; abs() is used. */
  value?: number;
}

export interface OutcomeWindow {
  start: string; // ISO
  end: string; // ISO
}

/**
 * Aggregate demo (or real) outcome events into per-arm outcomes.
 * Events from customers not in the arm map, or outside the window, are ignored.
 */
export function computeArmOutcomes(
  events: OutcomeEvent[],
  arms: Map<string, HoldoutArm>,
  window: OutcomeWindow,
): { treated: ArmOutcome; heldOut: ArmOutcome } {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);

  let treatedSize = 0;
  let heldOutSize = 0;
  for (const arm of arms.values()) {
    if (arm === "treated") treatedSize++;
    else heldOutSize++;
  }

  const acc: Record<HoldoutArm, { purchaserIds: Set<string>; revenue: number; refunds: number }> = {
    treated: { purchaserIds: new Set(), revenue: 0, refunds: 0 },
    held_out: { purchaserIds: new Set(), revenue: 0, refunds: 0 },
  };

  for (const event of events) {
    const arm = arms.get(event.customerId);
    if (arm === undefined) continue;
    const ts = Date.parse(event.eventTimestamp);
    if (Number.isNaN(ts) || ts < startMs || ts > endMs) continue;
    const bucket = acc[arm];
    if (event.eventType === "refund") {
      bucket.refunds += Math.abs(event.value ?? 0);
    } else {
      bucket.purchaserIds.add(event.customerId);
      bucket.revenue += event.value ?? 0;
    }
  }

  return {
    treated: {
      size: treatedSize,
      purchasers: acc.treated.purchaserIds.size,
      revenue: acc.treated.revenue,
      refunds: acc.treated.refunds,
    },
    heldOut: {
      size: heldOutSize,
      purchasers: acc.held_out.purchaserIds.size,
      revenue: acc.held_out.revenue,
      refunds: acc.held_out.refunds,
    },
  };
}

// ---------------------------------------------------------------------------
// Lift range
// ---------------------------------------------------------------------------

export interface LiftRangeInput {
  treated: ArmOutcome;
  heldOut: ArmOutcome;
  contaminationRisk: ContractContaminationRisk;
  /** 26A.5 / contamination check may force a confidence downgrade. */
  lowerConfidence?: boolean;
  /** Extra caveats (e.g. 26B.14 cross-flow holdout interaction). */
  caveats?: string[];
}

export interface LiftRangeResult {
  /** Relative lift range vs holdout baseline, e.g. 0.42 = +42%. Null when baseline rate is 0. */
  measuredLiftLow: number | null;
  measuredLiftHigh: number | null;
  /** Absolute purchase-rate difference band (always computable). */
  absoluteRateDiffLow: number;
  absoluteRateDiffHigh: number;
  /** Refund-netted incremental revenue range across the treated arm; low bound floored at 0. */
  incrementalRevenueLow: number;
  incrementalRevenueHigh: number;
  /** Per-arm refund-netted purchase rates (inspectable, NOT for display as point lift). */
  treatedRate: number;
  heldOutRate: number;
  confidence: Confidence;
  caveats: string[];
  /** True when the 95% band includes zero — lift cannot be proven (PRD 14.8). */
  liftNotProven: boolean;
  method: "two_proportion_wald_95";
}

const Z_95 = 1.96;

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Compute the PRD 14.5 lift range. Pure and deterministic. */
export function computeLiftRange(input: LiftRangeInput): LiftRangeResult {
  const caveats: string[] = [...(input.caveats ?? [])];
  const { treated, heldOut } = input;

  if (treated.size === 0 || heldOut.size === 0) {
    caveats.push(
      "One measurement arm is empty — lift cannot be computed; report as not proven.",
    );
    return {
      measuredLiftLow: null,
      measuredLiftHigh: null,
      absoluteRateDiffLow: 0,
      absoluteRateDiffHigh: 0,
      incrementalRevenueLow: 0,
      incrementalRevenueHigh: 0,
      treatedRate: 0,
      heldOutRate: 0,
      confidence: "low",
      caveats,
      liftNotProven: true,
      method: "two_proportion_wald_95",
    };
  }

  // Steps 2-3: refund-netted rates. Refunded value reduces revenue; a
  // purchaser who later refunds still counts as a purchaser (conversion
  // happened) — the dollar impact is netted instead.
  const pT = treated.purchasers / treated.size;
  const pC = heldOut.purchasers / heldOut.size;
  const netRevenueTreated = treated.revenue - treated.refunds;

  // Step 4: Wald 95% band on the difference of proportions.
  const d = pT - pC;
  const se = Math.sqrt(
    (pT * (1 - pT)) / treated.size + (pC * (1 - pC)) / heldOut.size,
  );
  const dLow = d - Z_95 * se;
  const dHigh = d + Z_95 * se;

  // Step 5: relative lift only when the control converts at all.
  let liftLow: number | null = null;
  let liftHigh: number | null = null;
  if (pC > 0) {
    liftLow = round(dLow / pC, 4);
    liftHigh = round(dHigh / pC, 4);
  } else {
    caveats.push(
      "Holdout arm recorded zero purchases — relative lift is undefined; absolute rate difference reported instead.",
    );
  }

  // Step 6: incremental refund-netted revenue across the treated arm.
  const netAOV =
    treated.purchasers > 0 ? netRevenueTreated / treated.purchasers : 0;
  const incLow = Math.max(0, dLow * treated.size * netAOV);
  const incHigh = Math.max(0, dHigh * treated.size * netAOV);

  const liftNotProven = dLow <= 0;
  if (liftNotProven) {
    caveats.push(
      "The 95% uncertainty band includes zero — lift cannot be proven for this window (PRD 14.8).",
    );
  }

  // Confidence heuristic (deterministic, documented):
  //   high   — band excludes zero AND holdout arm >= 100 members
  //   medium — band excludes zero with a smaller holdout
  //   low    — band includes zero
  // Contamination "flagged" or a 26A.5 unknown-membership downgrade caps at medium/low.
  let confidence: Confidence = liftNotProven
    ? "low"
    : heldOut.size >= 100
      ? "high"
      : "medium";
  if (input.contaminationRisk === "flagged" && confidence === "high") {
    confidence = "medium";
  }
  if (input.lowerConfidence) {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return {
    measuredLiftLow: liftLow,
    measuredLiftHigh: liftHigh,
    absoluteRateDiffLow: round(dLow, 4),
    absoluteRateDiffHigh: round(dHigh, 4),
    incrementalRevenueLow: round(incLow, 2),
    incrementalRevenueHigh: round(incHigh, 2),
    treatedRate: round(pT, 4),
    heldOutRate: round(pC, 4),
    confidence,
    caveats,
    liftNotProven,
    method: "two_proportion_wald_95",
  };
}
