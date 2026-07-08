/**
 * lib/ledger — Context Ledger (PRD 18) + learned preferences hook (26B.18).
 *
 * writeLedger conforms to LedgerWriteFn from lib/contracts and ALWAYS stamps
 * constitutionVersion. Query helpers back the audit screen (PRD 18.4).
 */

export { writeLedger, writeGovernanceDecision } from "./write";

export { writeFailureEvent, type FailureOperation } from "./failures";

export {
  listLedgerEntries,
  getLedgerEntry,
  getActionAuditTrail,
  getOpportunityAuditTrail,
  countLedgerEntriesByType,
  type ListLedgerEntriesParams,
  type LedgerPage,
} from "./queries";

export {
  recordRejectionPreference,
  recordEditPreference,
  classifyRejectionReason,
  getPreferences,
  getPreferenceValue,
  type RecordRejectionParams,
  type RecordRejectionResult,
  type RecordEditParams,
  type PreferenceSignalValue,
  type PreferenceSource,
} from "./preferences";
