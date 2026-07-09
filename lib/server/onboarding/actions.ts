"use server";

/**
 * lib/server/onboarding/actions.ts — onboarding/settings MUTATIONS (the
 * narrow "use server" action module of the onboarding slice; hardening pass 2,
 * items 2 + 3). Reads live in ./read.ts; provisioning internals in
 * ./provision.ts.
 *
 * resetDemoWorkspace — the ONLY reset path (PRD 20.2 landing-page reset);
 *                      guardMutation-guarded (5/min rule)
 * selectDemoVertical — guarded Business Setup: persist the vertical cookie
 *                      (trust rule #10) + provision the matching workspace
 * saveOperatingRules — PRD 12.3: three numbers -> NEW Constitution version
 * resyncConnection   — PRD 8.5: "user can re-sync from the blocking message"
 */

import db from "../../db";
import type { IntegrationSource, Vertical } from "../../contracts";
import { writeLedger } from "../../ledger";
import { assertAccountAccess } from "../account-context";
import { guardMutation } from "../rate-limit";
import { getActiveVertical, setActiveVertical } from "../vertical";
import {
  accountClock,
  latestConstitution,
  requireConstitution,
  toInputJson,
} from "../shared";
import {
  parseInput,
  resetDemoWorkspaceSchema,
  resyncConnectionSchema,
  saveOperatingRulesSchema,
  selectDemoVerticalSchema,
} from "../validation";
import { provisionDemoAccount } from "./provision";
import { getConnectionStatus, toOperatingRulesView } from "./read";
import type {
  ConnectionStatusView,
  DemoAccountResult,
  OperatingRulesView,
  SaveOperatingRulesInput,
} from "../types";

/**
 * Wipe and reseed the demo workspace — THE only reset path (hardening pass 2,
 * item 3). Guarded first (P7: same-origin + 5/min rate limit + attempt log);
 * the vertical resolves exactly like ensureDemoAccount (explicit option, else
 * the Business Setup cookie, else DTC).
 */
export async function resetDemoWorkspace(
  options: { vertical?: Vertical } = {},
): Promise<DemoAccountResult> {
  await guardMutation("resetDemoWorkspace"); // P7 — origin check + rate limit first
  options = parseInput(resetDemoWorkspaceSchema, options ?? {}, "resetDemoWorkspace"); // P5
  const vertical = options.vertical ?? (await getActiveVertical());
  return provisionDemoAccount(vertical, { reset: true });
}

/**
 * Business Setup (Screen 2) — persist the vertical choice (cookie; trust rule
 * #10: vertical selection routes everything downstream) and provision the
 * matching demo workspace. Guarded: it is a client-invocable mutation (cookie
 * write + possible first-seed). Unknown vertical values throw (validated
 * twice: zod shape here, registry membership in setActiveVertical).
 */
export async function selectDemoVertical(
  vertical: string,
): Promise<DemoAccountResult> {
  await guardMutation("selectDemoVertical"); // P7 — origin check + rate limit first
  vertical = parseInput(selectDemoVerticalSchema, vertical, "selectDemoVertical"); // P5
  const selected = await setActiveVertical(vertical); // validates; throws on unknown
  return provisionDemoAccount(selected, { reset: false });
}

/**
 * PRD 12.3 — the user edits three numbers during onboarding (and later in
 * settings). Operating Rules are immutable versions: this creates a NEW
 * Constitution version carrying every other field forward, and logs a
 * rules_edit ledger entry.
 */
