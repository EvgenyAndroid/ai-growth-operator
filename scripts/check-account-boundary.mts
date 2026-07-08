/**
 * scripts/check-account-boundary.mts — P4/P5 acceptance check.
 *
 * Proves, against BOTH seeded demo accounts, that:
 *  1. a forged accountId cannot read or mutate another account from a
 *     request-shaped vertical context (the exact guard path browser requests
 *     take — simulated via runWithVerticalContext);
 *  2. non-existent and non-demo accounts are always rejected (fail closed),
 *     with an error that never echoes the forged id;
 *  3. invalid inputs are rejected at entry with user-safe messages (zod
 *     schemas in lib/server/validation.ts) before any DB write;
 *  4. legitimate demo flows still work (positive controls, read-only).
 *
 * Run with: npm run check:accounts
 * (node --conditions react-server --import tsx scripts/check-account-boundary.mts)
 * Prints PASS/FAIL per check; exits nonzero on any failure.
 */

import { db } from "../lib/db";
import {
  assertAccountAccess,
  getCurrentAccountContext,
  runWithVerticalContext,
} from "../lib/server/account-context";
import { rejectAction } from "../lib/server/actions";
import { operatorChat } from "../lib/server/chat";
import { exportState } from "../lib/server/export";
import { getOperatingRules, saveOperatingRules } from "../lib/server/onboarding";
import { createDemoAccount } from "../lib/server";
import { dismissOpportunity, listOpportunities } from "../lib/server/opportunities";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Run fn, expect it to throw; return the error message (or null if no throw). */
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

