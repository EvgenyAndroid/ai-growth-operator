/**
 * lib/ledger/queries.ts — read helpers for the audit screen (PRD 18.4:
 * "User can inspect audit history"). Cursor-paginated feed, per-object audit
 * trails, and event-type counts for filter chips.
 */

import { db } from "../db";
import type { ContractLedgerEventType, LedgerEntry } from "../contracts";

export interface ListLedgerEntriesParams {
  accountId: string;
  /** Filter to specific event types (audit-screen filter chips). */
  eventTypes?: ContractLedgerEventType[];
  actionId?: string;
  opportunityId?: string;
  userId?: string;
  /** ISO timestamps (inclusive from, exclusive to). */
  from?: string;
  to?: string;
  /** Page size; defaults to 50, capped at 200. */
  limit?: number;
  /** Cursor = id of the last entry from the previous page. */
  cursor?: string;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  /** Pass back as `cursor` to fetch the next page; undefined when exhausted. */
  nextCursor?: string;
}

/** Newest-first paginated ledger feed for the audit screen. */
export async function listLedgerEntries(params: ListLedgerEntriesParams): Promise<LedgerPage> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

  const entries = await db.ledgerEntry.findMany({
    where: {
      accountId: params.accountId,
      ...(params.eventTypes && params.eventTypes.length > 0
        ? { eventType: { in: params.eventTypes } }
        : {}),
      ...(params.actionId ? { actionId: params.actionId } : {}),
      ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.from || params.to
        ? {
            timestamp: {
              ...(params.from ? { gte: new Date(params.from) } : {}),
              ...(params.to ? { lt: new Date(params.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  return {
    entries: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
  };
}

/** Single entry, account-scoped (never leaks across accounts). */
export async function getLedgerEntry(
  accountId: string,
  ledgerId: string,
): Promise<LedgerEntry | null> {
  return db.ledgerEntry.findFirst({ where: { id: ledgerId, accountId } });
}

/**
 * Full chronological audit trail for one action — every decision from draft
 * to measurement, reconstructable (PRD 18.1).
 */
export async function getActionAuditTrail(
  accountId: string,
  actionId: string,
): Promise<LedgerEntry[]> {
  return db.ledgerEntry.findMany({
    where: { accountId, actionId },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
  });
}

/** Full chronological audit trail for one opportunity. */
export async function getOpportunityAuditTrail(
  accountId: string,
  opportunityId: string,
): Promise<LedgerEntry[]> {
  return db.ledgerEntry.findMany({
    where: { accountId, opportunityId },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
  });
}

/** Event-type counts for audit-screen filter chips. */
export async function countLedgerEntriesByType(
  accountId: string,
): Promise<Record<string, number>> {
  const groups = await db.ledgerEntry.groupBy({
    by: ["eventType"],
    where: { accountId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const group of groups) {
    counts[group.eventType] = group._count._all;
  }
  return counts;
}
