/**
 * lib/server/shared.ts — internal helpers for the server-action layer.
 *
 * NOT part of the UI surface (no "use server"); imported only by the action
 * files in this directory. Pure helpers + small DB lookups shared across
 * actions. Every mutation still flows recipes/governance/measurement/ledger —
 * nothing here bypasses a module.
 */

import type {
  Constitution,
  ContractLedgerEventType,
  DataFreshness,
  ExplanationContract,
  IdentifiedCoverage,
  IntegrationSource,
  LedgerEntry,
  Opportunity,
  Prisma,
  RecipeId,
} from "../contracts";
import {
  DTC_RECIPE_IDS,
  LOCAL_RECIPE_IDS,
  MEASUREMENT_LABELS,
  MEASUREMENT_LABEL_COPY,
} from "../contracts";
import db from "../db";
import { DEMO_REFERENCE_DATE } from "../demo";
import type { ReachSource } from "../measurement";
import { fnv1a32 } from "../measurement";
import type { LedgerEntryView, OpportunityCardView } from "./types";

const MS_PER_HOUR = 3_600_000;

// ---------------------------------------------------------------------------
// Json helpers
// ---------------------------------------------------------------------------

/** Round-trip to guarantee a plain-JSON value for Prisma Json columns. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Account / constitution lookups (fail closed on missing rows)
// ---------------------------------------------------------------------------

export async function requireAccount(accountId: string) {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Account ${accountId} not found.`);
  return account;
}

/**
 * The account's DATA clock. Demo-mode accounts are anchored at the demo
 * dataset's fixed reference date (PRD 25.1 — deterministic demo data), so
 * recipe windows, freshness checks, launches, and measurement windows line up
 * with the seeded events regardless of the real wall clock. Live accounts use
 * real time. USER-time facts (ledger timestamps, approval timestamps, export
 * timestamps, dismissal cooldowns) always use the real clock.
 */
export function accountClock(account: { demoMode: boolean }): Date {
  return account.demoMode ? new Date(DEMO_REFERENCE_DATE) : new Date();
}

export async function latestConstitution(
  accountId: string,
): Promise<Constitution | null> {
  return db.constitution.findFirst({
    where: { accountId },
    orderBy: { version: "desc" },
  });
}

export async function requireConstitution(accountId: string): Promise<Constitution> {
  const constitution = await latestConstitution(accountId);
  if (!constitution) {
    throw new Error(
      `Account ${accountId} has no Operating Rules yet — complete onboarding first (PRD 12.3).`,
    );
  }
  return constitution;
}

/** Every recipe id across all vertical packs (DTC PRD 1.7 + LOCAL pack). */
const ALL_RECIPE_IDS: readonly string[] = [
  ...DTC_RECIPE_IDS,
  ...LOCAL_RECIPE_IDS.filter(
    (id) => !(DTC_RECIPE_IDS as readonly string[]).includes(id),
  ),
];

export function requireRecipeId(value: string): RecipeId {
  if (ALL_RECIPE_IDS.includes(value)) return value as RecipeId;
  throw new Error(`"${value}" is not a known recipe id (PRD 1.7 / LOCAL pack).`);
}

// ---------------------------------------------------------------------------
// Freshness — same Integration -> DataFreshness mapping the recipe loader uses
// ---------------------------------------------------------------------------

export async function buildSourceFreshness(
  accountId: string,
  now: Date,
): Promise<DataFreshness[]> {
  const integrations = await db.integration.findMany({
    where: { accountId },
    orderBy: { source: "asc" },
  });
  return integrations.map((integration) => {
    const lastSync = integration.lastSyncAt ?? new Date(0);
    return {
      source:
        integration.mode === "mock"
          ? ("demo" as const)
          : (integration.source as IntegrationSource),
      lastSyncAt: lastSync.toISOString(),
      thresholdHours: integration.freshnessThresholdHours,
      isStale:
        now.getTime() - lastSync.getTime() >
        integration.freshnessThresholdHours * MS_PER_HOUR,
    };
  });
}

// ---------------------------------------------------------------------------
// Audience persistence helpers
// ---------------------------------------------------------------------------

