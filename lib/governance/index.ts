/**
 * lib/governance — the governance runtime (PRD 12.5–12.7).
 *
 * Single chokepoint: lib/server must call checkAction() (and
 * assertGovernancePass) before ANY activation touches a connector.
 * There is no exported activation helper that bypasses it.
 */

export {
  checkAction,
  assertGovernancePass,
  GovernanceBlockedError,
  type CheckActionOptions,
  type GovernanceDecision,
} from "./check-action";

export {
  scanCopyForClaims,
  PRD_CLAIM_RULES,
  type ClaimFinding,
  type ClaimRule,
  type ScanClaimsOptions,
} from "./claims";

export {
  DEFAULT_FRESHNESS_THRESHOLDS_HOURS,
  evaluateFreshness,
  findStaleSources,
  freshnessBlockMessage,
  formatHours,
  hoursSince,
  type FreshnessEvaluation,
} from "./freshness";

export {
  checkDestinationCompatibility,
  type DestinationCompatibilityInput,
  type DestinationCompatibilityResult,
} from "./destination";
