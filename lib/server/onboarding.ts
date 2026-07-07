"use server";

/**
 * lib/server/onboarding.ts — onboarding + connection server actions.
 *
 * createDemoAccount  — PRD 20/25.1: seed (or reuse) the demo workspace
 * saveOperatingRules — PRD 12.3: three numbers -> NEW Constitution version
 * getOperatingRules  — current Operating Rules for the settings screen
 * getConnectionStatus— demo Integration cards + freshness (PRD 8.4)
 * resyncConnection   — PRD 8.5: "user can re-sync from the blocking message"
 */

import { DEMO_ACCOUNT_NAME, loadDemoDataset, seedDemoDatabase } from "../demo";
import db from "../db";
import type { IntegrationSource } from "../contracts";
import { writeLedger } from "../ledger";
import {
  accountClock,
  latestConstitution,
  requireAccount,
  requireConstitution,
  toInputJson,
} from "./shared";
import type {
  ConnectionStatusView,
  CreateDemoAccountResult,
  OperatingRulesView,
  SaveOperatingRulesInput,
} from "./types";

const MS_PER_HOUR = 3_600_000;

/**
 * Create (or reuse) the demo workspace (PRD 20.2, 25.1). Seeding is
 * idempotent — `reset: true` wipes and reseeds the demo account.
 */
export async function createDemoAccount(
  options: { reset?: boolean } = {},
): Promise<CreateDemoAccountResult> {
  if (!options.reset) {
    const existing = await db.account.findFirst({
      where: { name: DEMO_ACCOUNT_NAME, demoMode: true },
    });
    if (existing) {
      const [customers, products, events, integrations] = await Promise.all([
        db.customer.count({ where: { accountId: existing.id } }),
        db.product.count({ where: { accountId: existing.id } }),
        db.event.count({ where: { accountId: existing.id } }),
        db.integration.count({ where: { accountId: existing.id } }),
      ]);
      return {
        accountId: existing.id,
        accountName: existing.name,
        demoMode: true,
        seeded: false,
        referenceDate: loadDemoDataset().referenceDate,
        counts: { customers, products, events, integrations },
      };
    }
  }

  const summary = await seedDemoDatabase();

  // Bridge: the recipes loader reads the merchant's pre-existing Klaviyo flows
  // (26B.11 net-of-flows + 26A.5 exclusion source) from the Preference key
  // "existing_flows". The demo seeder persists flows as Audience rows, with
  // loadDemoDataset().existingFlows as the typed source of truth — materialize
  // that here so flow membership is "flow_membership", not "unavailable".
  const dataset = loadDemoDataset();
  await db.preference.upsert({
    where: {
      accountId_key: { accountId: summary.accountId, key: "existing_flows" },
    },
    create: {
      accountId: summary.accountId,
      key: "existing_flows",
      value: toInputJson(dataset.existingFlows),
      source: "explicit",
    },
    update: { value: toInputJson(dataset.existingFlows), source: "explicit" },
  });

  return {
    accountId: summary.accountId,
    accountName: summary.accountName,
    demoMode: true,
    seeded: true,
    referenceDate: summary.referenceDate,
    counts: {
      customers: summary.customers,
      products: summary.products,
      events: summary.events,
      integrations: summary.integrations,
    },
  };
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
  await requireAccount(input.accountId);

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

/** Current Operating Rules (latest Constitution version). */
export async function getOperatingRules(
  accountId: string,
): Promise<OperatingRulesView> {
  const constitution = await requireConstitution(accountId);
  return toOperatingRulesView(constitution);
}

function toOperatingRulesView(constitution: {
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
  const account = await requireAccount(accountId);
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
  const account = await requireAccount(params.accountId);
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
