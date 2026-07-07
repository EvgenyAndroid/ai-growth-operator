/**
 * lib/server/types.ts — DTO surface between the UI and the server-action layer.
 *
 * These are the ONLY shapes app/ components consume. Everything is plain-JSON
 * serializable (dates are ISO strings) so the types work identically for
 * server components, client components calling server actions, and route
 * handlers. No Prisma model leaks upward except via re-exported contracts.
 */

import type {
  ActivationLevel,
  ChatIntent,
  Confidence,
  ContractActionStatus,
  ContractApprovalStatus,
  ContractContaminationRisk,
  ContractLedgerEventType,
  ContractReadType,
  EstimateLabel,
  EstimateRange,
  ExplanationContract,
  IntegrationSource,
  MeasurementLabel,
  MeasurementMode,
  MeasurementReadout,
  OpportunityStatus,
  RecipeId,
} from "../contracts";
import type { FoundMoneyHeader } from "../recipes";

// ---------------------------------------------------------------------------
// Onboarding / account
// ---------------------------------------------------------------------------

export interface CreateDemoAccountResult {
  accountId: string;
  accountName: string;
  demoMode: true; // PRD 20.3 — demo must be clearly labeled
  /** True when the demo dataset was (re)seeded in this call. */
  seeded: boolean;
  referenceDate: string;
  counts: {
    customers: number;
    products: number;
    events: number;
    integrations: number;
  };
}

export interface SaveOperatingRulesInput {
  accountId: string;
  /** PRD 12.3 — the three required numbers. */
  monthlyBudgetCap: number;
  maxDiscountPercent: number;
  dailySendCap: number;
  userId?: string;
}

export interface OperatingRulesView {
  version: number;
  templateVertical: string;
  monthlyBudgetCap: number;
  maxDiscountPercent: number;
  marginFloorPercent: number | null;
  dailySendCap: number;
  toneGuide: string | null;
  bannedClaims: string[];
  effectiveFrom: string;
}

export interface ConnectionStatusView {
  source: IntegrationSource;
  mode: string; // "mock" in Alpha (PRD 25.1)
  oauthStatus: string;
  lastSyncAt: string | null;
  freshnessThresholdHours: number;
  isStale: boolean;
  hoursSinceSync: number | null;
  lastSyncStatus: string | null;
  lastSyncRecordsRead: number | null;
}

// ---------------------------------------------------------------------------
// Opportunity feed / detail
// ---------------------------------------------------------------------------

export interface OpportunityCardView {
  id: string;
  recipeId: RecipeId;
  recipeVersion: string;
  title: string;
  category: string;
  status: OpportunityStatus;
  confidence: Confidence;
  /** Always a range or null — never a point estimate (PRD 16.4). */
  estimate: EstimateRange | null;
  estimateLabel: EstimateLabel;
  dataAsOf: string;
  recommendedAction: string | null;
  /** PRD 4.4 — a card without a full contract must not render. */
  explanation: ExplanationContract;
  measurementMode: MeasurementMode;
  measurementLabel: MeasurementLabel;
  measurementLabelCopy: string;
  dismissedReason: string | null;
  cooldownUntil: string | null;
  updatedAt: string;
}

/** 26A.10 — what was checked when a recipe found nothing. */
export interface NoOpportunityView {
  recipeId: RecipeId;
  checked: Array<{ what: string; count: number }>;
  whyNotQualified: string;
  nearestNextAction: string;
  unlocks: string;
}

export interface FeedView {
  accountId: string;
  demoMode: boolean;
  generatedAt: string;
  /** PRD 16.2 — gated by isFoundMoneyEligible(); render only when show=true. */
  foundMoney: FoundMoneyHeader;
  /** Ranked, active (non-dismissed) cards. */
  opportunities: OpportunityCardView[];
  /** Dismissed cards still inside their cooldown window. */
  dismissed: OpportunityCardView[];
  noOpportunity: NoOpportunityView[];
}

export interface OpportunityDetailView {
  card: OpportunityCardView;
  /** Fresh recipe-run detail (deterministic re-run at read time). */
  audience: {
    name: string;
    size: number;
    eligibleChannels: string[];
  } | null;
  suppressionAudience: {
    name: string;
    size: number;
  } | null;
  exclusionsApplied: string[];
  confidenceInputs: Record<string, string>;
  drafts: DraftView[];
  actions: ActionSummaryView[];
  auditTrail: LedgerEntryView[];
}

// ---------------------------------------------------------------------------
// Draft / action / approval
// ---------------------------------------------------------------------------

/** Parameterized template copy — NO LLM in Alpha (PRD 25.1, CONTRACTS rule 8). */
export interface DraftCopyStep {
  step: number;
  channel: "email" | "meta_audience";
  subject?: string;
  previewText?: string;
  body: string;
  /** Present only on offer steps; always <= Operating Rules discount ceiling. */
  offerPercent?: number;
  sendDelayHours?: number;
}

export interface DraftView {
  draftId: string;
  actionId: string | null;
  opportunityId: string | null;
  copy: DraftCopyStep[];
  activationTarget: ActivationLevel;
  currentVersion: number;
  status: string;
  createdAt: string;
}

