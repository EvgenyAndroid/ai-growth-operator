/**
 * lib/recipes/local — LOCAL vertical pack recipes (café/bakery, demo-mode).
 *
 * Version 1.0.0, dispatched by Account.vertical through lib/verticals.ts:
 *   1. local_lapsed_regular — POS visit-cadence win-back, identified customers
 *      only, coverage disclosure, before/after at demo audience sizes (~180;
 *      holdout branch exists and triggers only >= 500).
 *   2. catering_upsell — repeat large-order detection, exportable-brief
 *      personal outreach, modeled estimate, never found-money, no holdout.
 *   3. meta_seed_suppression (SHARED) — same deterministic core as DTC with
 *      POS wording + coverage disclosure; directional as ever.
 *
 * Trust rule #9 lives here: every result carries RecipeResult.coverage and
 * states the identified-transaction share in its explanation.
 */

export {
  computeIdentifiedAvgTicket,
  computePosCoverage,
  coverageAdjustedCompleteness,
  coverageConfidenceInput,
} from "./coverage";
export type { PosCoverageStats } from "./coverage";

export { buildLocalEmailMeasurementPlan } from "./measurement";
export type { LocalEmailPlanArgs, LocalEmailRecipeId } from "./measurement";

export { runLocalLapsedRegular } from "./lapsed-regular";
export { runCateringUpsell } from "./catering-upsell";
export { runLocalMetaSeed } from "./meta-seed";

export {
  buildCateringUpsellBrief,
  buildLocalLapsedRegularSteps,
} from "./drafts";
export type { LocalDraftParams, LocalDraftStep } from "./drafts";
