/**
 * lib/ledger/failures.ts — failure-path ledger entries (hardening P13).
 *
 * Central helper so failed operations (activations, exports) always leave an
 * audit trail. writeLedger stamps constitutionVersion automatically when the
 * caller does not know it (PRD 18.3 — never write without one).
 *
 * IMPORTANT: `reason` is rendered in the audit UI. Callers MUST pass it
 * through lib/server/errors.toUserMessage() (or otherwise guarantee it is
 * user-safe) — never a raw error message, stack trace, or internal detail.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { writeLedger } from "./write";

export type FailureOperation = "activation" | "export";

/**
 * Append a failure entry for an operation that started but did not complete.
 * Activations use the dedicated "activation_failure" event type; export
 * failures reuse the "export" event type with a failed actionTaken so audit
 * queries by event type keep returning every export attempt.
 */
export async function writeFailureEvent(params: {
  accountId: string;
  operation: FailureOperation;
  /** User-safe summary of why the operation failed (see module doc). */
  reason: string;
  userId?: string;
  actionId?: string;
  opportunityId?: string;
  /** Omit to have writeLedger resolve the account's latest version. */
  constitutionVersion?: number;
  sourceDataUsed?: Record<string, unknown>;
}): Promise<{ ledgerId: string }> {
  const isActivation = params.operation === "activation";
  return writeLedger({
    accountId: params.accountId,
    eventType: isActivation ? "activation_failure" : "export",
    userId: params.userId,
    actionId: params.actionId,
    opportunityId: params.opportunityId,
    constitutionVersion: params.constitutionVersion,
    sourceDataUsed: params.sourceDataUsed,
    reasoningSummary: `${params.operation} failed: ${params.reason}`,
    actionTaken: isActivation ? "activation failed" : "export failed",
  });
}