/** Customer ids are persisted inside Audience.inclusionRules.customerIds. */
export function parseAudienceCustomerIds(inclusionRules: unknown): string[] {
  if (!isPlainObject(inclusionRules)) return [];
  const ids = inclusionRules.customerIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

// ---------------------------------------------------------------------------
// Existing-flow reach sources (26B.11 / 26A.5) for contamination checks
// ---------------------------------------------------------------------------

export async function loadExistingFlowReachSources(
  accountId: string,
): Promise<ReachSource[]> {
  const pref = await db.preference.findUnique({
    where: { accountId_key: { accountId, key: "existing_flows" } },
  });
  if (!pref || !Array.isArray(pref.value)) return [];
  const sources: ReachSource[] = [];
  for (const raw of pref.value) {
    if (!isPlainObject(raw)) continue;
    const type = raw.type;
    const flowType =
      type === "recovery"
        ? ("klaviyo_abandoned_cart_flow" as const)
        : type === "winback"
          ? ("klaviyo_winback_flow" as const)
          : ("klaviyo_other_flow" as const);
    sources.push({
      type: flowType,
      name: typeof raw.name === "string" ? raw.name : "unnamed flow",
      active: raw.active === true,
      memberEmailsLower: Array.isArray(raw.memberCustomerEmails)
        ? raw.memberCustomerEmails.filter(
            (e): e is string => typeof e === "string",
          )
        : undefined,
    });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Opportunity row -> card DTO
// ---------------------------------------------------------------------------

export function opportunityToCard(
  row: Opportunity,
  /**
   * LOCAL trust rule #9: the POS coverage disclosure is not persisted on the
   * Opportunity row — callers holding a fresh RecipeResult attach it here.
   * DTC callers omit it (null on the card).
   */
  coverage: IdentifiedCoverage | null = null,
): OpportunityCardView {
  const explanation = row.explanation as unknown as ExplanationContract;
  const mode = explanation.measurementPlan.mode;
  return {
    id: row.id,
    recipeId: requireRecipeId(row.recipeId),
    recipeVersion: row.recipeVersion,
    title: row.title,
    category: row.category,
    status: row.status as OpportunityCardView["status"],
    confidence: row.confidence as OpportunityCardView["confidence"],
    estimate:
      row.estimatedValueLow !== null && row.estimatedValueHigh !== null
        ? {
            low: row.estimatedValueLow,
            high: row.estimatedValueHigh,
            label: row.estimateLabel as OpportunityCardView["estimateLabel"],
          }
        : null,
    estimateLabel: row.estimateLabel as OpportunityCardView["estimateLabel"],
    dataAsOf: row.dataAsOf.toISOString(),
    recommendedAction: row.recommendedAction,
    explanation,
    measurementMode: mode,
    measurementLabel: MEASUREMENT_LABELS[mode],
    measurementLabelCopy: MEASUREMENT_LABEL_COPY[mode],
    coverage,
    dismissedReason: row.dismissedReason,
    cooldownUntil: row.cooldownUntil ? row.cooldownUntil.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Deterministic ranking (26B.18 — learned preferences inform ranking)
// ---------------------------------------------------------------------------

export async function loadRejectionDemotions(
  accountId: string,
): Promise<Set<RecipeId>> {
  const prefs = await db.preference.findMany({
    where: { accountId, key: { startsWith: "rejection_pattern:" } },
  });
  const demoted = new Set<RecipeId>();
  for (const pref of prefs) {
    const recipePart = pref.key.slice("rejection_pattern:".length);
    if (ALL_RECIPE_IDS.includes(recipePart)) {
      demoted.add(recipePart as RecipeId);
    }
  }
  return demoted;
}

/**
 * Rank cards deterministically:
 *  1. dollar-estimated (found-money-grade) cards by estimate high desc
 *  2. everything else, directional Meta last
 *  3. recipes the merchant has rejected before are demoted within their band
 */
export function rankOpportunityCards(
  cards: OpportunityCardView[],
  demoted: Set<RecipeId>,
): OpportunityCardView[] {
  const band = (card: OpportunityCardView): number => {
    let b = card.estimate ? 0 : card.recipeId === "meta_seed_suppression" ? 2 : 1;
    if (demoted.has(card.recipeId)) b += 3; // demote below non-rejected bands
    return b;
  };
  return [...cards].sort((a, b) => {
    const bandDiff = band(a) - band(b);
    if (bandDiff !== 0) return bandDiff;
    const estDiff = (b.estimate?.high ?? 0) - (a.estimate?.high ?? 0);
    if (estDiff !== 0) return estDiff;
    return a.recipeId.localeCompare(b.recipeId); // stable tiebreak
  });
}

// ---------------------------------------------------------------------------
// Ledger row -> DTO
// ---------------------------------------------------------------------------

export function ledgerEntryToView(row: LedgerEntry): LedgerEntryView {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    eventType: row.eventType as ContractLedgerEventType,
    userId: row.userId,
    actionId: row.actionId,
    opportunityId: row.opportunityId,
    skillInvoked: row.skillInvoked,
    constitutionVersion: row.constitutionVersion,
    reasoningSummary: row.reasoningSummary,
    confidence: row.confidence,
    approvalStatus: row.approvalStatus,
    destination: row.destination,
    activationLevel: row.activationLevel,
    actionTaken: row.actionTaken,
    measurementMode: row.measurementMode,
  };
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-values for simulated connector results (no Math.random)
// ---------------------------------------------------------------------------

/** Deterministic fraction in [min, max] derived from a seed string. */
export function deterministicFraction(
  seed: string,
  min: number,
  max: number,
): number {
  const unit = (fnv1a32(seed) % 10_000) / 10_000;
  return Math.round((min + unit * (max - min)) * 1000) / 1000;
}
