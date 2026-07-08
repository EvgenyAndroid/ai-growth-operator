/**
 * lib/ledger/preferences.ts — learned merchant preferences hook (PRD 26B.18).
 *
 * Rejection reasons (and user edits) feed Preference rows. Classification is
 * a deterministic keyword router — NO LLM in Alpha. Preferences inform
 * opportunity ranking and back the "learned preferences" export (PRD 19).
 *
 * Every call also writes the corresponding ledger entry (rejection / user_edit)
 * so the audit trail and the learned preference stay in lockstep.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { db } from "../db";
import type { Prisma } from "../contracts/models";
import type { RecipeId } from "../contracts";
import type { Preference } from "../contracts/models";
import { writeLedger } from "./write";

// ---------------------------------------------------------------------------
// Preference value shapes (stored as Json on Preference.value)
// ---------------------------------------------------------------------------

export interface PreferenceSignalValue {
  /** Machine-usable stance, e.g. "avoid_discounts". */
  stance?: string;
  /** How many times this preference has been reinforced. */
  occurrences: number;
  /** Raw reasons/edits that produced it, newest last (capped at 20). */
  history: string[];
  lastObservedAt: string; // ISO
}

const HISTORY_CAP = 20;

export type PreferenceSource = "rejection_reason" | "edit" | "explicit";

interface PreferenceUpdate {
  key: string;
  stance?: string;
}

/**
 * Deterministic keyword router: rejection reason text → preference keys.
 * Same input, same output — no LLM (PRD 25.1 Alpha).
 */
export function classifyRejectionReason(
  reason: string,
  recipeId?: RecipeId,
): PreferenceUpdate[] {
  const text = reason.toLowerCase();
  const updates: PreferenceUpdate[] = [];

  if (/discount|coupon|promo\b|promotion|% ?off|markdown|price cut|cheapen/.test(text)) {
    updates.push({ key: "offer_stance", stance: "avoid_discounts" });
  }
  if (/\btone\b|\bvoice\b|sounds?\b|wording|phras|too (salesy|pushy|aggressive|casual|formal)|off[- ]brand|brand voice/.test(text)) {
    updates.push({ key: "tone_correction", stance: "adjust_tone" });
  }
  if (/too (many|much|often|frequent)|frequency|spam|inbox|over[- ]?email/.test(text)) {
    updates.push({ key: "frequency_sensitivity", stance: "reduce_frequency" });
  }
  if (/audience|segment|wrong (people|customers)|target/.test(text)) {
    updates.push({ key: "audience_correction", stance: "refine_audience" });
  }

  // Always record the per-recipe rejection pattern so ranking can demote
  // repeatedly rejected recipe types (26B.18).
  updates.push({
    key: recipeId ? `rejection_pattern:${recipeId}` : "rejection_pattern:general",
    stance: "rejected",
  });

  return updates;
}

function isPreferenceSignalValue(value: unknown): value is PreferenceSignalValue {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as PreferenceSignalValue).history) &&
    typeof (value as PreferenceSignalValue).occurrences === "number"
  );
}