export async function saveOperatingRules(
  input: SaveOperatingRulesInput,
): Promise<OperatingRulesView> {
  await guardMutation("saveOperatingRules"); // P7 — origin check + rate limit first
  input = parseInput(saveOperatingRulesSchema, input, "saveOperatingRules"); // P5
  await assertAccountAccess(input.accountId); // P4 — account boundary

  for (const [name, value] of [
    ["monthlyBudgetCap", input.monthlyBudgetCap],
    ["maxDiscountPercent", input.maxDiscountPercent],
    ["dailySendCap", input.dailySendCap],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Operating Rules: ${name} must be a non-negative number.`);
    }
  }
  if (input.maxDiscountPercent > 100) {
    throw new Error("Operating Rules: maxDiscountPercent cannot exceed 100.");
  }

  const current = await requireConstitution(input.accountId);
  const created = await db.constitution.create({
    data: {
      accountId: input.accountId,
      templateVertical: current.templateVertical,
      version: current.version + 1,
      monthlyBudgetCap: input.monthlyBudgetCap,
      maxDiscountPercent: input.maxDiscountPercent,
      marginFloorPercent: current.marginFloorPercent,
      dailySendCap: Math.floor(input.dailySendCap),
      frequencyCaps: current.frequencyCaps ?? undefined,
      blackoutDates: current.blackoutDates ?? undefined,
      toneGuide: current.toneGuide,
      bannedClaims: current.bannedClaims ?? undefined,
      suppressionDefaults: current.suppressionDefaults ?? undefined,
      approvalRequirements: current.approvalRequirements ?? undefined,
    },
  });
  await db.constitution.update({
    where: { id: current.id },
    data: { supersededById: created.id },
  });

  await writeLedger({
    accountId: input.accountId,
    eventType: "rules_edit",
    userId: input.userId,
    constitutionVersion: created.version,
    sourceDataUsed: {
      previousVersion: current.version,
      changes: {
        monthlyBudgetCap: [current.monthlyBudgetCap, created.monthlyBudgetCap],
        maxDiscountPercent: [current.maxDiscountPercent, created.maxDiscountPercent],
        dailySendCap: [current.dailySendCap, created.dailySendCap],
      },
    },
    reasoningSummary: `Operating Rules updated to version ${created.version} (budget cap, discount ceiling, daily send cap).`,
    actionTaken: "new Operating Rules version created",
  });

  return toOperatingRulesView(created);
}

/**
 * PRD 8.5 — the user can re-sync from a freshness block. In Alpha this is a
 * simulated sync against the mocked connector: refreshes lastSyncAt, records
 * a succeeded SyncRun, and logs a data_sync ledger entry.
 */
export async function resyncConnection(params: {
  accountId: string;
  source: IntegrationSource;
  userId?: string;
}): Promise<ConnectionStatusView> {
  await guardMutation("resyncConnection"); // P7 — origin check + rate limit first
  params = parseInput(resyncConnectionSchema, params, "resyncConnection"); // P5
  const account = await assertAccountAccess(params.accountId); // P4 — account boundary
  const integration = await db.integration.findUnique({
    where: {
      accountId_source: { accountId: params.accountId, source: params.source },
    },
  });
  if (!integration) {
    throw new Error(`No ${params.source} connection exists for this account.`);
  }

  // Sync freshness lives on the account's DATA clock (demo reference date for
  // demo accounts) so it stays coherent with the seeded dataset.
  const now = accountClock(account);
  const recordsRead = await db.event.count({
    where: { accountId: params.accountId },
  });
  await db.integration.update({
    where: { id: integration.id },
    data: { lastSyncAt: now, errorState: null },
  });
  await db.syncRun.create({
    data: {
      accountId: params.accountId,
      integrationId: integration.id,
      source: params.source,
      startedAt: now,
      completedAt: now,
      status: "succeeded",
      recordsRead,
      errors: toInputJson([]),
    },
  });

  await writeLedger({
    accountId: params.accountId,
    eventType: "data_sync",
    userId: params.userId,
    constitutionVersion: (await latestConstitution(params.accountId))?.version,
    sourceDataUsed: { source: params.source, mode: integration.mode, recordsRead },
    reasoningSummary: `Manual re-sync of ${params.source} (simulated in Alpha demo mode).`,
    actionTaken: "connector re-synced",
  });

  const statuses = await getConnectionStatus(params.accountId);
  const refreshed = statuses.find((status) => status.source === params.source);
  if (!refreshed) throw new Error(`Re-sync of ${params.source} failed to persist.`);
  return refreshed;
}
