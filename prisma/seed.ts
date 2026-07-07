/**
 * prisma/seed.ts — demo dataset seeder entry (Alpha, PRD 25.1 / section 20).
 *
 * Seeds TWO demo accounts:
 *
 * 1. Shopify DTC — the deterministic demo merchant from lib/demo (fixed seed +
 *    fixed reference date): Shopify DTC Constitution v1, mock integrations,
 *    ~1215 customers, 150 products, ~5000 events, existing pre-Operator
 *    Klaviyo flows (26B.11), recipe configs, and one completed win-back action
 *    with a measured holdout for performance history (PRD 20.4).
 * 2. LOCAL vertical pack — "Cardamom & Rye" bakery-café from lib/demo/local
 *    (own fixed seed, same reference date): Square-like POS + Mailchimp-like
 *    email + Google Business Profile, 640 identified customers plus an
 *    anonymous walk-in mass (identified share ~65%, persisted for the POS
 *    coverage disclosure), 40 products, ~7000 POS events, and one completed
 *    email action measured before/after with NO holdout (audience 210 < 500).
 *
 * Idempotent — re-running replaces both demo accounts. Run with: npm run seed
 */

import db from "../lib/db";
import { loadDemoDataset, seedDemoDatabase } from "../lib/demo";
import { loadLocalDemoDataset, seedLocalDemoDatabase } from "../lib/demo/local";

async function main(): Promise<void> {
  const dataset = loadDemoDataset();
  const summary = await seedDemoDatabase(dataset);
  console.log("[seed] demo account seeded:");
  console.log(JSON.stringify(summary, null, 2));

  const localDataset = loadLocalDemoDataset();
  const localSummary = await seedLocalDemoDatabase(localDataset);
  console.log("[seed] LOCAL demo account seeded:");
  console.log(JSON.stringify(localSummary, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
