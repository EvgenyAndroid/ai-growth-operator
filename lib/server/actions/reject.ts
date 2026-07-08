/**
 * lib/server/actions/reject.ts — rejectAction implementation (P11 split).
 *
 * Rejection reason -> 26B.18 learned-preferences hook. Callers reach this
 * ONLY through the "use server" wrapper in ./index.ts, which runs
 * guardMutation (P7) + zod validation (P5) first; this module starts at the
 * account boundary (P4).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import db from "../../db";
import { recordRejectionPreference } from "../../ledger";
import { assertAccountAccess } from "../account-context";
import { requireRecipeId } from "../shared";
import type { RejectActionResult } from "../types";

export async function runRejectAction(params: {
  accountId: string;
  actionId: string;
  reason: string;
  userId?: string;
}): Promise<RejectActionResult> {
  await assertAccountAccess(params.accountId); // P4 — account boundary
  if (!params.reason.trim()) {
    throw new Error("A rejection reason is required (PRD 26 DoD #11).");
  }

  const action = await db.action.findFirst({
    where: { id: params.actionId, accountId: params.accountId },
    include: {
      opportunity: true,
      approvals: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });
  if (!action) throw new Error(`Action ${params.actionId} not found.`);
  if (action.status === "launched") {
    throw new Error("Launched actions cannot be rejected — they are already live.");
  }

  const approvalRow = action.approvals[0];
  if (approvalRow) {
    await db.approval.update({
      where: { id: approvalRow.id },
      data: {
        status: "rejected",
        approver: params.userId,
        changesRequested: params.reason,
      },
    });
  }
  await db.action.update({
    where: { id: action.id },
    data: { status: "rejected" },
  });
  if (action.opportunityId && action.opportunity?.status === "drafted") {
    await db.opportunity.update({
      where: { id: action.opportunityId },
      data: { status: "proposed" },
    });
  }

  // 26B.18 — deterministic preference learning + rejection ledger entry.
  const learned = await recordRejectionPreference({
    accountId: params.accountId,
    reason: params.reason,
    userId: params.userId,
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    recipeId: action.opportunity
      ? requireRecipeId(action.opportunity.recipeId)
      : undefined,
    constitutionVersion: action.constitutionVersion,
  });

  return {
    actionId: action.id,
    actionStatus: "rejected",
    preferenceKeys: learned.preferenceKeys,
    ledgerId: learned.ledgerId,
  };
}
