/**
 * lib/contracts/public.ts — the CLIENT-SAFE half of the shared contract
 * surface: enum-like constants, measurement/confidence/activation labels,
 * recipe ids + config shapes, explanation-contract and readout types, and
 * pure helpers (isFoundMoneyEligible).
 *
 * OWNED BY FOUNDATION. Module agents import from here; they do not edit it.
 * Import direction rule: ui -> lib/server -> modules (demo/recipes/governance/
 * ledger/measurement) -> contracts/db. Nothing imports "upward".
 *
 * HARD RULE: this file must have ZERO imports (in particular, nothing from
 * lib/generated/** or lib/db) so it can be bundled into Client Components.
 * Prisma model re-exports live in ./models (server-only).
 *
 * PRD v1.1 references are noted inline. Sections 26A/26B win over earlier text.
 */

// ---------------------------------------------------------------------------
// Enum-like constants (SQLite has no native enums; these unions are the law
// for the String columns in prisma/schema.prisma)
// ---------------------------------------------------------------------------

/**
 * PRD 4.6 — the ONLY three user-facing measurement labels.
 * Meta is ALWAYS "directional". Never present directional as lift.
 */
export const MEASUREMENT_LABELS = {
  holdout: "holdout-verified",
  before_after_no_control: "before-after-no-control",
  directional: "directional",
} as const;

/** DB value for Action.measurementMode / MeasurementWindow.mode / LedgerEntry.measurementMode */
export type MeasurementMode = keyof typeof MEASUREMENT_LABELS; // "holdout" | "before_after_no_control" | "directional"
/** User-facing label derived from MeasurementMode */
export type MeasurementLabel = (typeof MEASUREMENT_LABELS)[MeasurementMode];

export const MEASUREMENT_MODES = Object.keys(MEASUREMENT_LABELS) as MeasurementMode[];

/** Display copy for the three labels (PRD 4.6 / 26 DoD #13-14). */
export const MEASUREMENT_LABEL_COPY: Record<MeasurementMode, string> = {
  holdout: "Holdout-verified",
  before_after_no_control: "Before/after, no control group",
  directional: "Directional",
};

/** PRD 11 — confidence labels. Stored on Opportunity.confidence etc. */
export const CONFIDENCE = {
  high: "high",
  medium: "medium",
  low: "low",
} as const;
export type Confidence = keyof typeof CONFIDENCE;
export const CONFIDENCE_LEVELS = Object.keys(CONFIDENCE) as Confidence[];

/** PRD 9.5 / 10.2 — Klaviyo fallback ladder + Meta sync. */
export const ACTIVATION_LEVELS = {
  klaviyo_flow_draft: "Klaviyo flow draft",
  klaviyo_campaign_draft: "Klaviyo campaign draft",
  exportable_brief: "Exportable brief",
  manual_setup_instructions: "Manual setup instructions",
  meta_audience_sync: "Meta audience sync",
} as const;
export type ActivationLevel = keyof typeof ACTIVATION_LEVELS;

/**
 * 26A.1 — activation levels at which a holdout CANNOT be enforced in the
 * activation path; claims must downgrade to before_after_no_control.
 */
export const HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS: ActivationLevel[] = [
  "exportable_brief",
  "manual_setup_instructions",
];

