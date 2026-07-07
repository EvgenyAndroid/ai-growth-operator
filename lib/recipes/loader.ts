/**
 * lib/recipes/loader.ts — the ONLY file in lib/recipes that touches lib/db.
 *
 * Assembles a RecipeDataSnapshot with one set of reads, then hands it to the
 * pure recipe functions. Determinism: pass the same `asOf` and an unchanged
 * database and every run returns identical results.
 *
 * Soft contract with the demo module (no Flow model exists in the schema):
 *  - Preference key "existing_flows"    -> ExistingFlowSnapshot[] (26B.11)
 *  - Preference key "manual_exclusions" -> string[] of customer ids
 * When "existing_flows" is absent, flowMembershipSource = "unavailable" and
 * the recipes flag contamination risk + lower confidence (26A.5).
 */

import type {
  ContractActionType,
  DataFreshness,
  IntegrationSource,
  RecipeId,
  RecipeInput,
  RecipeResult,
  Vertical,
} from "../contracts";
import db from "../db";
import { getVerticalDefinition, recipeIdsForVertical } from "../verticals";
import { resolveRecipeConfig } from "./config";
import { runRecipe } from "./run";
import type {
  ExistingFlowSnapshot,
  FlowMembershipSource,
  RecipeDataSnapshot,
} from "./types";

const RECIPE_EVENT_TYPES = [
  "checkout_started",
  "purchase",
  "repeat_purchase",
  "refund",
  "unsubscribe",
];

const MS_PER_HOUR = 3_600_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseExistingFlows(value: unknown): ExistingFlowSnapshot[] {
  if (!Array.isArray(value)) return [];
  const out: ExistingFlowSnapshot[] = [];
  for (const raw of value) {
    if (!isPlainObject(raw)) continue;
    const type = raw.type;
    if (type !== "recovery" && type !== "winback" && type !== "other") continue;
    out.push({
      type,
      name: typeof raw.name === "string" ? raw.name : "unnamed flow",
      active: raw.active === true,
      memberCustomerEmails: Array.isArray(raw.memberCustomerEmails)
        ? raw.memberCustomerEmails.filter((e): e is string => typeof e === "string")
        : [],
    });
  }
  return out;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** Load everything the pure recipes need for one account. */
export async function loadRecipeSnapshot(
  accountId: string,
  asOf: Date,
): Promise<RecipeDataSnapshot> {
  const [customers, products, events, integrations, preferences, holdoutActions] =
    await Promise.all([
      db.customer.findMany({ where: { accountId }, orderBy: { id: "asc" } }),
      db.product.findMany({ where: { accountId }, orderBy: { id: "asc" } }),
      db.event.findMany({
        where: { accountId, eventType: { in: RECIPE_EVENT_TYPES } },
        orderBy: [{ eventTimestamp: "asc" }, { id: "asc" }],
      }),
      db.integration.findMany({ where: { accountId }, orderBy: { source: "asc" } }),
      db.preference.findMany({
        where: { accountId, key: { in: ["existing_flows", "manual_exclusions"] } },
      }),
      db.action.findMany({
        where: { accountId, holdoutId: { not: null } },
        include: { holdout: { include: { memberships: true } } },
        orderBy: { id: "asc" },
      }),
    ]);

  const freshness: DataFreshness[] = integrations.map((i) => {
    const lastSync = i.lastSyncAt ?? new Date(0);
    return {
      source:
        i.mode === "mock" ? "demo" : (i.source as IntegrationSource),
      lastSyncAt: lastSync.toISOString(),
      thresholdHours: i.freshnessThresholdHours,
      isStale:
        asOf.getTime() - lastSync.getTime() >
        i.freshnessThresholdHours * MS_PER_HOUR,
    };
  });

  const flowsPref = preferences.find((p) => p.key === "existing_flows");
  const existingFlows = flowsPref ? parseExistingFlows(flowsPref.value) : [];
  const flowMembershipSource: FlowMembershipSource = flowsPref
    ? "flow_membership"
    : "unavailable";

  const manualPref = preferences.find((p) => p.key === "manual_exclusions");
  const manualExclusionCustomerIds = manualPref
    ? parseStringArray(manualPref.value)
    : [];

  const heldOutCustomerIdsByActionType: Partial<
    Record<ContractActionType, string[]>
  > = {};
  for (const action of holdoutActions) {
    const holdout = action.holdout;
    if (!holdout || (holdout.status !== "planned" && holdout.status !== "active"))
      continue;
    const type = action.type as ContractActionType;
    const ids = holdout.memberships
      .filter((m) => m.arm === "held_out")
      .map((m) => m.customerId);
    if (ids.length === 0) continue;
    const existing = heldOutCustomerIdsByActionType[type];
    if (existing) existing.push(...ids);
    else heldOutCustomerIdsByActionType[type] = [...ids];
  }

  return {
    accountId,
    customers,
    products,
    events,
    existingFlows,
    flowMembershipSource,
    heldOutCustomerIdsByActionType,
    manualExclusionCustomerIds,
    freshness,
  };
}

/** Resolve the merchant's stored RecipeConfig (params + overrides) over defaults. */
export async function loadRecipeInput<R extends RecipeId>(
  accountId: string,
  recipeId: R,
  asOf: Date,
): Promise<RecipeInput<R>> {
  const [storedConfig, latestConstitution] = await Promise.all([
    db.recipeConfig.findUnique({
      where: { accountId_recipeId: { accountId, recipeId } },
    }),
    db.constitution.findFirst({
      where: { accountId },
      orderBy: { version: "desc" },
    }),
  ]);
  return {
    accountId,
    recipeId,
    config: resolveRecipeConfig(
      recipeId,
      storedConfig?.params,
      storedConfig?.overrides,
    ),
    dataAsOf: asOf.toISOString(),
    constitutionVersion: latestConstitution?.version ?? 1,
  };
}

/** Account vertical — vertical selection routes everything (lib/verticals.ts). */
async function loadAccountVertical(accountId: string): Promise<Vertical> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { vertical: true },
  });
  if (!account) throw new Error(`Account ${accountId} not found.`);
  return getVerticalDefinition(account.vertical).vertical;
}

/** Convenience for lib/server: load + run a single recipe for an account. */
export async function runRecipeForAccount<R extends RecipeId>(
  accountId: string,
  recipeId: R,
  asOf: Date = new Date(),
): Promise<RecipeResult<R>> {
  const [input, snapshot, vertical] = await Promise.all([
    loadRecipeInput(accountId, recipeId, asOf),
    loadRecipeSnapshot(accountId, asOf),
    loadAccountVertical(accountId),
  ]);
  return runRecipe(input, snapshot, vertical);
}

/**
 * Run every recipe the account's vertical registers (lib/verticals.ts) against
 * one snapshot (single read set). DTC accounts run the identical three v0
 * recipes in the identical order as before.
 */
export async function runAllRecipesForAccount(
  accountId: string,
  asOf: Date = new Date(),
): Promise<RecipeResult[]> {
  const [snapshot, vertical] = await Promise.all([
    loadRecipeSnapshot(accountId, asOf),
    loadAccountVertical(accountId),
  ]);
  const results: RecipeResult[] = [];
  for (const recipeId of recipeIdsForVertical(vertical)) {
    const input = await loadRecipeInput(accountId, recipeId, asOf);
    results.push(runRecipe(input, snapshot, vertical));
  }
  return results;
}
