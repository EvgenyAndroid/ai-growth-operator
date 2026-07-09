/**
 * lib/server — public surface of the server-action layer (the ONLY layer the
 * UI calls; see docs/CONTRACTS.md import direction rule).
 *
 * Server components may import anything here. Client components must NEVER
 * import this barrel — they import the narrow "use server" action modules
 * directly (lib/server/actions, lib/server/opportunities/actions,
 * lib/server/chat/actions, lib/server/export, lib/server/onboarding/actions);
 * enforced by scripts/check-client-boundary.mjs.
 *
 * Onboarding:   ensureDemoAccount (safe reuse/create — never resets),
 *               getOperatingRules, getConnectionStatus,
 *               saveOperatingRules, resyncConnection
 *               (resetDemoWorkspace / selectDemoVertical are deliberately NOT
 *               re-exported: import "@/lib/server/onboarding/actions")
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

import "server-only"; // build-time guard: must never enter a client bundle

export {
  ensureDemoAccount,
  getConnectionStatus,
  getOperatingRules,
} from "./onboarding/read";

export { resyncConnection, saveOperatingRules } from "./onboarding/actions";

export { getOpportunityDetail, listOpportunities } from "./opportunities/read";

export { dismissOpportunity } from "./opportunities/actions";

export {
  approveAction,
  draftAction,
  recordDraftEdit,
  rejectAction,
} from "./actions";

export { getPerformance, getPerformanceExamples } from "./performance/read";

export { getActionAudit, getLedger, getOpportunityAudit } from "./ledger/read";

export { exportState } from "./export";

export { operatorChat } from "./chat/actions";
export { routeChatIntent } from "./chat-router";

export type {
  ActionSummaryView,
  ActivationLadderStep,
  ApproveActionResult,
  ChatResponse,
  ConnectionStatusView,
  DemoAccountResult,
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