export interface ActionSummaryView {
  actionId: string;
  type: string;
  channel: string;
  status: ContractActionStatus;
  activationLevel: ActivationLevel | null;
  measurementMode: MeasurementMode;
  measurementLabelCopy: string;
  launchedAt: string | null;
  constitutionVersion: number;
  approvalStatus: ContractApprovalStatus | null;
  holdoutId: string | null;
  audienceSize: number | null;
}

export interface DraftActionResult {
  actionId: string;
  draftId: string;
  approvalId: string;
  opportunityId: string;
  copy: DraftCopyStep[];
  activationLevel: ActivationLevel;
  /** 26A.4 — creating a draft is NOT activation. */
  approvalNeeded: string;
  explanation: ExplanationContract;
  measurementMode: MeasurementMode;
  measurementLabelCopy: string;
}

/** One rung of the simulated Klaviyo/Meta activation ladder (PRD 13, 26B.17). */
export interface ActivationLadderStep {
  level: ActivationLevel;
  levelCopy: string;
  outcome: "unavailable" | "succeeded_simulated" | "skipped";
  detail: string;
}

export interface GovernanceGateView {
  gate: string;
  outcome: "pass" | "block" | "not_applicable";
  reason?: string;
}

export interface GovernanceDecisionView {
  verdict: "pass" | "block";
  gates: GovernanceGateView[];
  reasons: string[];
  remediations: string[];
  claimFindings: Array<{
    claim: string;
    why: string;
    saferAlternative: string;
    overrideable: boolean;
  }>;
  constitutionVersion: number;
  checkedAt: string;
  destinationCompatibilitySummary: string;
}

export interface ApproveActionResult {
  activated: boolean;
  actionId: string;
  actionStatus: ContractActionStatus;
  governance: GovernanceDecisionView;
  /** Present only when activated. */
  activation?: {
    level: ActivationLevel;
    levelCopy: string;
    simulated: true; // PRD 25.1 Alpha
    ladder: ActivationLadderStep[];
  };
  measurement?: {
    mode: MeasurementMode;
    label: MeasurementLabel;
    labelCopy: string;
    /** 26A.1 — true when a holdout claim was downgraded by activation level. */
    downgradedByActivationLevel: boolean;
    reasons: string[];
    holdout: {
      holdoutId: string;
      eligibleAudienceSize: number;
      holdoutPercent: number;
      holdoutSize: number;
      exclusionWindow: string;
    } | null;
    contamination: {
      risk: ContractContaminationRisk;
      disclosure: string | null;
      caveats: string[];
    } | null;
    windows: Array<{ readType: ContractReadType; days: number; start: string; end: string }>;
  };
}

export interface RejectActionResult {
  actionId: string;
  actionStatus: ContractActionStatus;
  /** 26B.18 — preference keys learned from the rejection reason. */
  preferenceKeys: string[];
  ledgerId: string;
}

export interface DismissOpportunityResult {
  opportunityId: string;
  status: "dismissed";
  cooldownUntil: string;
  preferenceKeys: string[];
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export interface PerformanceView {
  actionId: string;
  actionType: string;
  recipeId: RecipeId;
  launchedAt: string | null;
  readout: MeasurementReadout;
  /** All 26A.2 windows for the action, with the one used marked. */
  windows: Array<{
    readType: ContractReadType;
    start: string;
    end: string;
    mode: MeasurementMode;
    used: boolean;
    /** True when the window end is still in the future. */
    inProgress: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface LedgerEntryView {
  id: string;
  timestamp: string;
  eventType: ContractLedgerEventType;
  userId: string | null;
  actionId: string | null;
  opportunityId: string | null;
  skillInvoked: string | null;
  constitutionVersion: number | null;
  reasoningSummary: string | null;
  confidence: string | null;
  approvalStatus: string | null;
  destination: string | null;
  activationLevel: string | null;
  actionTaken: string | null;
  measurementMode: string | null;
}

export interface LedgerPageView {
  entries: LedgerEntryView[];
  nextCursor: string | null;
  totalMatching: number;
}

// ---------------------------------------------------------------------------
// Export (PRD 19)
// ---------------------------------------------------------------------------

export type ExportObjectType =
  | "customers"
  | "audiences"
  | "operating_rules"
  | "preferences"
  | "opportunities"
  | "actions"
  | "measurements";

export type ExportFormat = "csv" | "json";

export interface ExportStateResult {
  jobId: string;
  objectType: ExportObjectType;
  format: ExportFormat;
  status: "completed";
  fileName: string;
  /** Absolute path of the file written under exports/. */
  filePath: string;
  /** The serialized payload, returned directly as a download body. */
  content: string;
  contentType: string;
  exportedAt: string;
  accountId: string;
  constitutionVersion: number;
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Operator Chat (26A.3 — deterministic intent router, no LLM)
// ---------------------------------------------------------------------------

export interface ChatResponse {
  intent: ChatIntent;
  message: string;
  /** Present on every action-recommending answer (PRD 17.3). */
  explanation?: ExplanationContract;
  opportunities?: OpportunityCardView[];
  readout?: MeasurementReadout;
  draftedAction?: { actionId: string; draftId: string };
  ledgerId: string;
}
