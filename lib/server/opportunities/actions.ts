"use server";

/**
 * lib/server/opportunities/actions.ts — the ONLY client-callable mutation of
 * the opportunity slice (hardening pass 2, item 2: narrow "use server"
 * surface; reads live in ./read.ts and are NOT action endpoints).
 *
 * dismissOpportunity — reason + cooldown (PRD 9.6) + 26B.18 preference hook.
 */

import db from "../../db";
import { recordRejectionPreference, writeLedger } from "../../ledger";
import {
  DEFAULT_DISMISSAL_COOLDOWN_DAYS,
  dismissalPatch,
} from "../../recipes";
import { assertAccountAccess } from "../account-context";
import { guardMutation } from "../rate-limit";
import { requireRecipeId } from "../shared";
import { dismissOpportunitySchema, parseInput } from "../validation";
import type { DismissOpportunityResult } from "../types";

/**
 * Dismiss with reason (PRD 26 DoD #11). Sets the cooldown window (default 14
 * days) so re-detection skips the card (26B.16), logs the dismissal, and feeds
 * the 26B.18 learned-preferences hook.
 */
export async function dismissOpportunity(params: {
  accountId: string;
  opportunityId: string;
  reason: string;
  cooldownDays?: number;
  userId?: string;
}): Promise<DismissOpportunityResult> {
  await guardMutation("dismissOpportunity"); // P7 — origin check + rate limit first
  params = parseInput(dismissOpportunitySchema, params, "dismissOpportunity"); // P5
  await assertAccountAccess(params.accountId); // P4 — account boundary
  if (!params.reason.trim()) {
    throw new Error("A dismissal reason is required (PRD 26 DoD #11).");
  }
  const row = await db.opportunity.findFirst({
    where: { id: params.opportunityId, accountId: params.accountId },
  });
  if (!row) throw new Error(`Opportunity ${params.opportunityId} not found.`);

  const now = new Date();
  const patch = dismissalPatch(
    params.reason,
    now,
    params.cooldownDays ?? DEFAULT_DISMISSAL_COOLDOWN_DAYS,
  );
  await db.opportunity.update({ where: { id: row.id }, data: patch });

  await writeLedger({
    accountId: params.accountId,
    eventType: "dismissal",
    userId: params.userId,
    opportunityId: row.id,
    skillInvoked: row.recipeId,
    reasoningSummary: `User dismissed with reason: "${params.reason}". Cooldown until ${patch.cooldownUntil.toISOString()}.`,
    actionTaken: "opportunity dismissed; re-detection paused for cooldown",
  });

  // 26B.18 — dismissal reasons are learning signals like rejection reasons.
  const learned = await recordRejectionPreference({
    accountId: params.accountId,
    reason: params.reason,
    userId: params.userId,
    opportunityId: row.id,
    recipeId: requireRecipeId(row.recipeId),
  });

  return {
    opportunityId: row.id,
    status: "dismissed",
    cooldownUntil: patch.cooldownUntil.toISOString(),
    preferenceKeys: learned.preferenceKeys,
  };
}
