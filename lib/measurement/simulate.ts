/**
 * lib/measurement/simulate.ts — simulated performance examples (PRD 20.4 + 25.1).
 *
 * "Demo measurement includes one holdout example, one no-control example,
 * and one directional Meta example."
 *
 * Everything here is DETERMINISTIC (seeded PRNG) and runs the REAL Prove-It
 * pipeline: simulated outcome events -> computeArmOutcomes -> computeLiftRange
 * -> readout builders. The performance screen renders the same shapes it will
 * render against live data in beta; only the events are synthetic.
 *
 * Demo mode rules (PRD 20.3): callers must label these as demo — the ids all
 * carry a "demo-" prefix so no simulated result can pass as real data.
 */

import type { MeasurementReadout } from "../contracts";
import { checkContamination } from "./contamination";
import { assignArm, type HoldoutArm } from "./holdout";
import {
  computeArmOutcomes,
  computeLiftRange,
  type OutcomeEvent,
} from "./lift";
import {
  buildBeforeAfterReadout,
  buildDirectionalReadout,
  buildHoldoutReadout,
} from "./readouts";
import { getWindow } from "./windows";

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32. Deterministic across runs and platforms.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed anchor so demo readouts are stable across sessions. */
export const DEMO_LAUNCH_DATE = new Date("2026-06-01T00:00:00.000Z");

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Example 1 — HOLDOUT: abandoned checkout recovery flow (PRD 14.5)
// ---------------------------------------------------------------------------

export interface SimulatedHoldoutExample {
  readout: MeasurementReadout;
  /** The raw arm outcomes, for the Context Ledger simulation. */
  arms: { treatedSize: number; heldOutSize: number };
}

/**
 * 2,000 eligible customers, 10% seeded-hash holdout, treated arm converts at
 * ~8.5% vs ~4.5% baseline, ~5% of purchases partially refunded. The demo
 * merchant also has a pre-existing Klaviyo abandoned-cart flow (26B.11) that
 * overlaps a handful of held-out customers — so this example exercises the
 * PRD 14.4 contamination disclosure too.
 */