async function upsertPreference(params: {
  accountId: string;
  key: string;
  stance?: string;
  observation: string;
  source: PreferenceSource;
  now: Date;
}): Promise<void> {
  const existing = await db.preference.findUnique({
    where: { accountId_key: { accountId: params.accountId, key: params.key } },
  });

  const prior: PreferenceSignalValue = isPreferenceSignalValue(existing?.value)
    ? (existing.value as unknown as PreferenceSignalValue)
    : { occurrences: 0, history: [], lastObservedAt: params.now.toISOString() };

  const next: PreferenceSignalValue = {
    stance: params.stance ?? prior.stance,
    occurrences: prior.occurrences + 1,
    history: [...prior.history, params.observation].slice(-HISTORY_CAP),
    lastObservedAt: params.now.toISOString(),
  };

  await db.preference.upsert({
    where: { accountId_key: { accountId: params.accountId, key: params.key } },
    create: {
      accountId: params.accountId,
      key: params.key,
      value: next as unknown as Prisma.InputJsonValue,
      source: params.source,
    },
    update: {
      value: next as unknown as Prisma.InputJsonValue,
      source: params.source,
    },
  });
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

export interface RecordRejectionParams {
  accountId: string;
  reason: string;
  userId?: string;
  opportunityId?: string;
  actionId?: string;
  recipeId?: RecipeId;
  constitutionVersion?: number;
}

export interface RecordRejectionResult {
  /** Preference keys created or reinforced by this rejection. */
  preferenceKeys: string[];
  /** Ledger id of the rejection entry (always written). */
  ledgerId: string;
}

/**
 * 26B.18 hook — call whenever a user rejects an opportunity, draft, or action
 * with a reason. Updates Preference rows AND writes the rejection ledger entry.
 */
export async function recordRejectionPreference(
  params: RecordRejectionParams,
): Promise<RecordRejectionResult> {
  const now = new Date();
  const updates = classifyRejectionReason(params.reason, params.recipeId);

  for (const update of updates) {
    await upsertPreference({
      accountId: params.accountId,
      key: update.key,
      stance: update.stance,
      observation: params.reason,
      source: "rejection_reason",
      now,
    });
  }

  const { ledgerId } = await writeLedger({
    accountId: params.accountId,
    eventType: "rejection",
    userId: params.userId,
    actionId: params.actionId,
    opportunityId: params.opportunityId,
    constitutionVersion: params.constitutionVersion,
    reasoningSummary: `User rejected with reason: "${params.reason}". Learned preference keys: ${updates
      .map((update) => update.key)
      .join(", ")}.`,
    actionTaken: "rejection recorded; learned preferences updated",
  });

  return { preferenceKeys: updates.map((update) => update.key), ledgerId };
}

export interface RecordEditParams {
  accountId: string;
  /** What the user changed, e.g. "removed discount from subject line". */
  editSummary: string;
  userId?: string;
  actionId?: string;
  opportunityId?: string;
  recipeId?: RecipeId;
  constitutionVersion?: number;
}

/**
 * 26B.18 also feeds preferences from edits (e.g. the user repeatedly strips
 * discounts out of drafts). Same deterministic router, source = "edit".
 */
export async function recordEditPreference(
  params: RecordEditParams,
): Promise<RecordRejectionResult> {
  const now = new Date();
  const updates = classifyRejectionReason(params.editSummary, params.recipeId).filter(
    // Edits reinforce stance keys but should not count as rejections.
    (update) => !update.key.startsWith("rejection_pattern:"),
  );

  for (const update of updates) {
    await upsertPreference({
      accountId: params.accountId,
      key: update.key,
      stance: update.stance,
      observation: params.editSummary,
      source: "edit",
      now,
    });
  }

  const { ledgerId } = await writeLedger({
    accountId: params.accountId,
    eventType: "user_edit",
    userId: params.userId,
    actionId: params.actionId,
    opportunityId: params.opportunityId,
    constitutionVersion: params.constitutionVersion,
    reasoningSummary: `User edit: "${params.editSummary}".${
      updates.length > 0
        ? ` Learned preference keys: ${updates.map((update) => update.key).join(", ")}.`
        : ""
    }`,
    actionTaken: "edit recorded" + (updates.length > 0 ? "; learned preferences updated" : ""),
  });

  return { preferenceKeys: updates.map((update) => update.key), ledgerId };
}

/** All learned preferences for ranking + the PRD 19 export. */
export async function getPreferences(accountId: string): Promise<Preference[]> {
  return db.preference.findMany({
    where: { accountId },
    orderBy: { updatedAt: "desc" },
  });
}

/** Read a single preference value (typed) for ranking heuristics. */
export async function getPreferenceValue(
  accountId: string,
  key: string,
): Promise<PreferenceSignalValue | null> {
  const row = await db.preference.findUnique({
    where: { accountId_key: { accountId, key } },
  });
  if (!row || !isPreferenceSignalValue(row.value)) return null;
  return row.value as unknown as PreferenceSignalValue;
}