async function main(): Promise<void> {
  // --- setup: both demo workspaces (idempotent) ------------------------------
  const dtc = await createDemoAccount({ vertical: "shopify_dtc" });
  const local = await createDemoAccount({ vertical: "local_service" });
  check(
    "setup: both demo accounts resolve (DTC + LOCAL)",
    dtc.accountId !== local.accountId && dtc.demoMode && local.demoMode,
    JSON.stringify({ dtc: dtc.accountName, local: local.accountName }),
  );

  // --- positive controls (read-only; demo flows keep working) ----------------
  const dtcFeed = await runWithVerticalContext("shopify_dtc", () =>
    listOpportunities(dtc.accountId),
  );
  check(
    "positive: DTC context reads the DTC feed",
    dtcFeed.accountId === dtc.accountId && dtcFeed.vertical === "shopify_dtc",
  );
  const localFeed = await runWithVerticalContext("local_service", () =>
    listOpportunities(local.accountId),
  );
  check(
    "positive: LOCAL context reads the LOCAL feed",
    localFeed.accountId === local.accountId && localFeed.vertical === "local_service",
  );
  const rules = await runWithVerticalContext("shopify_dtc", () =>
    getOperatingRules(dtc.accountId),
  );
  check("positive: DTC context reads DTC Operating Rules", rules.version >= 1);
  const context = await runWithVerticalContext("local_service", () =>
    getCurrentAccountContext(),
  );
  check(
    "positive: resolver returns the LOCAL demo account under LOCAL context",
    context !== null &&
      context.account.id === local.accountId &&
      context.source === "override",
  );

  // --- forged accountId across accounts (request-shaped context) -------------
  const forgedRead = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () => listOpportunities(local.accountId)),
  );
  check(
    "boundary: DTC context CANNOT read the LOCAL account's feed",
    isUserSafe(forgedRead, local.accountId),
    forgedRead ?? "no error was thrown",
  );
  const forgedReadReverse = await expectThrow(() =>
    runWithVerticalContext("local_service", () => listOpportunities(dtc.accountId)),
  );
  check(
    "boundary: LOCAL context CANNOT read the DTC account's feed",
    isUserSafe(forgedReadReverse, dtc.accountId),
    forgedReadReverse ?? "no error was thrown",
  );

  // Forged MUTATIONS must be rejected before anything is written.
  const localLedgerBefore = await db.ledgerEntry.count({
    where: { accountId: local.accountId },
  });
  const localConstitutionsBefore = await db.constitution.count({
    where: { accountId: local.accountId },
  });
  const forgedRules = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      saveOperatingRules({
        accountId: local.accountId,
        monthlyBudgetCap: 1,
        maxDiscountPercent: 1,
        dailySendCap: 1,
      }),
    ),
  );
  check(
    "boundary: DTC context CANNOT save Operating Rules on the LOCAL account",
    isUserSafe(forgedRules, local.accountId),
    forgedRules ?? "no error was thrown",
  );
  const localOpp = await db.opportunity.findFirst({
    where: { accountId: local.accountId },
  });
  const forgedDismiss = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      dismissOpportunity({
        accountId: local.accountId,
        opportunityId: localOpp?.id ?? "unknown-opportunity",
        reason: "forged cross-account dismissal attempt",
      }),
    ),
  );
  check(
    "boundary: DTC context CANNOT dismiss a LOCAL opportunity",
    isUserSafe(forgedDismiss, local.accountId),
    forgedDismiss ?? "no error was thrown",
  );
  const forgedExport = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      exportState({ accountId: local.accountId, objectType: "customers" }),
    ),
  );
  check(
    "boundary: DTC context CANNOT export the LOCAL account's customers",
    isUserSafe(forgedExport, local.accountId),
    forgedExport ?? "no error was thrown",
  );
  const forgedChat = await expectThrow(() =>
    runWithVerticalContext("local_service", () =>
      operatorChat({ accountId: dtc.accountId, input: "what should I do this week?" }),
    ),
  );
  check(
    "boundary: LOCAL context CANNOT drive Operator Chat on the DTC account",
    isUserSafe(forgedChat, dtc.accountId),
    forgedChat ?? "no error was thrown",
  );
  const localLedgerAfter = await db.ledgerEntry.count({
    where: { accountId: local.accountId },
  });
  const localConstitutionsAfter = await db.constitution.count({
    where: { accountId: local.accountId },
  });
  check(
    "boundary: forged mutation attempts wrote NOTHING to the target account",
    localLedgerAfter === localLedgerBefore &&
      localConstitutionsAfter === localConstitutionsBefore,
    JSON.stringify({
      ledger: [localLedgerBefore, localLedgerAfter],
      constitutions: [localConstitutionsBefore, localConstitutionsAfter],
    }),
  );

  // --- unknown + non-demo accounts always fail closed ------------------------
  const ghost = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      listOpportunities("cnonexistent0000000000000"),
    ),
  );
  check(
    "boundary: non-existent accountId is rejected (no probing signal)",
    isUserSafe(ghost, "cnonexistent0000000000000"),
    ghost ?? "no error was thrown",
  );
  const liveAccount = await db.account.create({
    data: { name: "Boundary Check Live Co", vertical: "shopify_dtc", demoMode: false },
  });
  try {
    const liveInRequest = await expectThrow(() =>
      runWithVerticalContext("shopify_dtc", () => assertAccountAccess(liveAccount.id)),
    );
    check(
      "boundary: non-demo account rejected in request context (alpha is demo-only)",
      isUserSafe(liveInRequest, liveAccount.id),
      liveInRequest ?? "no error was thrown",
    );
    const liveInScript = await expectThrow(() => assertAccountAccess(liveAccount.id));
    check(
      "boundary: non-demo account rejected even in trusted script scope",
      isUserSafe(liveInScript, liveAccount.id),
      liveInScript ?? "no error was thrown",
    );
  } finally {
    await db.account.delete({ where: { id: liveAccount.id } });
  }

  // --- P5: invalid input rejected at entry with user-safe errors -------------
  const badId = await expectThrow(() => listOpportunities("../../etc/passwd"));
  check(
    "validation: path-traversal-shaped accountId rejected at entry",
    badId !== null && badId.includes("Invalid input") && isUserSafe(badId),
    badId ?? "no error was thrown",
  );
  const blankReason = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      dismissOpportunity({
        accountId: dtc.accountId,
        opportunityId: "cfakeopportunity000000000",
        reason: "   ",
      }),
    ),
  );
  check(
    "validation: blank dismissal reason rejected before any lookup",
    blankReason !== null && blankReason.includes("Invalid input") && isUserSafe(blankReason),
    blankReason ?? "no error was thrown",
  );
  const hugeReason = await expectThrow(() =>
    rejectAction({
      accountId: dtc.accountId,
      actionId: "cfakeaction00000000000000",
      reason: "x".repeat(5_000),
    }),
  );
  check(
    "validation: oversized rejection reason rejected (bounded text)",
    hugeReason !== null &&
      hugeReason.includes("Invalid input") &&
      !hugeReason.includes("xxxxx"), // never echoes the oversized payload
    hugeReason ?? "no error was thrown",
  );
  const badExport = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      exportState({
        accountId: dtc.accountId,
        objectType: "customers; DROP TABLE" as never,
      }),
    ),
  );
  check(
    "validation: unknown export objectType rejected by the enum schema",
    badExport !== null && isUserSafe(badExport),
    badExport ?? "no error was thrown",
  );
  const badRules = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      saveOperatingRules({
        accountId: dtc.accountId,
        monthlyBudgetCap: Number.POSITIVE_INFINITY,
        maxDiscountPercent: 250,
        dailySendCap: -5,
      }),
    ),
  );
  check(
    "validation: non-finite / out-of-range Operating Rules numbers rejected",
    badRules !== null && badRules.includes("Invalid input") && isUserSafe(badRules),
    badRules ?? "no error was thrown",
  );
  const hugeChat = await expectThrow(() =>
    runWithVerticalContext("shopify_dtc", () =>
      operatorChat({ accountId: dtc.accountId, input: "y".repeat(10_000) }),
    ),
  );
  check(
    "validation: oversized chat input rejected (bounded, never echoed)",
    hugeChat !== null && hugeChat.includes("Invalid input") && !hugeChat.includes("yyyyy"),
    hugeChat ?? "no error was thrown",
  );
}

main()
  .catch((err) => {
    console.error("FAIL  account-boundary check crashed:", err);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    console.log(
      failures > 0
        ? `[check:accounts] ${failures} check(s) failed`
        : "[check:accounts] all checks passed",
    );
    process.exitCode = failures > 0 ? 1 : 0;
  });
