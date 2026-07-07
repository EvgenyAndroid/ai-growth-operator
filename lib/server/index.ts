/**
 * lib/server — public surface of the server-action layer (the ONLY layer the
 * UI calls; see docs/CONTRACTS.md import direction rule).
 *
 * Onboarding:   createDemoAccount, saveOperatingRules, getOperatingRules,
 *               getConnectionStatus, resyncConnection
 * Feed:         listOpportunities, getOpportunityDetail, dismissOpportunity
 * Actions:      draftAction, approveAction, rejectAction, recordDraftEdit
 * Performance:  getPerformance, getPerformanceExamples
 * Ledger:       getLedger, getActionAudit, getOpportunityAudit
 * Export:       exportState
 * Chat:         operatorChat (deterministic 26A.3 router — no LLM)
 *
 * Governance invariant: activation happens ONLY inside approveAction, which
 * routes through lib/governance checkAction + lib/ledger. Nothing else in
 * this directory touches a (mock) connector.
 */

export {
  createDemoAccount,
  getConnectionStatus,
  getOperatingRules,
  resyncConnection,
  saveOperatingRules,
} from "./onboarding";

export {
  dismissOpportunity,
  getOpportunityDetail,
  listOpportunities,
} from "./opportunities";

export {
  approveAction,
  draftAction,
  recordDraftEdit,
  rejectAction,
} from "./actions";

export { getPerformance, getPerformanceExamples } from "./performance";

export { getActionAudit, getLedger, getOpportunityAudit } from "./ledger";

export { exportState } from "./export";

export { operatorChat } from "./chat";
export { routeChatIntent } from "./chat-router";

export type {
  ActionSummaryView,
  ActivationLadderStep,
  ApproveActionResult,
  ChatResponse,
  ConnectionStatusView,
  CreateDemoAccountResult,
  DismissOpportunityResult,
  DraftActionResult,
  DraftCopyStep,
  DraftView,
  ExportFormat,
  ExportObjectType,
  ExportStateResult,
  FeedView,
  GovernanceDecisionView,
  GovernanceGateView,
  LedgerEntryView,
  LedgerPageView,
  NoOpportunityView,
  OperatingRulesView,
  OpportunityCardView,
  OpportunityDetailView,
  PerformanceView,
  RejectActionResult,
  SaveOperatingRulesInput,
} from "./types";
