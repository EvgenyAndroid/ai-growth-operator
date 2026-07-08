/**
 * tests/account-isolation.test.ts — P9/P4 account-boundary tests (node:test).
 *
 * Proves the central account guard (lib/server/account-context.ts) against
 * BOTH seeded demo workspaces using runWithVerticalContext — the exact strict
 * guard path a browser request takes. Read AND mutation attempts across
 * accounts must fail closed with a user-safe error that never echoes the
 * forged id, and must write NOTHING to the target account.
 *
 * Uses the idempotent demo seeder (no reset) — demo data is not modified by
 * any assertion here except read-only feeds and rejected mutations.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { db } from "../lib/db";
import {
  assertAccountAccess,
  runWithVerticalContext,
} from "../lib/server/account-context";
import { createDemoAccount } from "../lib/server";
import { exportState } from "../lib/server/export";
import { getOperatingRules, saveOperatingRules } from "../lib/server/onboarding";
import { listOpportunities } from "../lib/server/opportunities";

let dtcAccountId = "";
let localAccountId = "";

/** Run fn, expect a throw; return the message (null = did not throw). */
async function expectThrow(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function isUserSafe(message: string | null, forgedId?: string): boolean {
  if (message === null) return false;
  if (/\n\s+at /.test(message)) return false; // no stack traces
  if (forgedId && message.includes(forgedId)) return false; // no id echo
  return true;
}

before(async () => {
  const dtc = await createDemoAccount({ vertical: "shopify_dtc" });
  const local = await createDemoAccount({ vertical: "local_service" });
  dtcAccountId = dtc.accountId;
  localAccountId = local.accountId;
  assert.notEqual(dtcAccountId, localAccountId);
});

after(async () => {
  await db.$disconnect();
});

test("isolation: each vertical context reads ONLY its own workspace (positive control)", async () => {
  const dtcFeed = await runWithVerticalContext("shopify_dtc", () =>
    listOpportunities(dtcAccountId),
  );
  assert.equal(dtcFeed.accountId, dtcAccountId);
  const localFeed = await runWithVerticalContext("local_service", () =>
    listOpportunities(localAccountId),
  );
  assert.equal(localFeed.accountId, localAccountId);
});

test("isolation: a forged accountId cannot READ across accounts", async () => {
  const dtcReadsLocal = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () => listOpportunities(localAccountId)),
  );
  assert.ok(isUserSafe(dtcReadsLocal, localAccountId), dtcReadsLocal ?? "did not throw");

  const localReadsDtc = await expectThrow(() =>
    runWithVerticalContext("local_service", () => listOpportunities(dtcAccountId)),
  );
  assert.ok(isUserSafe(localReadsDtc, dtcAccountId), localReadsDtc ?? "did not throw");

  const localReadsDtcRules = await expectThrow(() =>
    runWithVerticalContext("local_service", () => getOperatingRules(dtcAccountId)),
  );
  assert.ok(isUserSafe(localReadsDtcRules, dtcAccountId));
});

test("isolation: a forged accountId cannot MUTATE across accounts (nothing written)", async () => {
  const constitutionsBefore = await db.constitution.count({
    where: { accountId: localAccountId },
  });
  const ledgerBefore = await db.ledgerEntry.count({
    where: { accountId: localAccountId },
  });

  const forgedRules = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      saveOperatingRules({
        accountId: localAccountId,
        monthlyBudgetCap: 999_999,
        maxDiscountPercent: 99,
        dailySendCap: 999_999,
      }),
    ),
  );
  assert.ok(isUserSafe(forgedRules, localAccountId), forgedRules ?? "did not throw");

  const forgedExport = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      exportState({ accountId: localAccountId, objectType: "customers" }),
    ),
  );
  assert.ok(isUserSafe(forgedExport, localAccountId), forgedExport ?? "did not throw");

  const constitutionsAfter = await db.constitution.count({
    where: { accountId: localAccountId },
  });
  const ledgerAfter = await db.ledgerEntry.count({
    where: { accountId: localAccountId },
  });
  assert.equal(constitutionsAfter, constitutionsBefore, "no forged Operating Rules version");
  assert.equal(ledgerAfter, ledgerBefore, "no forged ledger writes");
});

test("isolation: unknown and non-demo accounts always fail closed", async () => {
  const ghost = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      listOpportunities("cnonexistent0000000000000"),
    ),
  );
  assert.ok(isUserSafe(ghost, "cnonexistent0000000000000"), ghost ?? "did not throw");

  const live = await db.account.create({
    data: { name: "P9 Isolation Live Co", vertical: "shopify_dtc", demoMode: false },
  });
  try {
    const inRequestScope = await expectThrow(() =>
      runWithVerticalContext("shopify_dtc", () => assertAccountAccess(live.id)),
    );
    assert.ok(isUserSafe(inRequestScope, live.id), inRequestScope ?? "did not throw");

    const inScriptScope = await expectThrow(() => assertAccountAccess(live.id));
    assert.ok(
      isUserSafe(inScriptScope, live.id),
      inScriptScope ?? "did not throw (non-demo must be rejected in EVERY scope)",
    );
  } finally {
    await db.account.delete({ where: { id: live.id } });
  }
});

test("isolation: not-found and forbidden are indistinguishable (no id probing)", async () => {
  const notFound = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      listOpportunities("cnonexistent0000000000000"),
    ),
  );
  const forbidden = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () => listOpportunities(localAccountId)),
  );
  assert.equal(notFound, forbidden, "one message for both — accounts cannot be enumerated");
});
