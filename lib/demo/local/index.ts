/**
 * lib/demo/local/index.ts — public surface of the LOCAL demo-data module
 * (LOCAL vertical pack, PRD 25.1 demo-mode only).
 *
 * - `loadLocalDemoDataset()` returns the deterministic "Cardamom & Rye"
 *   bakery-café dataset (memoized; fixed seed + the same fixed reference date
 *   as the DTC demo => identical output on every call).
 * - `seedLocalDemoDatabase()` (from ./seed) writes it to the database as a
 *   SECOND demo Account with the "Local & multi-location service"
 *   Constitution v1. The DTC account is untouched.
 *
 * What downstream modules can rely on:
 * - POS coverage (trust rule #9): identified (loyalty-matched) share of POS
 *   purchases is ~65% by construction; the exact value is on
 *   `dataset.coverageStats` and persisted to the Preference key
 *   "pos_identified_coverage" (POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY) where
 *   the LOCAL recipes read it for the coverage disclosure.
 * - local_lapsed_regular: exactly 180 eligible lapsed regulars (deepLapsed +
 *   reLapsedReturners cohorts) — deliberately BELOW the 500 holdout floor so
 *   the before/after-no-control path exercises.
 * - catering_upsell: 25 large orders (value >= 60, within 90 days) from 18
 *   customers; 7 of them have >= 2 large orders (the minLargeOrders default).
 * - meta_seed_suppression: consentAds is false for ~40% of customers (26B.13).
 * - Performance history: one completed Mailchimp-like email action measured
 *   BEFORE/AFTER with NO holdout (audience was 210), so the performance screen
 *   shows the before-after-no-control label on day 0.
 */

import {
  generateLocalDemoDataset,
  type LocalDemoDatasetInternal,
} from "./generator";

export {
  LOCAL_DEMO_SEED,
  LOCAL_DEMO_REFERENCE_DATE,
  LOCAL_DEMO_ACCOUNT_NAME,
  LOCAL_COHORT_SIZES,
  LOCAL_ELIGIBLE_LAPSED_COUNT,
  LOCAL_IDENTIFIED_SHARE_TARGET,
  HISTORICAL_LOCAL_CAMPAIGN_ID,
  POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY,
  generateLocalDemoDataset,
  localDatasetAvgTicket,
} from "./generator";
export type {
  HistoricalLocalCampaign,
  LocalCohort,
  LocalConstitutionSpec,
  LocalCoverageStats,
  LocalDemoDatasetInternal,
  LocalEventDraft,
} from "./generator";
export { buildLocalCatalog } from "./catalog";
export type { LocalDemoProduct } from "./catalog";
export { seedLocalDemoDatabase } from "./seed";
export type { LocalSeedSummary } from "./seed";

let cached: LocalDemoDatasetInternal | undefined;

/**
 * The deterministic LOCAL demo dataset. Memoized — generation is pure and uses
 * only the fixed seed + fixed reference date, never Date.now().
 */
export function loadLocalDemoDataset(): LocalDemoDatasetInternal {
  if (cached === undefined) {
    cached = generateLocalDemoDataset();
  }
  return cached;
}
