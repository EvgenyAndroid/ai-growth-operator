"use server";

/**
 * lib/server/actions — draft / approve / reject / edit server actions.
 *
 * This module is the STABLE public surface (import "@/lib/server/actions" —
 * unchanged by the P11 split). It is the only "use server" file of the
 * action slice: each export runs the P7 mutation guard and P5 zod validation
 * first, then delegates to its implementation module, which starts at the
 * P4 account boundary. Order: guard -> validate -> account boundary — abusive
 * traffic is shed cheapest-first.
 *
 *   ./draft.ts             — draftAction impl (draft is NOT activation, 26A.4)
 *   ./approve.ts           — approveAction impl (THE activation path: approval
 *                            -> governance chokepoint -> holdout -> SIMULATED
 *                            ladder -> measurement windows -> ledger)
 *   ./reject.ts            — rejectAction impl (26B.18 learning hook)
 *   ./edit.ts              — recordDraftEdit impl (26B.18 learning hook)
 *   ./activation-ladder.ts — shared channel/governance-view/ladder helpers
 */

import { guardMutation } from "../rate-limit";
import type {
  ApproveActionResult,
  DraftActionResult,
  RejectActionResult,
} from "../types";
import {
  approveActionSchema,
  draftActionSchema,
  parseInput,
  recordDraftEditSchema,
  rejectActionSchema,
} from "../validation";
import { runApproveAction } from "./approve";
import { runDraftAction } from "./draft";
import { runRecordDraftEdit } from "./edit";
import { runRejectAction } from "./reject";

// ---------------------------------------------------------------------------
// draftAction — draft is not activation (26A.4)
// ---------------------------------------------------------------------------

export async function draftAction(params: {
  accountId: string;
  opportunityId: string;
  userId?: string;
}): Promise<DraftActionResult> {
  await guardMutation("draftAction"); // P7 — origin check + rate limit first
  return runDraftAction(parseInput(draftActionSchema, params, "draftAction")); // P5 validate; P4 inside
}

// ---------------------------------------------------------------------------
// approveAction — the ONLY path to (simulated) activation
// ---------------------------------------------------------------------------

export async function approveAction(params: {
  accountId: string;
  actionId: string;
  approver?: string;
  /** 26A.8 — required true for Meta audience actions. */
  metaIdentifierRightsConfirmed?: boolean;
  /** Canonical claim keys the user explicitly overrode (overrideable claims only). */
  claimOverrides?: string[];
}): Promise<ApproveActionResult> {
  await guardMutation("approveAction"); // P7 — origin check + rate limit first
  return runApproveAction(parseInput(approveActionSchema, params, "approveAction")); // P5; P4 inside
}

// ---------------------------------------------------------------------------
// rejectAction — reason feeds the 26B.18 learning loop
// ---------------------------------------------------------------------------

export async function rejectAction(params: {
  accountId: string;
  actionId: string;
  reason: string;
  userId?: string;
}): Promise<RejectActionResult> {
  await guardMutation("rejectAction"); // P7 — origin check + rate limit first
  return runRejectAction(parseInput(rejectActionSchema, params, "rejectAction")); // P5; P4 inside
}

// ---------------------------------------------------------------------------
// recordDraftEdit — user edits feed the same learning loop (26B.18)
// ---------------------------------------------------------------------------

export async function recordDraftEdit(params: {
  accountId: string;
  draftId: string;
  editSummary: string;
  /** Full replacement copy after the edit (validated template steps). */
  copy?: unknown;
  userId?: string;
}): Promise<{ draftId: string; currentVersion: number; preferenceKeys: string[] }> {
  await guardMutation("recordDraftEdit"); // P7 — origin check + rate limit first
  return runRecordDraftEdit(parseInput(recordDraftEditSchema, params, "recordDraftEdit")); // P5; P4 inside
}
