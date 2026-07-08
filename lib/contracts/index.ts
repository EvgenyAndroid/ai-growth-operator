/**
 * lib/contracts — shared type surface for all AI Growth Operator modules.
 *
 * Split (hardening pass, July 2026):
 *   ./public — client-safe constants + types + pure helpers (re-exported here)
 *   ./models — server-only Prisma model type re-exports (NOT re-exported here;
 *              server modules import "@/lib/contracts/models" explicitly)
 *
 * This index re-exports ONLY the public surface, so "@/lib/contracts" is safe
 * to import from Client Components and components/ui/primitives.tsx.
 *
 * Named (not star) re-exports on purpose: the tsx-run node scripts (seed,
 * smoke cycles) import this module from ESM entrypoints, and node's named-
 * export detection for transpiled modules cannot see through `export *`.
 */

export {
  ACTIVATION_LEVELS,
  CHAT_UNSUPPORTED_RESPONSE,
  CONFIDENCE,
  CONFIDENCE_LEVELS,
  DEFAULT_BANNED_CLAIMS,
  DEFAULT_MEASUREMENT_WINDOWS,
  DTC_RECIPE_IDS,
  ESTIMATE_LABELS,
  HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS,
  isFoundMoneyEligible,
  LOCAL_RECIPE_CONFIG_DEFAULTS,
  LOCAL_RECIPE_IDS,
  MEASUREMENT_LABEL_COPY,
  MEASUREMENT_LABELS,
  MEASUREMENT_MODES,
  META_DISALLOWED_TERMS,
  OPPORTUNITY_STATUSES,
  RECIPE_CONFIG_DEFAULTS,
  RECIPE_IDS,
  VERTICALS,
} from "./public";

export type {
  ActivationLevel,
  AudienceSpec,
  ChatIntent,
  Confidence,
  ContractActionStatus,
  ContractActionType,
  ContractApprovalStatus,
  ContractContaminationRisk,
  ContractDestinationStatus,
  ContractDraftStatus,
  ContractEventType,
  ContractExportStatus,
  ContractHoldoutStatus,
  ContractLedgerEventType,
  ContractLifecycleStage,
  ContractOAuthStatus,
  ContractReadType,
  ContractRepeatability,
  ContractSuppressionStatus,
  ContractSyncStatus,
  DataFreshness,
  DemoDataset,
  DtcRecipeId,
  EstimateLabel,
  EstimateRange,
  ExplanationContract,
  GovernanceCheckInput,
  GovernanceCheckResult,
  GovernanceGate,
  HoldoutPlan,
  IdentifiedCoverage,
  IntegrationSource,
  LedgerWrite,
  LedgerWriteFn,
  LocalRecipeId,
  MeasurementLabel,
  MeasurementMode,
  MeasurementPlan,
  MeasurementReadout,
  OpportunityStatus,
  RecipeConfigShape,
  RecipeId,
  RecipeInput,
  RecipeResult,
  Vertical,
} from "./public";
