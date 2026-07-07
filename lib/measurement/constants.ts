/**
 * lib/measurement/constants.ts — Prove-It engine constants.
 *
 * PRD 14.4 (contamination disclosure), PRD 15 (Meta directional reporting:
 * allowed/disallowed metrics + required label), PRD 14.6 (no-control tag).
 *
 * The UI MUST source its metric whitelists and required labels from here —
 * do not restate these strings in components.
 */

import { META_DISALLOWED_TERMS } from "../contracts";

// ---------------------------------------------------------------------------
// PRD 14.4 — the exact disclosure shown when contamination risk is detected.
// ---------------------------------------------------------------------------

export const CONTAMINATION_DISCLOSURE =
  "Contamination risk detected. Holdout excludes customers from this Operator-created flow, but other active campaigns may still reach them. Interpret lift range with caution.";

// ---------------------------------------------------------------------------
// PRD 15.3 — required label on EVERY Meta report (card, approval screen,
// performance summary). This exact string is exempt from the lift-language
// guard below because it names the thing it is negating.
// ---------------------------------------------------------------------------

export const META_DIRECTIONAL_REQUIRED_LABEL =
  "Directional reporting only. This is not holdout-verified lift.";

// ---------------------------------------------------------------------------
// PRD 14.6 — tag shown with every before/after readout.
// ---------------------------------------------------------------------------

export const BEFORE_AFTER_NO_CONTROL_TAG = "Before/after, no control group";

// ---------------------------------------------------------------------------
// PRD 15.2 — the ONLY metrics a Meta directional report may show.
// Keys are the machine names used in MeasurementReadout.metrics;
// values are the display labels the UI must use.
// ---------------------------------------------------------------------------

export const META_ALLOWED_METRICS = {
  audience_created: "Audience created",
  audience_size: "Audience size",
  match_rate: "Match rate",
  sync_status: "Sync status",
  last_synced: "Last synced",
  used_in_campaign: "Audience used in campaign/ad set",
  spend_context: "Spend context",
  downstream_purchases: "Downstream purchases from synced audience (non-causal)",
  repeat_purchase_rate: "Repeat purchase rate after sync (non-causal)",
  new_customer_rate: "New customer rate after sync (non-causal)",
  prior_period_comparison: "Prior-period comparison (non-causal)",
} as const;

export type MetaAllowedMetricKey = keyof typeof META_ALLOWED_METRICS;

export const META_ALLOWED_METRIC_KEYS = Object.keys(
  META_ALLOWED_METRICS,
) as MetaAllowedMetricKey[];

// ---------------------------------------------------------------------------
// PRD 15.4 — metrics/language that must NEVER appear in a Meta report.
// Metric keys (machine names) and phrases (human language) are guarded
// separately.
// ---------------------------------------------------------------------------

export const META_DISALLOWED_METRIC_KEYS = [
  "lift",
  "lift_low",
  "lift_high",
  "incrementality",
  "recovered_revenue",
  "causal_roas",
  "verified_impact",
  "holdout_verified_result",
] as const;

/** PRD 15.4 phrases — superset of contracts META_DISALLOWED_TERMS. */
export const META_DISALLOWED_PHRASES: readonly string[] = [
  ...META_DISALLOWED_TERMS,
  "causal roas",
  "verified impact",
  "holdout-verified result",
  "incremental revenue",
];

/**
 * Scan text for disallowed lift/causal language (PRD 14.7 / 15.4).
 * The required PRD 15.3 label is exempted first — it is the only sanctioned
 * occurrence of "holdout-verified lift" in directional copy.
 * Returns the offending phrases (empty array = clean).
 */
export function findLiftLanguage(text: string): string[] {
  const cleaned = text
    .split(META_DIRECTIONAL_REQUIRED_LABEL)
    .join(" ")
    .toLowerCase();
  return META_DISALLOWED_PHRASES.filter((phrase) =>
    cleaned.includes(phrase.toLowerCase()),
  );
}

/** Throw if directional copy contains lift/causal language. Use at build time of every directional readout. */
export function assertNoLiftLanguage(texts: string[], context: string): void {
  for (const text of texts) {
    const hits = findLiftLanguage(text);
    if (hits.length > 0) {
      throw new Error(
        `Directional readout (${context}) contains disallowed lift language: ${hits.join(", ")} — PRD 15.4 forbids this for Meta/directional reporting.`,
      );
    }
  }
}
