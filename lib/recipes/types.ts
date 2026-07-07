/**
 * lib/recipes/types.ts — internal types for the deterministic recipe module.
 *
 * OWNED BY RECIPES. Recipes are pure functions:
 *   (RecipeInput, RecipeDataSnapshot) -> RecipeResult
 * The snapshot is assembled by loader.ts (the only file here that touches
 * lib/db). Same input + same snapshot => byte-identical output (PRD 10.1).
 */

import type {
  ContractActionType,
  Customer,
  DataFreshness,
  Event,
  Product,
} from "../contracts";

/** PRD 10.1 — every recipe run is versioned. */
export const RECIPE_VERSION = "1.0.0";

/**
 * Merchant's pre-existing Klaviyo flows (26B.11). Shape mirrors
 * DemoDataset["existingFlows"]. In Alpha the demo module persists this under
 * the Preference key "existing_flows"; loader.ts reads it from there.
 */
export interface ExistingFlowSnapshot {
  type: "recovery" | "winback" | "other";
  name: string;
  active: boolean;
  /** Lowercase emails — the 26B.12 identity join key. */
  memberCustomerEmails: string[];
}

/**
 * 26A.5 — how active-flow exclusions were derived. Anything other than
 * "flow_membership" lowers confidence and flags contamination risk.
 */
export type FlowMembershipSource =
  | "flow_membership"
  | "event_proxy"
  | "unavailable";

/** Everything a recipe needs, fetched once. No recipe performs I/O itself. */
export interface RecipeDataSnapshot {
  accountId: string;
  customers: Customer[];
  products: Product[];
  /**
   * Events relevant to the three recipes (checkout_started, purchase,
   * repeat_purchase, refund, unsubscribe), sorted ascending by
   * eventTimestamp then id for determinism.
   */
  events: Event[];
  /** 26B.11 — active flows whose covered population must be netted out. */
  existingFlows: ExistingFlowSnapshot[];
  flowMembershipSource: FlowMembershipSource;
  /** Customer ids already assigned to a holdout for the same action type (PRD 10.2 exclusions). */
  heldOutCustomerIdsByActionType: Partial<Record<ContractActionType, string[]>>;
  /** Customer ids manually excluded by the merchant. */
  manualExclusionCustomerIds: string[];
  /** Freshness of every source the recipes read (feeds ExplanationContract). */
  freshness: DataFreshness[];
}

/** Named exclusion tally — feeds RecipeResult.exclusionsApplied + audience exclusionRules. */
export interface ExclusionTally {
  reason: string;
  count: number;
}

/** Baseline availability for estimate + confidence logic (PRD 16.3). */
export type BaselineAvailability = "merchant_historical" | "modeled" | "none";