/** PRD 9.6 — opportunity lifecycle. */
export const OPPORTUNITY_STATUSES = [
  "found",
  "sized",
  "proposed",
  "drafted",
  "approved",
  "launched",
  "measured",
  "learned",
  "dismissed",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** PRD 16.1 — estimate labels (Opportunity.estimateLabel). */
export const ESTIMATE_LABELS = [
  "merchant_historical",
  "modeled",
  "directional",
  "unavailable",
] as const;
export type EstimateLabel = (typeof ESTIMATE_LABELS)[number];

/** Vertical packs. Vertical selection routes recipes/copy/connectors (lib/verticals.ts). */
export const VERTICALS = ["shopify_dtc", "local_service"] as const;
export type Vertical = (typeof VERTICALS)[number];

/** The three DTC v0 recipes (PRD 1.7). */
export const DTC_RECIPE_IDS = [
  "abandoned_checkout_recovery",
  "lapsed_winback",
  "meta_seed_suppression",
] as const;
export type DtcRecipeId = (typeof DTC_RECIPE_IDS)[number];

/** LOCAL vertical pack recipes. The Meta seed recipe is SHARED with DTC. */
export const LOCAL_RECIPE_IDS = [
  "local_lapsed_regular",
  "catering_upsell",
  "meta_seed_suppression",
] as const;
export type LocalRecipeId = (typeof LOCAL_RECIPE_IDS)[number];

/**
 * Back-compat alias: the DTC v0 recipe list. Vertical-aware code must route
 * through the registry in lib/verticals.ts, never iterate this directly.
 */
export const RECIPE_IDS = DTC_RECIPE_IDS;
export type RecipeId = DtcRecipeId | LocalRecipeId;

export type ContractActionType =
  | "klaviyo_recovery_flow"
  | "klaviyo_winback_flow"
  | "meta_audience_sync";
export type ContractActionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "launched"
  | "rejected"
  | "rolled_back";
export type ContractApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";
export type ContractDraftStatus = "draft" | "edited" | "approved" | "activated";
export type ContractHoldoutStatus =
  | "planned"
  | "active"
  | "measured"
  | "cancelled";
export type ContractContaminationRisk = "none" | "low" | "flagged";
export type ContractSyncStatus = "running" | "succeeded" | "failed";
export type ContractOAuthStatus =
  | "disconnected"
  | "connected"
  | "error"
  | "mock"; // Alpha: mocked connectors (PRD 25.1)
export type ContractExportStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";
export type ContractSuppressionStatus = "none" | "suppressed";
export type ContractLifecycleStage =
  | "prospect"
  | "first_purchase"
  | "repeat"
  | "lapsing"
  | "lapsed"
  | "won_back";
export type ContractRepeatability =
  | "repeatable"
  | "replenishable"
  | "seasonal"
  | "one_time_gift"
  | "unknown";
export type ContractReadType = "early" | "primary" | "long"; // 26A.2
export type ContractEventType =
  | "checkout_started"
  | "purchase"
  | "repeat_purchase"
  | "refund"
  | "email_open"
  | "email_click"
  | "unsubscribe"
  | "audience_synced";
export type ContractDestinationStatus =
  | "not_synced"
  | "syncing"
  | "accepted"
  | "rejected";
export type ContractLedgerEventType =
  | "data_sync"
  | "opportunity_found"
  | "opportunity_sized"
  | "opportunity_drafted"
  | "user_edit"
  | "approval"
  | "rejection"
  | "dismissal"
  | "activation_attempt"
  | "activation_success"
  | "activation_failure"
  | "holdout_assignment"
  | "measurement_readback"
  | "performance_summary"
  | "rules_edit"
  | "export"
  | "chat_interaction";

export type IntegrationSource =
  | "shopify"
  | "klaviyo"
  | "meta"
  | "ga4"
  | "stripe"
  // LOCAL vertical pack (demo-mode): Square-like POS, Mailchimp-like email,
  // Google Business Profile. POS orders reuse Event/purchase with source "square".
  | "square"
  | "mailchimp"
  | "gbp";

// ---------------------------------------------------------------------------
// Explanation contract — PRD 4.4: no recommendation renders without ALL of this
// ---------------------------------------------------------------------------

export interface DataFreshness {
  source: IntegrationSource | "demo";
  lastSyncAt: string; // ISO timestamp
  thresholdHours: number;
  isStale: boolean;
}

export interface MeasurementPlan {
  mode: MeasurementMode;
  label: MeasurementLabel;
  /** Plain-English plan, e.g. "10% randomized customer-level holdout; primary read at 7 days." */
  summary: string;
  holdout?: HoldoutPlan;
  /** 26A.2 — every performance summary must state its windows. */
  windows: Array<{
    readType: ContractReadType;
    days: number;
  }>;
  /** e.g. "Cross-flow holdout interaction possible" (26B.14), contamination notes (26A.5). */
  caveats: string[];
}

/** PRD 4.4 / 17.3 — the required output schema for every recommendation. */
export interface ExplanationContract {
  found: string; // what the Operator found
  whyItMatters: string;
  dataUsed: string[]; // named sources/fields
  dataFreshness: DataFreshness[];
  assumptions: string[]; // modeled rates must appear here, labeled (26A.6)
  risk: string;
  approvalNeeded: string; // what approval gates apply (26A.4: draft is not activation)
  measurementPlan: MeasurementPlan;
}

// ---------------------------------------------------------------------------
// Estimates — PRD 16: always ranges, never single points
// ---------------------------------------------------------------------------

export interface EstimateRange {
  low: number;
  high: number;
  label: EstimateLabel;
}

/**
 * LOCAL vertical POS coverage disclosure (trust rule #9): local estimates
 * cover identified (loyalty-matched) customers ONLY. Every local card and
 * readout must render this share + note. Absent for DTC results.
 */
export interface IdentifiedCoverage {
  /** Share (0..1) of POS transactions matched to an identified customer. */
  identifiedShare: number;
  /** Plain-English disclosure rendered verbatim on cards/readouts. */
  note: string;
}

/**
 * PRD 16.2 — found-money header may ONLY sum recovery + win-back opportunities
 * with Medium or High confidence. Never Meta/directional/low/beta.
 */
export function isFoundMoneyEligible(input: {
  recipeId: RecipeId;
  confidence: Confidence;
  estimateLabel: EstimateLabel;
}): boolean {
  return (
    (input.recipeId === "abandoned_checkout_recovery" ||
      input.recipeId === "lapsed_winback" ||
      // LOCAL pack: lapsed-regular win-back is the local recovery/win-back
      // analogue. catering_upsell and Meta are NEVER found-money eligible.
      input.recipeId === "local_lapsed_regular") &&
    (input.confidence === "high" || input.confidence === "medium") &&
    input.estimateLabel !== "directional" &&
    input.estimateLabel !== "unavailable"
  );
}

// ---------------------------------------------------------------------------
// Recipes — PRD 10 + 26A/26B
// ---------------------------------------------------------------------------

/** Per-recipe configurable parameters with sane defaults (PRD 10.1, 26A.6). */
export interface RecipeConfigShape {
  abandoned_checkout_recovery: {
    abandonmentHours: number; // default 4
    maxCheckoutAgeDays: number; // default 14
    conservativeRecoveryRate: number; // modeled default, editable (26A.6)
    holdoutPercent: number; // default 10
    minHoldoutAudience: number; // default 500
  };
  lapsed_winback: {
    cadenceMultiplier: number; // default 1.5 (gap > 1.5x personal median)
    minPurchasesForPersonalCadence: number; // default 3
    minIntervalsForPersonalCadence: number; // default 2
    conservativeWinbackRate: number; // modeled default, editable
    holdoutPercent: number; // default 10
    minHoldoutAudience: number; // default 500
  };
  meta_seed_suppression: {
    seedPercentile: number; // default 15 (top 15% by refund-adjusted value)
    recentPurchaserWindowDays: number; // default 30 (suppression)
  };
  // LOCAL vertical pack (identified/loyalty-matched customers only)
  local_lapsed_regular: {
    cadenceMultiplier: number; // default 1.5 (gap > 1.5x personal median visit cadence)
    minVisitsForPersonalCadence: number; // default 3
    minIntervalsForPersonalCadence: number; // default 2
    conservativeReturnRate: number; // modeled default, editable (26A.6)
    holdoutPercent: number; // default 10
    minHoldoutAudience: number; // default 500 — local audiences run smaller, so before/after applies
  };
  catering_upsell: {
    largeOrderThreshold: number; // default 60 (POS order value suggesting catering-scale)
    minLargeOrders: number; // default 2
    lookbackDays: number; // default 90
    conservativeUpsellRate: number; // modeled default, editable
    holdoutPercent: number; // default 10
    minHoldoutAudience: number; // default 500
  };
}

/** LOCAL pack defaults. minHoldoutAudience stays 500 (shared law); local demo
 *  audiences are engineered SMALLER than 500 so the before/after path exercises. */
export const LOCAL_RECIPE_CONFIG_DEFAULTS: Pick<
  RecipeConfigShape,
  "local_lapsed_regular" | "catering_upsell"
> = {
  local_lapsed_regular: {
    cadenceMultiplier: 1.5,
    minVisitsForPersonalCadence: 3,
    minIntervalsForPersonalCadence: 2,
    conservativeReturnRate: 0.04,
    holdoutPercent: 10,
    minHoldoutAudience: 500,
  },
  catering_upsell: {
    largeOrderThreshold: 60,
    minLargeOrders: 2,
    lookbackDays: 90,
    conservativeUpsellRate: 0.05,
    holdoutPercent: 10,
    minHoldoutAudience: 500,
  },
};

export const RECIPE_CONFIG_DEFAULTS: RecipeConfigShape = {
  abandoned_checkout_recovery: {
    abandonmentHours: 4,
    maxCheckoutAgeDays: 14,
    conservativeRecoveryRate: 0.03,
    holdoutPercent: 10,
    minHoldoutAudience: 500,
  },
  lapsed_winback: {
    cadenceMultiplier: 1.5,
    minPurchasesForPersonalCadence: 3,
    minIntervalsForPersonalCadence: 2,
    conservativeWinbackRate: 0.02,
    holdoutPercent: 10,
    minHoldoutAudience: 500,
  },
  meta_seed_suppression: {
    seedPercentile: 15,
    recentPurchaserWindowDays: 30,
  },
  ...LOCAL_RECIPE_CONFIG_DEFAULTS,
};

export interface RecipeInput<R extends RecipeId = RecipeId> {
  accountId: string;
  recipeId: R;
  config: RecipeConfigShape[R];
  /** Data-as-of timestamp the recipe ran against (ISO). */
  dataAsOf: string;
  /** Active constitution version the run is governed by. */
  constitutionVersion: number;
}

export interface AudienceSpec {
  name: string;
  inclusionRules: Record<string, unknown>;
  exclusionRules: Record<string, unknown>;
  size: number;
  eligibleChannels: string[];
  /** Customer ids included after consent/suppression/exclusion filtering. */
  customerIds: string[];
}

/** Everything a recipe run must produce (PRD 10.1). Deterministic — same input, same output. */
export interface RecipeResult<R extends RecipeId = RecipeId> {
  recipeId: R;
  recipeVersion: string;
  title: string;
  category: "recovery" | "winback" | "paid_audience" | "upsell";
  sourceSignal: string;
  audience: AudienceSpec;
  /** For meta_seed_suppression: the suppression audience. */
  suppressionAudience?: AudienceSpec;
  exclusionsApplied: string[];
  /** null when no defensible dollar estimate exists (Recipe 3 always null — PRD 10.4). */
  estimate: EstimateRange | null;
  confidence: Confidence;
  confidenceInputs: Record<string, string>; // inspectable (PRD 11.4)
  recommendedAction: ContractActionType;
  activationLevel: ActivationLevel;
  measurementPlan: MeasurementPlan;
  explanation: ExplanationContract;
  dataAsOf: string;
  dedupKey: string; // `${accountId}:${recipeId}` (26B.16)
  /**
   * REQUIRED for LOCAL vertical recipes (POS coverage disclosure — trust rule
   * #9); absent for DTC recipes. Optional at the type level only because DTC
   * results never carry it.
   */
  coverage?: IdentifiedCoverage;
  /** 26A.10 — populated when the recipe finds nothing, explaining what was checked. */
  noOpportunity?: {
    checked: Array<{ what: string; count: number }>;
    whyNotQualified: string;
    nearestNextAction: string;
    unlocks: string;
  };
}

// ---------------------------------------------------------------------------
// Governance — PRD 4.3 / 12: runtime, not advice. No code path around it.
// ---------------------------------------------------------------------------

export type GovernanceGate =
  | "consent"
  | "suppression"
  | "budget_limit"
  | "discount_limit"
  | "margin_rule"
  | "approval_gate"
  | "banned_claims"
  | "freshness";

export interface GovernanceCheckInput {
  accountId: string;
  constitutionVersion: number;
  actionType: ContractActionType;
  channel: "klaviyo" | "meta";
  activationLevel: ActivationLevel;
  audienceCustomerIds: string[];
  /** Copy to scan for banned/unsupported claims. */
  copyText: string[];
  discountPercent?: number;
  estimatedSpend?: number;
  /** Freshness of every source the action depends on. */
  sourceFreshness: DataFreshness[];
  /** Approval record id if an approval exists. Activation without one must block (26A.4). */
  approvalId?: string;
}

export interface GovernanceCheckResult {
  verdict: "pass" | "block";
  /** Every gate evaluated, with outcome — inspectable and ledger-loggable. */
  gates: Array<{
    gate: GovernanceGate;
    outcome: "pass" | "block" | "not_applicable";
    reason?: string;
  }>;
  /** Human-readable block reasons (empty when verdict === "pass"). */
  reasons: string[];
  /** e.g. suggested safer copy for flagged claims. */
  remediations: string[];
}

// ---------------------------------------------------------------------------
// Ledger — PRD 18: every decision reconstructable
// ---------------------------------------------------------------------------

export interface LedgerWrite {
  accountId: string;
  eventType: ContractLedgerEventType;
  userId?: string;
  actionId?: string;
  opportunityId?: string;
  skillInvoked?: string;
  constitutionVersion?: number;
  sourceDataUsed?: Record<string, unknown>;
  sourceFreshness?: DataFreshness[];
  reasoningSummary?: string;
  confidence?: Confidence;
  approvalStatus?: ContractApprovalStatus;
  destination?: string;
  activationLevel?: ActivationLevel;
  actionTaken?: string;
  rollbackPath?: string;
  measuredOutcome?: Record<string, unknown>;
  measurementMode?: MeasurementMode;
}

/** Signature every module uses to write ledger entries (implemented in lib/ledger). */
export type LedgerWriteFn = (entry: LedgerWrite) => Promise<{ ledgerId: string }>;

// ---------------------------------------------------------------------------
// Measurement — PRD 14-16, 26A.1, 26A.2
// ---------------------------------------------------------------------------

export interface HoldoutPlan {
  eligibleAudienceSize: number;
  holdoutPercent: number; // default 10
  holdoutSize: number;
  assignmentMethod: "randomized_customer_level";
  exclusionWindow: string; // ISO-8601 duration
  /** True only when audience >= 500 AND activation level can enforce exclusion (26A.1). */
  enforceable: boolean;
  /**
   * Minimum detectable effect at plan time: the smallest absolute purchase-rate
   * lift (in rate points, e.g. 0.021 = 2.1pp) this holdout can detect at the
   * stated power/alpha given its arm sizes and an assumed baseline rate.
   * Smaller true effects will typically read as "lift not proven" — surfaced
   * so an underpowered holdout announces itself BEFORE launch.
   */
  mde?: {
    absoluteRatePoints: number;
    power: number; // e.g. 0.8
    alpha: number; // e.g. 0.05 two-sided
    assumedBaselineRate: number;
    note: string; // plain-English, e.g. "Can detect ≥2.1pp absolute lift at 80% power…"
  };
}

export interface MeasurementReadout {
  actionId: string;
  mode: MeasurementMode;
  label: MeasurementLabel;
  window: { start: string; end: string; readType: ContractReadType };
  /** Lift range — ONLY present when mode === "holdout". Never for Meta. */
  lift?: { low: number; high: number };
  /** Directional / before-after metrics (audience size, match rate, purchases, etc.). */
  metrics: Record<string, number | string>;
  confidence: Confidence;
  contaminationRisk: ContractContaminationRisk;
  caveats: string[]; // cross-flow interactions (26B.14), no-control tag, etc.
  /** Plain-English summary: what happened, why, next action (PRD 26 DoD #20-21). */
  summary: string;
}

// ---------------------------------------------------------------------------
// Demo dataset — PRD 25.1 Alpha: demo data must exercise all three recipes
// and all three measurement labels
// ---------------------------------------------------------------------------

export interface DemoDataset {
  account: { name: string; vertical: Vertical };
  constitution: {
    monthlyBudgetCap: number;
    maxDiscountPercent: number;
    dailySendCap: number;
    bannedClaims: string[];
    toneGuide: string;
  };
  integrations: Array<{
    source: IntegrationSource;
    mode: "mock";
    lastSyncAt: string;
    freshnessThresholdHours: number;
  }>;
  customers: Array<{
    emailLower: string;
    consentEmail: boolean;
    consentAds: boolean;
    lifecycleStage: ContractLifecycleStage;
    firstPurchaseDate?: string;
    lastPurchaseDate?: string;
    totalOrders: number;
    totalRevenue: number;
    refundRate?: number;
    suppressionStatus: ContractSuppressionStatus;
    purchaseIntervalDays?: number[];
    shopifyId: string;
    klaviyoId?: string;
  }>;
  products: Array<{
    sourceProductId: string;
    name: string;
    category: string;
    price: number;
    repeatPurchaseFlag: boolean;
    replenishmentWindowDays?: number;
    seasonalFlag: boolean;
    repeatability: ContractRepeatability;
  }>;
  events: Array<{
    customerEmailLower: string;
    eventType: ContractEventType;
    eventTimestamp: string;
    source: "demo";
    sourceProductId?: string;
    value?: number;
  }>;
  /** Merchant's pre-existing Klaviyo flows — estimates must be net of these (26B.11). */
  existingFlows: Array<{
    type: "recovery" | "winback" | "other";
    name: string;
    active: boolean;
    memberCustomerEmails: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Operator Chat — 26A.3: deterministic intent router, NO LLM in Alpha
// ---------------------------------------------------------------------------

export type ChatIntent =
  | "weekly_plan"
  | "recover_abandoned_carts"
  | "build_winback"
  | "build_meta_lookalike"
  | "explain_holdout"
  | "no_discount_options"
  | "draft_without_launch"
  | "explain_confidence"
  | "explain_meta_no_lift"
  | "unsupported";

/** 26A.3 — the exact response for anything outside v0 scope. */
export const CHAT_UNSUPPORTED_RESPONSE =
  "That is not available in v0. I can help with abandoned checkout recovery, lapsed customer win-back, Meta audience seed/suppression, or performance explanation.";

// ---------------------------------------------------------------------------
// Measurement windows — 26A.2 defaults (days)
// ---------------------------------------------------------------------------

export const DEFAULT_MEASUREMENT_WINDOWS: Record<
  RecipeId,
  Array<{ readType: ContractReadType; days: number }>
> = {
  abandoned_checkout_recovery: [
    { readType: "early", days: 3 },
    { readType: "primary", days: 7 },
    { readType: "long", days: 14 },
  ],
  lapsed_winback: [
    { readType: "early", days: 7 },
    { readType: "primary", days: 21 },
    { readType: "long", days: 30 },
  ],
  meta_seed_suppression: [
    { readType: "early", days: 7 },
    { readType: "primary", days: 14 },
    { readType: "long", days: 30 },
  ],
  local_lapsed_regular: [
    { readType: "early", days: 7 },
    { readType: "primary", days: 21 },
    { readType: "long", days: 30 },
  ],
  catering_upsell: [
    { readType: "early", days: 7 },
    { readType: "primary", days: 14 },
    { readType: "long", days: 30 },
  ],
};

/** PRD 10.4 — words that must NEVER appear in Meta measurement copy. */
export const META_DISALLOWED_TERMS = [
  "lift",
  "incrementality",
  "recovered revenue",
  "causal ROAS",
  "holdout-verified",
] as const;

/** PRD 27 — unsupported-claim flags for copy checks (governance banned_claims gate). */
export const DEFAULT_BANNED_CLAIMS = [
  "clinically proven",
  "cures",
  "treats",
  "guaranteed",
  "FDA-approved",
  "medical-grade",
  "safe for all skin types",
  "best",
  "#1",
] as const;