export function simulateHoldoutExample(): SimulatedHoldoutExample {
  const seed = "demo-holdout-acr";
  const rand = mulberry32(20260601);
  const launchedAt = DEMO_LAUNCH_DATE;
  const window = getWindow("abandoned_checkout_recovery", launchedAt, "primary");

  // Assign arms with the production assignment function.
  const arms = new Map<string, HoldoutArm>();
  const customerIds: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const id = `demo-cust-${String(i).padStart(4, "0")}`;
    customerIds.push(id);
    arms.set(id, assignArm(seed, id, 10));
  }

  // Simulate outcome events inside the 7-day primary window.
  const events: OutcomeEvent[] = [];
  for (const id of customerIds) {
    const arm = arms.get(id) as HoldoutArm;
    const purchaseProb = arm === "treated" ? 0.085 : 0.045;
    if (rand() < purchaseProb) {
      const value = 55 + Math.round(rand() * 70); // $55-$125 order
      const offsetMs = Math.floor(rand() * 7 * DAY_MS);
      const ts = new Date(launchedAt.getTime() + offsetMs).toISOString();
      events.push({
        customerId: id,
        eventType: "purchase",
        eventTimestamp: ts,
        value,
      });
      if (rand() < 0.05) {
        events.push({
          customerId: id,
          eventType: "refund",
          eventTimestamp: ts,
          value: value * 0.6,
        });
      }
    }
  }

  const outcomes = computeArmOutcomes(events, arms, window);

  // Contamination: existing merchant recovery flow reaches 3 held-out emails.
  const heldOutIds = customerIds.filter((id) => arms.get(id) === "held_out");
  const heldOutEmails = heldOutIds.map((id) => `${id}@demo.example.com`);
  const contamination = checkContamination({
    holdoutEmailsLower: heldOutEmails,
    sources: [
      {
        type: "klaviyo_abandoned_cart_flow",
        name: "Legacy Abandoned Cart (pre-Operator)",
        active: true,
        memberEmailsLower: heldOutEmails.slice(0, 3),
        membershipIsProxy: false,
      },
    ],
  });

  const lift = computeLiftRange({
    treated: outcomes.treated,
    heldOut: outcomes.heldOut,
    contaminationRisk: contamination.risk,
    lowerConfidence: contamination.lowerConfidence,
    caveats: contamination.caveats,
  });

  const readout = buildHoldoutReadout({
    actionId: "demo-action-holdout-acr",
    window,
    lift,
    contaminationRisk: contamination.risk,
    actionName: "Abandoned checkout recovery flow (demo)",
    eligibleAudience: customerIds.length,
    holdoutSize: outcomes.heldOut.size,
    exposedSize: outcomes.treated.size,
  });

  return {
    readout,
    arms: {
      treatedSize: outcomes.treated.size,
      heldOutSize: outcomes.heldOut.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Example 2 — BEFORE/AFTER, NO CONTROL: lapsed win-back, audience < 500 (PRD 14.6)
// ---------------------------------------------------------------------------

export function simulateBeforeAfterExample(): MeasurementReadout {
  const launchedAt = DEMO_LAUNCH_DATE;
  const window = getWindow("lapsed_winback", launchedAt, "primary"); // 21 days

  const beforeStart = new Date(launchedAt.getTime() - 21 * DAY_MS);

  return buildBeforeAfterReadout({
    actionId: "demo-action-noctrl-winback",
    window,
    before: {
      start: beforeStart.toISOString(),
      end: launchedAt.toISOString(),
      purchases: 11,
      revenue: 924,
      refunds: 78,
    },
    after: {
      start: window.start,
      end: window.end,
      purchases: 19,
      revenue: 1642,
      refunds: 96,
    },
    actionName: "Lapsed customer win-back campaign (demo)",
    whyNoControl:
      "Eligible audience was 312 customers — below the 500 minimum for a holdout (PRD 14.6), so no control group was assigned.",
  });
}

// ---------------------------------------------------------------------------
// Example 3 — DIRECTIONAL: high-LTV Meta seed + suppression sync (PRD 14.7 + 15)
// ---------------------------------------------------------------------------

export function simulateDirectionalMetaExample(): MeasurementReadout {
  const launchedAt = DEMO_LAUNCH_DATE;
  const window = getWindow("meta_seed_suppression", launchedAt, "primary"); // 14 days

  return buildDirectionalReadout({
    actionId: "demo-action-directional-meta",
    window,
    metrics: {
      audience_created: "High-LTV Seed (top 15% by refund-adjusted value)",
      audience_size: 438,
      match_rate: "82%",
      sync_status: "accepted",
      last_synced: launchedAt.toISOString(),
      used_in_campaign: "Prospecting — Lookalike 1% (demo ad set)",
      downstream_purchases: 18,
      new_customer_rate: "61% of downstream purchases were new customers",
      prior_period_comparison:
        "Purchases from this audience: 18 vs 13 in the prior 14 days (non-causal)",
    },
    actionName: "High-LTV Meta seed + purchaser suppression (demo)",
    summary:
      "Seed audience of 438 high-LTV customers synced to Meta and was accepted with an 82% match rate. Recent purchasers are suppressed. Over the 14-day read, 18 purchases were observed from the synced audience vs 13 in the prior period — a directional signal only; no causal claim can be made from this data.",
  });
}

// ---------------------------------------------------------------------------
// PRD 20.4 bundle — one call for the performance screen
// ---------------------------------------------------------------------------

export interface PerformanceExamples {
  /** Holdout-verified example (abandoned checkout recovery). */
  holdout: MeasurementReadout;
  /** Before/after no-control example (lapsed win-back, audience < 500). */
  beforeAfterNoControl: MeasurementReadout;
  /** Directional Meta example (seed + suppression sync). */
  directionalMeta: MeasurementReadout;
}

/**
 * The three demo readouts the performance screen must show (PRD 20.4):
 * one holdout example, one no-control example, one directional Meta example.
 * Deterministic — safe to call on every render.
 */
export function simulatePerformanceExamples(): PerformanceExamples {
  return {
    holdout: simulateHoldoutExample().readout,
    beforeAfterNoControl: simulateBeforeAfterExample(),
    directionalMeta: simulateDirectionalMetaExample(),
  };
}
