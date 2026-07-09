/**
 * tests/demo-provisioning.test.ts — hardening pass 2, item 3 (+ item 7 trust
 * invariants on the touched provisioning path).
 *
 * Pins the split between the safe resolver and the reset path:
 *   - ensureDemoAccount reuses the seeded workspace and NEVER resets — a
 *     forged `reset: true` is stripped at validation and destroys nothing;
 *   - resetDemoWorkspace is the ONLY reset path and actually reseeds;
 *   - both keep the demo clearly labeled (demoMode: true — PRD 20.3) and
 *     route the vertical correctly (trust rule #10).
 *
 * NOTE: resetDemoWorkspace reseeds the shared DTC demo workspace, so this
 * file runs in its OWN node --test invocation AFTER the other security suites
 * (see package.json test:security) — never in parallel with suites that read
 * the seeded demo accounts.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { db } from "../lib/db";
import { ensureDemoAccount } from "../lib/server";
import { resetDemoWorkspace } from "../lib/server/onboarding/actions";

const MARKER_KEY = "hardening2_provisioning_marker";

after(async () => {
  await db.$disconnect();
});

test("ensureDemoAccount is idempotent: second call reuses the workspace without reseeding", async () => {
  const first = await ensureDemoAccount();
  const second = await ensureDemoAccount();
  assert.equal(second.accountId, first.accountId);
  assert.equal(second.seeded, false, "an existing workspace must be reused, not reseeded");
  assert.equal(second.demoMode, true, "demo must be clearly labeled (PRD 20.3)");
  assert.equal(second.vertical, "shopify_dtc");
});

test("ensureDemoAccount NEVER resets — a forged reset flag is stripped and destroys nothing", async () => {
  const account = await ensureDemoAccount();
  await db.preference.upsert({
    where: { accountId_key: { accountId: account.accountId, key: MARKER_KEY } },
    create: {
      accountId: account.accountId,
      key: MARKER_KEY,
      value: { plantedAt: new Date().toISOString() },
      source: "explicit",
    },
    update: { value: { plantedAt: new Date().toISOString() } },
  });

  // Hostile call shape: the old createDemoAccount accepted { reset: true };
  // the new safe resolver must strip it (zod object schemas drop unknown
  // fields) and keep the workspace intact.
  const result = await ensureDemoAccount({ reset: true } as never);
  assert.equal(result.seeded, false, "ensureDemoAccount must never reseed");
  assert.equal(result.accountId, account.accountId);

  const marker = await db.preference.findUnique({
    where: { accountId_key: { accountId: account.accountId, key: MARKER_KEY } },
  });
  assert.ok(marker, "workspace state must survive ensureDemoAccount unchanged");
});

test("resetDemoWorkspace is THE reset path: wipes the marker and reseeds a labeled demo workspace", async () => {
  const before = await ensureDemoAccount();
  const marker = await db.preference.findUnique({
    where: { accountId_key: { accountId: before.accountId, key: MARKER_KEY } },
  });
  assert.ok(marker, "precondition: marker planted by the previous test");

  const result = await resetDemoWorkspace();
  assert.equal(result.seeded, true, "reset must reseed the demo dataset");
  assert.equal(result.demoMode, true, "demo must stay clearly labeled (PRD 20.3)");
  assert.equal(result.vertical, "shopify_dtc");

  const survivors = await db.preference.findMany({ where: { key: MARKER_KEY } });
  assert.equal(survivors.length, 0, "reset must wipe pre-reset workspace state");

  // The demo loop still works end-to-end after a reset (reuse path resolves).
  const reresolved = await ensureDemoAccount();
  assert.equal(reresolved.accountId, result.accountId);
  assert.equal(reresolved.seeded, false);
});

test("ensureDemoAccount routes verticals (trust rule #10) and keeps LOCAL reuse semantics", async () => {
  const local = await ensureDemoAccount({ vertical: "local_service" });
  assert.equal(local.vertical, "local_service");
  assert.equal(local.demoMode, true);

  const again = await ensureDemoAccount({ vertical: "local_service" });
  assert.equal(again.accountId, local.accountId);
  assert.equal(again.seeded, false, "LOCAL workspace must also be reused, never reseeded");

  const dtc = await ensureDemoAccount({ vertical: "shopify_dtc" });
  assert.notEqual(dtc.accountId, local.accountId, "verticals resolve distinct workspaces");
});
