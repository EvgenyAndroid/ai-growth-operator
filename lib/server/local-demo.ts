/**
 * lib/server/local-demo.ts — LOCAL vertical demo-workspace resolution
 * (café / bakery on Square-like POS + Mailchimp-like email + Google Business
 * Profile; PRD 25.1 demo-mode only).
 *
 * Mirrors the DTC path in ./onboarding.ts createDemoAccount: reuse the seeded
 * LOCAL demo account when it exists, otherwise run the deterministic
 * lib/demo/local seeder ("Cardamom & Rye"). The seeder engineers every local
 * audience BELOW the 500 holdout floor (before/after path) and persists the
 * POS identified-coverage share the LOCAL recipes read for the trust-rule-#9
 * disclosure. Called only from createDemoAccount — UI never imports this.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import {
  LOCAL_DEMO_ACCOUNT_NAME,
  loadLocalDemoDataset,
  seedLocalDemoDatabase,
} from "../demo/local";
import db from "../db";
import type { CreateDemoAccountResult } from "./types";

export { LOCAL_DEMO_ACCOUNT_NAME };

/**
 * Create (or reuse) the LOCAL demo workspace. Idempotent like the DTC path:
 * `reset: true` wipes and reseeds.
 */
export async function ensureLocalDemoAccount(
  options: { reset?: boolean } = {},
): Promise<CreateDemoAccountResult> {
  if (!options.reset) {
    const existing = await db.account.findFirst({
      where: { name: LOCAL_DEMO_ACCOUNT_NAME, demoMode: true },
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
        vertical: "local_service",
        demoMode: true,
        seeded: false,
        referenceDate: loadLocalDemoDataset().referenceDate,
        counts: { customers, products, events, integrations },
      };
    }
  }

  const summary = await seedLocalDemoDatabase();

  return {
    accountId: summary.accountId,
    accountName: summary.accountName,
    vertical: "local_service",
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
