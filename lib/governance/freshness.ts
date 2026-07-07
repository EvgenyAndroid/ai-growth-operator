/**
 * lib/governance/freshness.ts — data-freshness thresholds and the freshness
 * gate used by checkAction (PRD 8.4 defaults, PRD 8.5 block message shape).
 *
 * Launches MUST be blocked when required source data is stale. The block
 * message follows the PRD 8.5 shape exactly so the UI can render it verbatim
 * with a re-sync affordance.
 */

import type { DataFreshness } from "../contracts";

/**
 * PRD 8.4 — default freshness thresholds (hours) per source and data type.
 * These are safe defaults; per-account overrides live on Integration.
 * The GA4 PRD row says "24–48 hours"; we adopt the conservative bound that
 * still allows daily GA4 exports (48h) as the default, editable in settings.
 */
export const DEFAULT_FRESHNESS_THRESHOLDS_HOURS = {
  shopify: {
    orders: 2,
    checkouts: 2,
    products: 24,
    refunds: 24,
  },
  klaviyo: {
    consent_suppression: 2,
    profiles_lists: 6,
    engagement: 24,
    flow_campaign_status: 6,
  },
  meta: {
    audience_sync_status: 24,
    match_status: 24,
    performance: 24,
  },
  ga4: {
    site_behavior: 48,
  },
  stripe: {
    payments: 6,
  },
} as const;

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  shopify: "Shopify",
  klaviyo: "Klaviyo",
  meta: "Meta Ads",
  ga4: "GA4",
  stripe: "Stripe",
  demo: "demo",
};

/** Hours elapsed since an ISO timestamp (never negative). */
export function hoursSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY; // unparseable → fail closed
  return Math.max(0, (now.getTime() - then) / (1000 * 60 * 60));
}

/** Human formatting used inside the PRD 8.5 message ("9 hours", "2.5 hours"). */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "an unknown number of";
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return String(rounded);
}

/**
 * PRD 8.5 — the exact block-message shape:
 * "This action depends on Klaviyo consent data that has not synced in 9 hours.
 *  Your Operating Rules require consent data to be fresher than 2 hours before
 *  launch. Re-sync Klaviyo to continue."
 */
export function freshnessBlockMessage(
  source: DataFreshness["source"],
  hoursSinceSync: number,
  thresholdHours: number,
): string {
  const name = SOURCE_DISPLAY_NAMES[source] ?? source;
  return (
    `This action depends on ${name} data that has not synced in ` +
    `${formatHours(hoursSinceSync)} hours. Your Operating Rules require ` +
    `${name} data to be fresher than ${thresholdHours} hours before launch. ` +
    `Re-sync ${name} to continue.`
  );
}

export interface FreshnessEvaluation {
  source: DataFreshness["source"];
  stale: boolean;
  hoursSinceSync: number;
  thresholdHours: number;
  /** PRD 8.5 message; only set when stale. */
  blockMessage?: string;
}

/**
 * Evaluate a single DataFreshness entry. An entry is stale when the producer
 * already marked it stale OR the elapsed time exceeds its threshold — either
 * condition blocks (fail closed).
 */
export function evaluateFreshness(
  entry: DataFreshness,
  now: Date = new Date(),
): FreshnessEvaluation {
  const elapsed = hoursSince(entry.lastSyncAt, now);
  const stale = entry.isStale || elapsed > entry.thresholdHours;
  return {
    source: entry.source,
    stale,
    hoursSinceSync: elapsed,
    thresholdHours: entry.thresholdHours,
    blockMessage: stale
      ? freshnessBlockMessage(entry.source, elapsed, entry.thresholdHours)
      : undefined,
  };
}

/** Evaluate every source an action depends on; returns only stale findings. */
export function findStaleSources(
  sourceFreshness: DataFreshness[],
  now: Date = new Date(),
): FreshnessEvaluation[] {
  return sourceFreshness
    .map((entry) => evaluateFreshness(entry, now))
    .filter((evaluation) => evaluation.stale);
}
