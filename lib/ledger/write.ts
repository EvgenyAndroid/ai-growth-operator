/**
 * lib/ledger/write.ts — Context Ledger writer (PRD 18).
 *
 * writeLedger() is the ONLY way modules append to the ledger. It captures the
 * PRD 18.3 fields and ALWAYS stamps constitutionVersion: when the caller does
 * not supply one, the account's latest Operating Rules version is resolved and
 * stamped (0 when the account has no Operating Rules yet, e.g. pre-onboarding
 * data syncs — still recorded, never dropped).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { db } from "../db";
import type { Prisma } from "../contracts/models";
import type { GovernanceCheckResult, LedgerWrite, LedgerWriteFn } from "../contracts";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  // Round-trip guarantees the stored value is plain JSON (strips class
  // instances/functions deterministically).
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Resolve the version to stamp when the caller did not provide one. */
async function resolveConstitutionVersion(accountId: string): Promise<number> {
  const latest = await db.constitution.findFirst({
    where: { accountId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return latest?.version ?? 0;
}

/**
 * Append a ledger entry (PRD 18.3). Conforms to LedgerWriteFn.
 * Never throws away fields; never writes without a constitutionVersion.
 */
export const writeLedger: LedgerWriteFn = async (entry: LedgerWrite) => {
  const constitutionVersion =
    entry.constitutionVersion ?? (await resolveConstitutionVersion(entry.accountId));

  const row = await db.ledgerEntry.create({
    data: {
      accountId: entry.accountId,
      eventType: entry.eventType,
      userId: entry.userId,
      actionId: entry.actionId,
      opportunityId: entry.opportunityId,
      skillInvoked: entry.skillInvoked,
      constitutionVersion,
      sourceDataUsed: toJson(entry.sourceDataUsed),
      sourceFreshness: toJson(entry.sourceFreshness),
      reasoningSummary: entry.reasoningSummary,
      confidence: entry.confidence,
      approvalStatus: entry.approvalStatus,
      destination: entry.destination,
      activationLevel: entry.activationLevel,
      actionTaken: entry.actionTaken,
      rollbackPath: entry.rollbackPath,
      measuredOutcome: toJson(entry.measuredOutcome),
      measurementMode: entry.measurementMode,
    },
    select: { id: true },
  });

  return { ledgerId: row.id };
};

/**
 * Convenience: log a governance decision (activation attempt) with the
 * 26A.8 destination-compatibility summary included. lib/server calls this
 * immediately after checkAction, pass or block — blocked attempts are
 * auditable too (PRD 8.5: "Blocking event is logged in Context Ledger").
 */
export async function writeGovernanceDecision(params: {
  accountId: string;
  userId?: string;
  actionId?: string;
  opportunityId?: string;
  constitutionVersion: number;
  decision: GovernanceCheckResult;
  /** e.g. "destination-compatibility: pass (…)" from GovernanceDecision. */
  destinationCompatibilitySummary?: string;
  destination?: string;
  activationLevel?: LedgerWrite["activationLevel"];
  sourceFreshness?: LedgerWrite["sourceFreshness"];
}): Promise<{ ledgerId: string }> {
  const { decision } = params;
  const gateSummary = decision.gates
    .map((entry) => `${entry.gate}=${entry.outcome}`)
    .join(", ");
  const reasoningParts = [
    `governance verdict: ${decision.verdict}`,
    gateSummary,
    params.destinationCompatibilitySummary,
    decision.reasons.length > 0 ? `reasons: ${decision.reasons.join(" | ")}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return writeLedger({
    accountId: params.accountId,
    eventType: decision.verdict === "pass" ? "activation_attempt" : "activation_failure",
    userId: params.userId,
    actionId: params.actionId,
    opportunityId: params.opportunityId,
    constitutionVersion: params.constitutionVersion,
    sourceDataUsed: { gates: decision.gates, remediations: decision.remediations },
    sourceFreshness: params.sourceFreshness,
    reasoningSummary: reasoningParts.join(" · "),
    destination: params.destination,
    activationLevel: params.activationLevel,
    actionTaken:
      decision.verdict === "pass"
        ? "governance check passed; activation may proceed"
        : "governance check blocked activation",
  });
}
