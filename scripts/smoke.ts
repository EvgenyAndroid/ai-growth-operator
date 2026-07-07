/**
 * scripts/smoke.ts — smoke test entry point.
 *
 * FOUNDATION STUB: module phase extends this to exercise the full loop
 * (seed -> recipes -> governance -> draft -> approve -> activate -> measure)
 * against the demo dataset. For now it verifies the two things every module
 * depends on: the database schema is pushed and the contracts module loads.
 *
 * Run with: npm run smoke
 */

import db from "../lib/db";
import {
  MEASUREMENT_LABELS,
  RECIPE_IDS,
  RECIPE_CONFIG_DEFAULTS,
  isFoundMoneyEligible,
} from "../lib/contracts";

async function main(): Promise<void> {
  let failures = 0;
  const check = (name: string, ok: boolean) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failures += 1;
  };

  // DB reachable + core tables exist
  await db.account.count();
  await db.opportunity.count();
  await db.ledgerEntry.count();
  check("db: schema pushed and reachable", true);

  // Trust rules encoded in contracts
  check(
    "contracts: exactly three measurement labels",
    Object.keys(MEASUREMENT_LABELS).length === 3
  );
  check("contracts: exactly three v0 recipes", RECIPE_IDS.length === 3);
  check(
    "contracts: recipe defaults exist for every recipe",
    RECIPE_IDS.every((r) => r in RECIPE_CONFIG_DEFAULTS)
  );
  check(
    "contracts: Meta recipe never found-money eligible",
    !isFoundMoneyEligible({
      recipeId: "meta_seed_suppression",
      confidence: "high",
      estimateLabel: "modeled",
    })
  );
  check(
    "contracts: low confidence never found-money eligible",
    !isFoundMoneyEligible({
      recipeId: "abandoned_checkout_recovery",
      confidence: "low",
      estimateLabel: "merchant_historical",
    })
  );

  if (failures > 0) {
    console.error(`[smoke] ${failures} check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log("[smoke] all checks passed");
  }
}

main()
  .catch((err) => {
    console.error("[smoke] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
