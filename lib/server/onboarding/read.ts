/**
 * lib/server/onboarding/read.ts — onboarding/settings READS + the safe
 * demo-workspace resolver. Server-only (NOT "use server"): called by server
 * components via the lib/server barrel; never client-invocable action
 * endpoints (hardening pass 2, items 2 + 3).
 *
 * ensureDemoAccount  — PRD 20/25.1: reuse (or first-create) the demo
 *                      workspace. NEVER resets — there is no reset parameter;
 *                      the only reset path is resetDemoWorkspace (./actions.ts,
 *                      guardMutation-guarded).
 * getOperatingRules  — current Operating Rules for the settings screen
 * getConnectionStatus— demo Integration cards + freshness (PRD 8.4)
 */

import "server-only"; // build-time guard: must never enter a client bundle

import db from "../../db";
import type { IntegrationSource, Vertical } from "../../contracts";
import { assertAccountAccess } from "../account-context";
import { getActiveVertical } from "../vertical";
import { accountClock, requireConstitution } from "../shared";
import {
  accountIdSchema,
  ensureDemoAccountSchema,
  parseInput,
} from "../validation";
import { provisionDemoAccount } from "./provision";
import type {
  ConnectionStatusView,
  DemoAccountResult,
  OperatingRulesView,
} from "../types";

const MS_PER_HOUR = 3_600_000;

/**
 * Reuse (or first-create) the demo workspace (PRD 20.2, 25.1) — the safe
 * read/create entry point for server components. Accepts ONLY an optional
 * vertical (validated; unknown fields such as a forged `reset` are stripped
 * by the schema). Resolution: explicit option, else the Business Setup
 * cookie, else "shopify_dtc" — so all existing DTC call sites behave exactly
 * as before a vertical was ever selected (trust rule #10).
 */
export async function ensureDemoAccount(
  options: { vertical?: Vertical } = {},
): Promise<DemoAccountResult> {
  options = parseInput(ensureDemoAccountSchema, options ?? {}, "ensureDemoAccount"); // P5
  const vertical = options.vertical ?? (await getActiveVertical());
  return provisionDemoAccount(vertical, { reset: false });
}

/** Current Operating Rules (latest Constitution version). */
export async function getOperatingRules(
  accountId: string,
): Promise<OperatingRulesView> {
  accountId = parseInput(accountIdSchema, accountId, "getOperatingRules"); // P5
  await assertAccountAccess(accountId); // P4 — account boundary
  const constitution = await requireConstitution(accountId);
  return toOperatingRulesView(constitution);
}

/** Shared Constitution -> OperatingRulesView mapper (also used by ./actions). */
export function toOperatingRulesView(constitution: {
  version: number;
  templateVertical: string;
  monthlyBudgetCap: number;
  maxDiscountPercent: number;
  marginFloorPercent: number | null;
  dailySendCap: number;
  toneGuide: string | null;
  bannedClaims: unknown;
  effectiveFrom: Date;
}): OperatingRulesView {
  return {
    version: constitution.version,
    templateVertical: constitution.templateVertical,
    monthlyBudgetCap: constitution.monthlyBudgetCap,
    maxDiscountPercent: constitution.maxDiscountPercent,
    marginFloorPercent: constitution.marginFloorPercent,
    dailySendCap: constitution.dailySendCap,
    toneGuide: constitution.toneGuide,
    bannedClaims: Array.isArray(constitution.bannedClaims)
      ? constitution.bannedClaims.filter(
          (claim): claim is string => typeof claim === "string",
        )
      : [],
    effectiveFrom: constitution.effectiveFrom.toISOString(),
  };
}

/** Connection cards for onboarding/settings (mocked connectors in Alpha). */
export async function getConnectionStatus(
  accountId: string,
): Promise<ConnectionStatusView[]> {
  accountId = parseInput(accountIdSchema, accountId, "getConnectionStatus"); // P5
  const account = await assertAccountAccess(accountId); // P4 — account boundary
  const now = accountClock(account);
  const integrations = await db.integration.findMany({
    where: { accountId },
    orderBy: { source: "asc" },
    include: { syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  return integrations.map((integration) => {
    const lastSyncAt = integration.lastSyncAt;
    const hoursSinceSync = lastSyncAt
      ? Math.round(((now.getTime() - lastSyncAt.getTime()) / MS_PER_HOUR) * 10) / 10
      : null;
    const lastRun = integration.syncRuns[0];
    return {
      source: integration.source as IntegrationSource,
      mode: integration.mode,
      oauthStatus: integration.oauthStatus,
      lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
      freshnessThresholdHours: integration.freshnessThresholdHours,
      isStale:
        hoursSinceSync === null ||
        hoursSinceSync > integration.freshnessThresholdHours,
      hoursSinceSync,
      lastSyncStatus: lastRun ? lastRun.status : null,
      lastSyncRecordsRead: lastRun ? lastRun.recordsRead : null,
    };
  });
}
