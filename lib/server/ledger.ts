"use server";

/**
 * lib/server/ledger.ts — audit-screen reads over the Context Ledger (PRD 18.4).
 * Thin pass-throughs to lib/ledger query helpers, mapped to plain DTOs.
 */

import type { ContractLedgerEventType } from "../contracts";
import {
  countLedgerEntriesByType,
  getActionAuditTrail,
  getOpportunityAuditTrail,
  listLedgerEntries,
} from "../ledger";
import { assertAccountAccess } from "./account-context";
import { ledgerEntryToView } from "./shared";
import {
  getActionAuditSchema,
  getLedgerSchema,
  getOpportunityAuditSchema,
  parseInput,
} from "./validation";
import type { LedgerEntryView, LedgerPageView } from "./types";

/** Paginated, filterable ledger for the audit screen (PRD 18.4). */
export async function getLedger(params: {
  accountId: string;
  eventTypes?: ContractLedgerEventType[];
  actionId?: string;
  opportunityId?: string;
  userId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}): Promise<LedgerPageView> {
  params = parseInput(getLedgerSchema, params, "getLedger"); // P5
  await assertAccountAccess(params.accountId); // P4 — account boundary
  const page = await listLedgerEntries({
    accountId: params.accountId,
    eventTypes: params.eventTypes,
    actionId: params.actionId,
    opportunityId: params.opportunityId,
    userId: params.userId,
    from: params.from,
    to: params.to,
    cursor: params.cursor,
    limit: params.limit,
  });
  const counts = await countLedgerEntriesByType(params.accountId);
  const totalMatching = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    entries: page.entries.map(ledgerEntryToView),
    nextCursor: page.nextCursor ?? null,
    totalMatching,
  };
}

/** Full audit trail for one action (approval screen "history" panel). */
export async function getActionAudit(params: {
  accountId: string;
  actionId: string;
}): Promise<LedgerEntryView[]> {
  params = parseInput(getActionAuditSchema, params, "getActionAudit"); // P5
  await assertAccountAccess(params.accountId); // P4 — account boundary
  const rows = await getActionAuditTrail(params.accountId, params.actionId);
  return rows.map(ledgerEntryToView);
}

/** Full audit trail for one opportunity (detail screen). */
export async function getOpportunityAudit(params: {
  accountId: string;
  opportunityId: string;
}): Promise<LedgerEntryView[]> {
  params = parseInput(getOpportunityAuditSchema, params, "getOpportunityAudit"); // P5
  await assertAccountAccess(params.accountId); // P4 — account boundary
  const rows = await getOpportunityAuditTrail(
    params.accountId,
    params.opportunityId,
  );
  return rows.map(ledgerEntryToView);
}
