/**
 * lib/server/onboarding/provision.ts — INTERNAL demo-workspace provisioning
 * (hardening pass 2, item 3).
 *
 * The single implementation behind the two public entry points:
 *   - ensureDemoAccount (./read.ts)      — reuse-or-create, NEVER resets
 *   - resetDemoWorkspace (./actions.ts)  — the ONLY reset path, guarded
 *
 * Not exported through the lib/server barrel and never imported by UI-facing
 * modules: callers choose intent through the narrow wrappers, so no broad
 * "seed/reset by params" function is reachable from the UI.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { DEMO_ACCOUNT_NAME, loadDemoDataset, seedDemoDatabase } from "../../demo";
import db from "../../db";
import type { Vertical } from "../../contracts";
import { provisionLocalDemoAccount } from "../local-demo";
import { toInputJson } from "../shared";
import type { DemoAccountResult } from "../types";

/**
 * Provision the demo workspace for a vertical (PRD 20.2, 25.1). Seeding is
 * idempotent — `reset: true` wipes and reseeds the demo account. INTERNAL:
 * reachable only via ensureDemoAccount (never resets) and resetDemoWorkspace
 * (guarded).
 */
export async function provisionDemoAccount(
  vertical: Vertical,
  options: { reset?: boolean } = {},
): Promise<DemoAccountResult> {
  if (vertical === "local_service") {
    return provisionLocalDemoAccount({ reset: options.reset });
  }

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
        vertical: "shopify_dtc",
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
    vertical: "shopify_dtc",
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
