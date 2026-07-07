/**
 * prisma/seed.ts — demo dataset seeder entry (Alpha, PRD 25.1 / section 20).
 *
 * Loads the deterministic demo merchant from lib/demo (fixed seed + fixed
 * reference date) and writes it to the database: one demo Account, Shopify
 * DTC Constitution v1, mock integrations with freshness timestamps, ~1215
 * customers, 150 products, ~5000 events, existing pre-Operator Klaviyo flows
 * (26B.11), recipe configs, and one completed win-back action with a measured
 * holdout for performance history (PRD 20.4).
 *
 * Idempotent — re-running replaces the demo account. Run with: npm run seed
 */

import db from "../lib/db";
import { loadDemoDataset, seedDemoDatabase } from "../lib/demo";

async function main(): Promise<void> {
  const dataset = loadDemoDataset();
  const summary = await seedDemoDatabase(dataset);
  console.log("[seed] demo account seeded:");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
