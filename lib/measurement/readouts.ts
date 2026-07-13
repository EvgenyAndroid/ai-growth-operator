/**
 * lib/measurement/readouts.ts — readout builders for the three measurement modes
 * (PRD 14.5/14.6/14.7, 15, 26A.2).
 *
 * Every readout carries its measurement window (26A.2) and one of EXACTLY
 * three labels. The directional builder physically cannot emit lift language:
 * metric keys are typed to the PRD 15.2 whitelist and all free text passes
 * through the PRD 15.4 language guard.
 */

import type {
  Confidence,
  ContractContaminationRisk,
  ContractReadType,
  MeasurementReadout,
} from "../contracts";
import { MEASUREMENT_LABELS, MEASUREMENT_LABEL_COPY } from "../contracts";
import {
  BEFORE_AFTER_NO_CONTROL_TAG,
  META_DIRECTIONAL_REQUIRED_LABEL,
  META_DISALLOWED_METRIC_KEYS,
  assertNoLiftLanguage,
  type MetaAllowedMetricKey,
} from "./constants";
import type { LiftRangeResult } from "./lift";

export interface ReadoutWindow {
  start: string;
  end: string;
  readType: ContractReadType;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Holdout-verified readout (PRD 14.5)
// ---------------------------------------------------------------------------

export interface HoldoutReadoutInput {
  actionId: string;
  window: ReadoutWindow;
  lift: LiftRangeResult;
  contaminationRisk: ContractContaminationRisk;
  /** e.g. "Abandoned checkout recovery flow" — used in the summary sentence. */
  actionName: string;
  /** PRD 14.5 inputs, surfaced as inspectable metrics. */
  eligibleAudience: number;
  holdoutSize: number;
  exposedSize: number;
  extraCaveats?: string[];
}

/** Build a holdout-verified readout. Lift is a RANGE, never a point (PRD 14.5/14.8). */
export function buildHoldoutReadout(
  input: HoldoutReadoutInput,
): MeasurementReadout {
  const { lift } = input;
  const caveats = [...lift.caveats, ...(input.extraCaveats ?? [])];

  // Multiple-look honesty: each holdout is read up to three times (early /
  // primary / long) with no multiplicity correction. Non-primary reads say so
  // and defer the decision to the primary read.
  if (input.window.readType !== "primary") {
    caveats.push(
      `This is the ${input.window.readType} read — one of up to three scheduled looks at this holdout, with no multiplicity correction applied. Treat the primary read as the decision read.`,
    );
  }

  const liftRange =
    lift.measuredLiftLow !== null && lift.measuredLiftHigh !== null
      ? { low: lift.measuredLiftLow, high: lift.measuredLiftHigh }
      : undefined;

  const summary = lift.liftNotProven
    ? `${input.actionName}: exposed customers purchased at ${formatPercent(lift.treatedRate)} vs ${formatPercent(lift.heldOutRate)} in the holdout, but the uncertainty band includes zero — lift cannot be proven for this ${input.window.readType} read. Next: wait for the longer read window before drawing conclusions.`
    : `${input.actionName}: exposed customers purchased at ${formatPercent(lift.treatedRate)} vs ${formatPercent(lift.heldOutRate)} in the holdout. Refund-netted incremental revenue is estimated between ${formatMoney(lift.incrementalRevenueLow)} and ${formatMoney(lift.incrementalRevenueHigh)} for this ${input.window.readType} read${liftRange ? ` (relative lift ${formatPercent(liftRange.low)} to ${formatPercent(liftRange.high)})` : ""}.`;

  return {
    actionId: input.actionId,
    mode: "holdout",
    label: MEASUREMENT_LABELS.holdout,
    window: input.window,
    lift: liftRange,
    metrics: {
      eligible_audience: input.eligibleAudience,
      holdout_size: input.holdoutSize,
      exposed_audience: input.exposedSize,
      exposed_purchase_rate: lift.treatedRate,
      holdout_purchase_rate: lift.heldOutRate,
      incremental_revenue_low: lift.incrementalRevenueLow,
      incremental_revenue_high: lift.incrementalRevenueHigh,
      revenue_netting: "refund-netted",
    },
    confidence: lift.confidence,
    contaminationRisk: input.contaminationRisk,
    caveats,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Before/after, no control group (PRD 14.6)
// ---------------------------------------------------------------------------

export interface PeriodOutcome {
  /** ISO period bounds (before-period and after-period must be equal length). */
  start: string;
  end: string;
  purchases: number;
  revenue: number;
  refunds: number;
}

export interface BeforeAfterReadoutInput {
  actionId: string;
  window: ReadoutWindow; // the AFTER window (26A.2 read)
  before: PeriodOutcome;
  after: PeriodOutcome;
  actionName: string;
  /** Why there is no control (audience < 500, downgraded activation, contamination...). */
  whyNoControl: string;
  confidence?: Confidence; // default "medium" capped by design — never "high" without a control
  contaminationRisk?: ContractContaminationRisk;
  extraCaveats?: string[];
}

/**
 * Build a before/after readout. The comparison is explicitly NON-CAUSAL:
 * we show the delta but tag it "Before/after, no control group" (PRD 14.6)
 * and never call it lift.
 */
export function buildBeforeAfterReadout(
  input: BeforeAfterReadoutInput,
): MeasurementReadout {
  const netBefore = input.before.revenue - input.before.refunds;
  const netAfter = input.after.revenue - input.after.refunds;
  const delta = netAfter - netBefore;

  // No control group => confidence is structurally capped below "high".
  const confidence: Confidence =
    input.confidence === "high" ? "medium" : (input.confidence ?? "medium");

  const caveats = [
    `${BEFORE_AFTER_NO_CONTROL_TAG} — the change cannot be attributed causally to this action.`,
    input.whyNoControl,
    ...(input.extraCaveats ?? []),
  ];

  const summary = `${input.actionName}: refund-netted revenue moved from ${formatMoney(netBefore)} (before) to ${formatMoney(netAfter)} (after) for this ${input.window.readType} read — a change of ${formatMoney(Math.abs(delta))} ${delta >= 0 ? "up" : "down"}. No control group: seasonality, promotions, or other campaigns may explain part or all of the change.`;

  return {
    actionId: input.actionId,
    mode: "before_after_no_control",
    label: MEASUREMENT_LABELS.before_after_no_control,
    window: input.window,
    // NO lift field — before/after never claims lift.
    metrics: {
      before_purchases: input.before.purchases,
      after_purchases: input.after.purchases,
      before_net_revenue: Math.round(netBefore * 100) / 100,
      after_net_revenue: Math.round(netAfter * 100) / 100,
      net_change_non_causal: Math.round(delta * 100) / 100,
      revenue_netting: "refund-netted",
      tag: MEASUREMENT_LABEL_COPY.before_after_no_control,
    },
    confidence,
    contaminationRisk: input.contaminationRisk ?? "none",
    caveats,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Directional (Meta) readout (PRD 14.7 + 15)
// ---------------------------------------------------------------------------

export interface DirectionalReadoutInput {
  actionId: string;
  window: ReadoutWindow;
  /** ONLY PRD 15.2 whitelisted metric keys compile. */
  metrics: Partial<Record<MetaAllowedMetricKey, number | string>>;
  actionName: string;
  summary: string;
  confidence?: Confidence; // default "low" — directional is never a causal claim
  extraCaveats?: string[];
}

/**
 * Build a Meta directional readout. Guarantees (PRD 14.7/15.3/15.4/15.5):
 *   - label is "directional"; required PRD 15.3 disclaimer is caveat #1
 *   - metric keys are compile-time restricted to the 15.2 whitelist AND
 *     runtime-checked against the 15.4 blacklist
 *   - summary/caveats are scanned for lift/incrementality/recovered-revenue/
 *     causal-ROAS language and the builder THROWS if any is found
 *   - no lift field, ever
 */
export function buildDirectionalReadout(
  input: DirectionalReadoutInput,
): MeasurementReadout {
  // Runtime guard on metric keys (belt + suspenders over the compile-time type).
  const disallowed = new Set<string>(META_DISALLOWED_METRIC_KEYS);
  for (const key of Object.keys(input.metrics)) {
    if (disallowed.has(key)) {
      throw new Error(
        `Directional readout for ${input.actionId} uses disallowed metric key "${key}" (PRD 15.4).`,
      );
    }
  }

  const caveats = [
    META_DIRECTIONAL_REQUIRED_LABEL,
    "Downstream performance shown here is observational and non-causal.",
    ...(input.extraCaveats ?? []),
  ];

  // PRD 15.4 language guard over every free-text field.
  assertNoLiftLanguage([input.summary, ...caveats], input.actionName);

  return {
    actionId: input.actionId,
    mode: "directional",
    label: MEASUREMENT_LABELS.directional,
    window: input.window,
    // NO lift field — Meta never shows holdout or lift language (PRD 14.8).
    metrics: { ...input.metrics },
    confidence: input.confidence ?? "low",
    contaminationRisk: "none", // no holdout exists to contaminate
    caveats,
    summary: input.summary,
  };
}
