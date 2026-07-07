/**
 * lib/recipes/meta-seed.ts — Recipe 3: High-LTV Meta Seed + Purchaser Suppression.
 *
 * PRD 10.4 + 26A/26B trust rules enforced here:
 *  - Seed = top `seedPercentile`% (default 15) of purchasers by a deterministic
 *    composite of total revenue, purchase frequency, recency, and refund-adjusted value.
 *  - Suppression = purchasers within `recentPurchaserWindowDays` (default 30).
 *  - NO dollar estimate, EVER (estimate === null). Directional measurement only.
 *  - No lift/incrementality/recovered-revenue/causal language anywhere in copy
 *    (META_DISALLOWED_TERMS).
 *  - consentAds (26B.13) gates seed eligibility; identifiers hashed at sync (26A.8).
 */

import type {
  Customer,
  ExplanationContract,
  RecipeInput,
  RecipeResult,
} from "../contracts";
import { scoreConfidence } from "./confidence";
import { buildMetaMeasurementPlan } from "./measurement-plan";
import {
  MS_PER_DAY,
  allSourcesFresh,
  customerSortKey,
  identityJoinCoverage,
  isPurchaseEvent,
  percentileRanks,
  sortCustomers,
} from "./shared";
import {
  RECIPE_VERSION,
  type ExclusionTally,
  type RecipeDataSnapshot,
} from "./types";

/** Refund-heavy threshold — excluded from seed (PRD 10.4). */
const REFUND_HEAVY_RATE = 0.3;

