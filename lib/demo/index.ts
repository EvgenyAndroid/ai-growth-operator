/**
 * lib/demo/index.ts — public surface of the demo-data module (PRD 20, 25.1).
 *
 * - `loadDemoDataset()` returns the deterministic demo merchant dataset
 *   (memoized; same seed + fixed reference date => identical output).
 * - `seedDemoDatabase()` (from ./seed) writes it to the database under one
 *   demo Account with the Shopify DTC Constitution v1.
 *
 * What downstream modules can rely on:
 * - Recipe 1: ~600 residual-eligible abandoners (>=500, holdout path) after
 *   excluding the ~30% covered by the existing pre-Operator recovery flow
 *   (26B.11). Flow membership is stored on the manual Audience row
 *   "Existing Klaviyo flow: Abandoned Cart Rescue (pre-Operator)"
 *   (inclusionRules.memberEmails) and is also visible as email_open/click
 *   events with campaignId "klaviyo-flow:cart-rescue-pre-operator" (26A.5).
 * - Recipe 2: ~550 eligible lapsed customers past 1.5x personal median
 *   cadence, plus refund-heavy and gift-last-purchase exclusion cases.
 * - Recipe 3: distinct top-15% LTV cohort, consentAds mix (26B.13), and
 *   recent purchasers for the 30-day suppression window.
 * - Performance history: one completed win-back Action with a measured 10%
 *   holdout (holdout-verified, lift as a range), windows, approvals, draft,
 *   and a full Context Ledger trail.
 */

import {
  generateDemoDataset,
  type DemoDatasetInternal,
} from "./generator";

export {
  DEMO_SEED,
  DEMO_REFERENCE_DATE,
  DEMO_ACCOUNT_NAME,
  EXISTING_RECOVERY_FLOW_NAME,
  EXISTING_RECOVERY_FLOW_CAMPAIGN_ID,
  HISTORICAL_WINBACK_CAMPAIGN_ID,
  COHORT_SIZES,
  generateDemoDataset,
  datasetAov,
} from "./generator";
export type {
  DemoCohort,
  DemoDatasetInternal,
  DemoEventDraft,
  HistoricalWinback,
} from "./generator";
export { seedDemoDatabase } from "./seed";
export type { SeedSummary } from "./seed";

let cached: DemoDatasetInternal | undefined;

/**
 * The deterministic demo dataset (PRD 20). Memoized — generation is pure and
 * uses only the fixed seed + fixed reference date, never Date.now().
 * The return type extends the `DemoDataset` contract with cohort tags and the
 * historical win-back spec used by the seeder and smoke tests.
 */
export function loadDemoDataset(): DemoDatasetInternal {
  if (cached === undefined) {
    cached = generateDemoDataset();
  }
  return cached;
}
