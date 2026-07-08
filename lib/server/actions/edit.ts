/**
 * lib/server/actions/edit.ts — recordDraftEdit implementation (P11 split).
 *
 * User edits feed the same 26B.18 learning loop as rejections. Callers reach
 * this ONLY through the "use server" wrapper in ./index.ts, which runs
 * guardMutation (P7) + zod validation (P5) first; this module starts at the
 * account boundary (P4).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import db from "../../db";
import { recordEditPreference } from "../../ledger";
import { assertAccountAccess } from "../account-context";
import { parseDraftCopy } from "../draft-templates";
import { requireRecipeId, toInputJson } from "../shared";

export async function runRecordDraftEdit(params: {
  accountId: string;
  draftId: string;
  editSummary: string;
  /** Full replacement copy after the edit (validated template steps). */
  copy?: unknown;
  userId?: string;
}): Promise<{ draftId: string; currentVersion: number; preferenceKeys: string[] }> {
  await assertAccountAccess(params.accountId); // P4 — account boundary
  const draft = await db.draft.findFirst({
    where: { id: params.draftId, accountId: params.accountId },
    include: { opportunity: true },
  });
  if (!draft) throw new Error(`Draft ${params.draftId} not found.`);

  const newCopy = params.copy !== undefined ? parseDraftCopy(params.copy) : null;
  const priorEdits = Array.isArray(draft.edits) ? draft.edits : [];
  const updated = await db.draft.update({
    where: { id: draft.id },
    data: {
      ...(newCopy && newCopy.length > 0 ? { copy: toInputJson(newCopy) } : {}),
      status: "edited",
      currentVersion: draft.currentVersion + 1,
      edits: toInputJson([
        ...priorEdits,
        {
          version: draft.currentVersion + 1,
          editedBy: params.userId ?? null,
          at: new Date().toISOString(),
          diffSummary: params.editSummary,
        },
      ]),
    },
  });

  const learned = await recordEditPreference({
    accountId: params.accountId,
    editSummary: params.editSummary,
    userId: params.userId,
    actionId: draft.actionId ?? undefined,
    opportunityId: draft.opportunityId ?? undefined,
    recipeId: draft.opportunity
      ? requireRecipeId(draft.opportunity.recipeId)
      : undefined,
  });

  return {
    draftId: updated.id,
    currentVersion: updated.currentVersion,
    preferenceKeys: learned.preferenceKeys,
  };
}