export function runMetaSeedSuppression(
  input: RecipeInput<"meta_seed_suppression">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"meta_seed_suppression"> {
  const cfg = input.config;
  const asOfMs = new Date(input.dataAsOf).getTime();

  const customers = sortCustomers(snapshot.customers);
  const manualExcluded = new Set(snapshot.manualExclusionCustomerIds);

  // Last purchase per customer (aggregate field, falling back to events).
  const lastPurchaseMs = new Map<string, number>();
  for (const c of customers) {
    if (c.lastPurchaseDate) lastPurchaseMs.set(c.id, c.lastPurchaseDate.getTime());
  }
  for (const e of snapshot.events) {
    if (!isPurchaseEvent(e) || !e.customerId) continue;
    const t = e.eventTimestamp.getTime();
    const prev = lastPurchaseMs.get(e.customerId);
    if (prev === undefined || t > prev) lastPurchaseMs.set(e.customerId, t);
  }

  const purchasers = customers.filter(
    (c) => c.totalOrders > 0 || lastPurchaseMs.has(c.id),
  );

  // ---- Composite LTV score (PRD 10.4: revenue, frequency, recency, refund-adjusted) ----
  const revenue = purchasers.map((c) => c.totalRevenue);
  const frequency = purchasers.map((c) => c.totalOrders);
  const recencyScore = purchasers.map((c) => {
    const last = lastPurchaseMs.get(c.id);
    // more recent -> larger score (negative age)
    return last !== undefined ? -(asOfMs - last) / MS_PER_DAY : Number.NEGATIVE_INFINITY;
  });
  const refundAdjusted = purchasers.map(
    (c) => c.totalRevenue * (1 - (c.refundRate ?? 0)),
  );
  const r1 = percentileRanks(revenue);
  const r2 = percentileRanks(frequency);
  const r3 = percentileRanks(recencyScore);
  const r4 = percentileRanks(refundAdjusted);
  const scored = purchasers
    .map((c, i) => ({ c, score: (r1[i] + r2[i] + r3[i] + r4[i]) / 4 }))
    .sort((a, b) => b.score - a.score || (customerSortKey(a.c) < customerSortKey(b.c) ? -1 : 1));

  const seedTarget = Math.ceil((scored.length * cfg.seedPercentile) / 100);
  const topCandidates = scored.slice(0, seedTarget).map((s) => s.c);

  // ---- Seed exclusions (PRD 10.4) ----
  const tally = new Map<string, number>();
  const bump = (reason: string) => tally.set(reason, (tally.get(reason) ?? 0) + 1);
  const seed: Customer[] = [];
  for (const c of topCandidates) {
    if ((c.refundRate ?? 0) >= REFUND_HEAVY_RATE) {
      bump("refund-heavy customer");
      continue;
    }
    if (c.suppressionStatus !== "none") {
      bump("suppressed user");
      continue;
    }
    if (c.emailLower == null) {
      bump("no destination-compatible identifier (lowercase email for hashing)");
      continue;
    }
    if (!c.consentAds) {
      bump("ad-audience consent unclear or opted out (26B.13)");
      continue;
    }
    if (manualExcluded.has(c.id)) {
      bump("manually excluded by merchant");
      continue;
    }
    seed.push(c);
  }
  const seedExclusions: ExclusionTally[] = [...tally.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([reason, count]) => ({ reason, count }));

  // ---- Suppression audience: recent purchasers (PRD 10.4) ----
  const windowMs = cfg.recentPurchaserWindowDays * MS_PER_DAY;
  let suppressionNoIdentifier = 0;
  const suppression: Customer[] = [];
  for (const c of purchasers) {
    const last = lastPurchaseMs.get(c.id);
    if (last === undefined || asOfMs - last > windowMs) continue;
    if (c.emailLower == null) {
      // excluded from suppression ONLY when identifier is missing (PRD 10.4)
      suppressionNoIdentifier += 1;
      continue;
    }
    suppression.push(c);
  }

  // ---- Measurement + confidence (directional ALWAYS -> confidence Low per PRD 11.2) ----
  const measurementPlan = buildMetaMeasurementPlan();
  const { confidence, inputs: confidenceInputs } = scoreConfidence({
    dataFresh: allSourcesFresh(snapshot),
    audienceSize: seed.length,
    consentRatio: topCandidates.length > 0 ? seed.length / topCandidates.length : 0,
    baseline: "none", // no dollar estimate exists by design
    activationLevel: "meta_audience_sync",
    measurementMode: "directional",
    sourceCompleteness: identityJoinCoverage(customers),
    recipeMaturity: "new",
  });

  // ---- Explanation contract (PRD 4.4) — NO dollar figures, NO causal language ----
  const explanation: ExplanationContract = {
    found: `A high-LTV seed of ${seed.length} customers (top ${cfg.seedPercentile}% of ${purchasers.length} purchasers by revenue, frequency, recency, and refund-adjusted value) plus a suppression audience of ${suppression.length} recent purchasers (last ${cfg.recentPurchaserWindowDays} days).`,
    whyItMatters:
      "Seeding Meta with your best customers improves lookalike quality, and suppressing recent purchasers avoids paying to re-acquire people who just bought. No dollar estimate is shown for this opportunity — Meta reporting here is directional only.",
    dataUsed: [
      "Shopify order history (total revenue, order counts, last purchase date)",
      "Refund rates (refund-adjusted value)",
      "Ad-audience consent status with provenance (26B.13)",
      "Destination-compatible identifiers (lowercase email, hashed before sync — 26A.8)",
      "Suppression list and manual exclusions",
    ],
    dataFreshness: snapshot.freshness,
    assumptions: [
      `Composite ranking averages percentile ranks of total revenue, purchase frequency, recency, and refund-adjusted revenue; top ${cfg.seedPercentile}% selected (configurable 10-20%).`,
      "No revenue estimate is made: audience sync outcomes cannot be verified causally in v0, so this card carries no dollar value and is never counted in the found-money header.",
    ],
    risk: "Audience sync shares hashed customer identifiers with Meta. Requires confirmation that the merchant has the right to use these identifiers for ad-platform audience creation (26A.8). Customers without clear ad consent are already excluded.",
    approvalNeeded:
      "Nothing syncs until explicit approval (26A.4). On approval: create Meta custom audience + lookalike seed, create recent-purchaser suppression audience, log destination status and identifier-compatibility check (26A.8).",
    measurementPlan,
  };

  const result: RecipeResult<"meta_seed_suppression"> = {
    recipeId: "meta_seed_suppression",
    recipeVersion: RECIPE_VERSION,
    title: "Seed Meta with high-LTV customers + suppress recent purchasers",
    category: "paid_audience",
    sourceSignal: `Shopify orders — top ${cfg.seedPercentile}% purchasers by composite LTV; purchasers within ${cfg.recentPurchaserWindowDays} days for suppression`,
    audience: {
      name: `High-LTV seed (top ${cfg.seedPercentile}%)`,
      inclusionRules: {
        rankedBy: ["total_revenue", "purchase_frequency", "recency", "refund_adjusted_value"],
        topPercentile: cfg.seedPercentile,
        purchasersConsidered: purchasers.length,
        adsConsentRequired: true,
        destinationIdentifierRequired: true,
      },
      exclusionRules: Object.fromEntries(seedExclusions.map((e) => [e.reason, e.count])),
      size: seed.length,
      eligibleChannels: ["meta_audience"],
      customerIds: seed.map((c) => c.id),
    },
    suppressionAudience: {
      name: `Recent purchasers (last ${cfg.recentPurchaserWindowDays} days)`,
      inclusionRules: {
        purchasedWithinDays: cfg.recentPurchaserWindowDays,
      },
      exclusionRules: {
        "no destination-compatible identifier": suppressionNoIdentifier,
      },
      size: suppression.length,
      eligibleChannels: ["meta_audience"],
      customerIds: suppression.map((c) => c.id),
    },
    exclusionsApplied: [
      ...seedExclusions.map((e) => `seed: ${e.reason} (${e.count})`),
      `suppression: no destination-compatible identifier (${suppressionNoIdentifier})`,
    ],
    estimate: null, // PRD 10.4 — no recovered-revenue estimate, ever
    confidence,
    confidenceInputs,
    recommendedAction: "meta_audience_sync",
    activationLevel: "meta_audience_sync",
    measurementPlan,
    explanation,
    dataAsOf: input.dataAsOf,
    dedupKey: `${input.accountId}:${input.recipeId}`,
  };

  if (seed.length === 0) {
    result.noOpportunity = {
      checked: [
        { what: "purchasers ranked", count: purchasers.length },
        { what: "top-percentile candidates", count: topCandidates.length },
        { what: "eligible after consent/identifier/refund exclusions", count: seed.length },
      ],
      whyNotQualified:
        purchasers.length === 0
          ? "No customers with purchase history were found."
          : `All ${topCandidates.length} top-percentile candidates were excluded: ${seedExclusions.map((e) => `${e.reason} (${e.count})`).join(", ")}.`,
      nearestNextAction: "Run the abandoned checkout recovery scan.",
      unlocks:
        "More ad-consent coverage (or connecting Meta) would unlock audience sync opportunities.",
    };
  }

  return result;
}
