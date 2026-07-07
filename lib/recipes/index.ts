/**
 * lib/recipes — public surface of the deterministic recipe module.
 *
 * Three v0 recipes (PRD 10 + 26A/26B), version 1.0.0:
 *   1. abandoned_checkout_recovery — 4h window, 14d max, NET of existing flows (26B.11)
 *   2. lapsed_winback              — personal-median cadence gate, category/merchant fallback
 *   3. meta_seed_suppression      — top-15% seed + 30d purchaser suppression, directional, no $
 *
 * Pure core: runRecipe(input, snapshot). I/O lives only in loader.ts.
 */

export { RECIPE_VERSION } from "./types";
export type {
  BaselineAvailability,
  ExclusionTally,
  ExistingFlowSnapshot,
  FlowMembershipSource,
  RecipeDataSnapshot,
} from "./types";

// Pure recipe functions + dispatcher
export { runAbandonedCheckoutRecovery } from "./abandoned-checkout";
export { runLapsedWinback } from "./lapsed-winback";
export { runMetaSeedSuppression } from "./meta-seed";
export { runRecipe } from "./run";

// Confidence scoring (PRD 11 — deterministic, inspectable)
export { scoreConfidence } from "./confidence";
export type { ConfidenceInputs, ConfidenceScore } from "./confidence";

// Measurement plan builders (PRD 14 / 26A.1 / 26A.2)
export {
  buildKlaviyoMeasurementPlan,
  buildMetaMeasurementPlan,
} from "./measurement-plan";

// Opportunity lifecycle (PRD 9.6 / 26B.16)
export {
  DEFAULT_DISMISSAL_COOLDOWN_DAYS,
  applyRedetection,
  buildDedupKey,
  dismissalPatch,
  estimateLabelForResult,
  isInCooldown,
  toOpportunityRecord,
} from "./lifecycle";
export type {
  OpportunityLifecycleView,
  OpportunityRecordFields,
  RedetectionDecision,
} from "./lifecycle";

// Found-money header (PRD 16.2)
export {
  computeFoundMoneyHeader,
  foundMoneyItemFromOpportunity,
  foundMoneyItemFromResult,
} from "./found-money";
export type { FoundMoneyHeader, FoundMoneyItem } from "./found-money";

// Config resolution (26A.9 RecipeConfig over RECIPE_CONFIG_DEFAULTS)
export { resolveRecipeConfig } from "./config";

// DB-backed loaders (the only I/O in this module)
export {
  loadRecipeInput,
  loadRecipeSnapshot,
  runAllRecipesForAccount,
  runRecipeForAccount,
} from "./loader";
