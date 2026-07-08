/**
 * tests/recipes.test.ts — P9 recipe contract tests (node:test, deterministic,
 * pure in-memory snapshots — no database, no live services).
 *
 * Covers the brief's recipe requirements:
 *  - abandoned checkout: excludes purchasers, unsubscribed, suppressed (plus
 *    stale checkouts, no-consent, active-flow members, holdout members);
 *  - lapsed win-back: personal-cadence gate (>=3 purchases, >=2 intervals,
 *    no active refund dispute) + category-then-merchant fallbacks;
 *  - Meta seed: NO dollar estimate ever, never found-money eligible, and no
 *    lift/incrementality language in the explanation copy.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  META_DISALLOWED_TERMS,
  isFoundMoneyEligible,
  type Confidence,
} from "../lib/contracts";
import { runAbandonedCheckoutRecovery } from "../lib/recipes/abandoned-checkout";
import { runLapsedWinback } from "../lib/recipes/lapsed-winback";
import { runMetaSeedSuppression } from "../lib/recipes/meta-seed";
import {
  daysAgo,
  hoursAgo,
  makeCustomer,
  makeEvent,
  makeProduct,
  makeRecipeInput,
  makeSnapshot,
} from "./helpers";

// ---------------------------------------------------------------------------
// Recipe 1 — abandoned checkout recovery
// ---------------------------------------------------------------------------

function abandonedCheckoutFixture() {
  const eligible = makeCustomer({ id: "c_eligible" });
  const purchased = makeCustomer({ id: "c_purchased" });
  const unsubscribed = makeCustomer({ id: "c_unsub" });
  const suppressed = makeCustomer({
    id: "c_suppressed",
    suppressionStatus: "complaint",
  });
  const tooRecent = makeCustomer({ id: "c_recent" });
  const stale = makeCustomer({ id: "c_stale" });
  const flowMember = makeCustomer({ id: "c_flow" });
  const heldOut = makeCustomer({ id: "c_heldout" });
  const noConsent = makeCustomer({
    id: "c_noconsent",
    consentEmail: false,
    sourceCustomerIds: { shopify: "shp_c_noconsent" }, // no Klaviyo profile
  });

  const events = [
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: eligible.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: purchased.id }),
    makeEvent({ eventType: "purchase", eventTimestamp: daysAgo(1), customerId: purchased.id, value: 80 }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: unsubscribed.id }),
    makeEvent({ eventType: "unsubscribe", eventTimestamp: daysAgo(30), customerId: unsubscribed.id, source: "klaviyo" }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: suppressed.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: hoursAgo(1), customerId: tooRecent.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(20), customerId: stale.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: flowMember.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: heldOut.id }),
    makeEvent({ eventType: "checkout_started", eventTimestamp: daysAgo(2), customerId: noConsent.id }),
  ];

  const snapshot = makeSnapshot({
    customers: [
      eligible,
      purchased,
      unsubscribed,
      suppressed,
      tooRecent,
      stale,
      flowMember,
      heldOut,
      noConsent,
    ],
    events,
    existingFlows: [
      {
        type: "recovery",
        name: "Pre-existing abandoned cart flow",
        active: true,
        memberCustomerEmails: [flowMember.emailLower as string],
      },
    ],
    heldOutCustomerIdsByActionType: {
      klaviyo_recovery_flow: [heldOut.id],
    },
  });

  return { snapshot };
}

test("abandoned checkout: only the clean shopper qualifies; purchasers/unsubscribed/suppressed are excluded", () => {
  const { snapshot } = abandonedCheckoutFixture();
  const result = runAbandonedCheckoutRecovery(
    makeRecipeInput("abandoned_checkout_recovery"),
    snapshot,
  );

  assert.deepEqual(result.audience.customerIds, ["c_eligible"]);
  assert.equal(result.audience.size, 1);

  const reasons = Object.keys(result.audience.exclusionRules);
  const expectSubstring = (needle: string) =>
    assert.ok(
      reasons.some((reason) => reason.includes(needle)),
      `expected an exclusion reason containing "${needle}"; got: ${reasons.join(" | ")}`,
    );
  expectSubstring("purchased since checkout");
  expectSubstring("unsubscribed");
  expectSubstring("suppressed");
  expectSubstring("stale checkout");
  expectSubstring("no email consent");
  expectSubstring("already in active abandoned-checkout recovery flow");
  expectSubstring("already assigned to a holdout");

  // The <4h checkout is not yet abandoned — never counted as an exclusion.
  assert.ok(!reasons.some((reason) => reason.includes("c_recent")));
});

test("abandoned checkout: deterministic — same input + snapshot => identical output", () => {
  const { snapshot } = abandonedCheckoutFixture();
  const input = makeRecipeInput("abandoned_checkout_recovery");
  const first = runAbandonedCheckoutRecovery(input, snapshot);
  const second = runAbandonedCheckoutRecovery(input, snapshot);
  assert.deepEqual(second, first);
});

// ---------------------------------------------------------------------------
// Recipe 2 — lapsed win-back: personal-cadence gate + fallbacks
// ---------------------------------------------------------------------------

test("lapsed win-back: personal-cadence gate holds and fallbacks resolve category -> merchant", () => {
  const coffee = makeProduct({ id: "p_coffee", category: "coffee", repeatability: "repeatable" });
  const repeatable = makeProduct({ id: "p_repeat", category: "tea", repeatability: "repeatable" });

  // Personal cadence: 4 purchases, 3 intervals (median 30), lapsed at 60d gap.
  const personal = makeCustomer({
    id: "c_personal",
    totalOrders: 4,
    lastPurchaseDate: daysAgo(60),
    purchaseIntervalStats: { intervals: [30, 30, 30] },
  });
  // Below the personal gate (2 purchases, 1 interval) -> category fallback.
  const categoryFallback = makeCustomer({
    id: "c_category",
    totalOrders: 2,
    lastPurchaseDate: daysAgo(60),
    purchaseIntervalStats: { intervals: [25] },
  });
  // No product context at all -> merchant-median fallback.
  const merchantFallback = makeCustomer({
    id: "c_merchant",
    totalOrders: 2,
    lastPurchaseDate: daysAgo(60),
    purchaseIntervalStats: { intervals: [40] },
  });
  // WOULD be personal-cadence eligible, but an active refund dispute (<=30d)
  // gates personal cadence off -> merchant fallback (the gate under test).
  const disputed = makeCustomer({
    id: "c_disputed",
    totalOrders: 4,
    lastPurchaseDate: daysAgo(60),
    purchaseIntervalStats: { intervals: [30, 30, 30] },
  });
  // Cohort donors: personal medians of 20 in category "coffee", NOT lapsed.
  const donors = [1, 2, 3].map((n) =>
    makeCustomer({
      id: `c_donor${n}`,
      totalOrders: 4,
      lastPurchaseDate: daysAgo(5),
      purchaseIntervalStats: { intervals: [20, 20] },
    }),
  );

  const events = [
    makeEvent({ eventType: "purchase", eventTimestamp: daysAgo(60), customerId: personal.id, productId: repeatable.id, value: 50 }),
    makeEvent({ eventType: "purchase", eventTimestamp: daysAgo(60), customerId: categoryFallback.id, productId: coffee.id, value: 50 }),
    makeEvent({ eventType: "refund", eventTimestamp: daysAgo(10), customerId: disputed.id, value: 20 }),
    ...donors.map((donor) =>
      makeEvent({ eventType: "purchase", eventTimestamp: daysAgo(5), customerId: donor.id, productId: coffee.id, value: 50 }),
    ),
  ];

  const snapshot = makeSnapshot({
    customers: [personal, categoryFallback, merchantFallback, disputed, ...donors],
    products: [coffee, repeatable],
    events,
  });

  const result = runLapsedWinback(makeRecipeInput("lapsed_winback"), snapshot);

  assert.deepEqual(
    new Set(result.audience.customerIds),
    new Set(["c_personal", "c_category", "c_merchant", "c_disputed"]),
  );
  // Cadence-basis proof: personal used ONLY where the gate passes; the
  // refund-disputed customer fell back to the merchant median.
  assert.deepEqual(
    (result.audience.inclusionRules as { cadenceBasisCounts: unknown }).cadenceBasisCounts,
    { personal: 1, category: 1, merchant: 2 },
  );
  // Donors are within cadence -> never lapsed, never in the audience.
  for (const donor of donors) {
    assert.ok(!result.audience.customerIds.includes(donor.id));
  }
});

test("lapsed win-back: unsubscribed and suppressed lapsed customers are excluded", () => {
  const lapsedBase = {
    totalOrders: 4,
    lastPurchaseDate: daysAgo(60),
    purchaseIntervalStats: { intervals: [30, 30, 30] },
  };
  const ok = makeCustomer({ id: "c_ok", ...lapsedBase });
  const unsub = makeCustomer({ id: "c_unsub", ...lapsedBase });
  const suppressed = makeCustomer({
    id: "c_suppressed",
    suppressionStatus: "unsubscribed",
    ...lapsedBase,
  });
  const snapshot = makeSnapshot({
    customers: [ok, unsub, suppressed],
    events: [
      makeEvent({ eventType: "unsubscribe", eventTimestamp: daysAgo(15), customerId: unsub.id, source: "klaviyo" }),
    ],
  });

  const result = runLapsedWinback(makeRecipeInput("lapsed_winback"), snapshot);
  assert.deepEqual(result.audience.customerIds, ["c_ok"]);
  const reasons = Object.keys(result.audience.exclusionRules);
  assert.ok(reasons.some((reason) => reason.includes("unsubscribed")));
  assert.ok(reasons.some((reason) => reason.includes("suppressed")));
});

// ---------------------------------------------------------------------------
// Recipe 3 — Meta seed + suppression: no estimate, never found-money
// ---------------------------------------------------------------------------

test("meta seed: estimate is ALWAYS null, exclusions enforce consent/identifier/refund rules", () => {
  const good = makeCustomer({
    id: "m_good",
    totalOrders: 10,
    totalRevenue: 1000,
    lastPurchaseDate: daysAgo(10),
    consentAds: true,
  });
  const oldBuyer = makeCustomer({
    id: "m_old",
    totalOrders: 8,
    totalRevenue: 900,
    lastPurchaseDate: daysAgo(90),
    consentAds: true,
  });
  const noConsent = makeCustomer({
    id: "m_noconsent",
    totalOrders: 9,
    totalRevenue: 950,
    lastPurchaseDate: daysAgo(10),
    consentAds: false,
  });
  const suppressed = makeCustomer({
    id: "m_suppressed",
    totalOrders: 9,
    totalRevenue: 940,
    lastPurchaseDate: daysAgo(10),
    consentAds: true,
    suppressionStatus: "complaint",
  });
  const refundHeavy = makeCustomer({
    id: "m_refund",
    totalOrders: 9,
    totalRevenue: 930,
    lastPurchaseDate: daysAgo(10),
    consentAds: true,
    refundRate: 0.5,
  });
  const noIdentifier = makeCustomer({
    id: "m_noemail",
    totalOrders: 9,
    totalRevenue: 920,
    lastPurchaseDate: daysAgo(5),
    consentAds: true,
    emailLower: null,
  });

  const snapshot = makeSnapshot({
    customers: [good, oldBuyer, noConsent, suppressed, refundHeavy, noIdentifier],
  });
  // seedPercentile 100 puts every purchaser through the exclusion gauntlet.
  const result = runMetaSeedSuppression(
    makeRecipeInput("meta_seed_suppression", { seedPercentile: 100 }),
    snapshot,
  );

  // The trust rule under test: NO dollar estimate, EVER (PRD 10.4).
  assert.equal(result.estimate, null);

  assert.deepEqual(
    new Set(result.audience.customerIds),
    new Set(["m_good", "m_old"]),
  );
  const seedReasons = Object.keys(result.audience.exclusionRules);
  assert.ok(seedReasons.some((reason) => reason.includes("consent")));
  assert.ok(seedReasons.some((reason) => reason.includes("suppressed")));
  assert.ok(seedReasons.some((reason) => reason.includes("refund-heavy")));
  assert.ok(seedReasons.some((reason) => reason.includes("identifier")));

  // Suppression audience: recent purchasers WITH an identifier only.
  const suppressionIds = result.suppressionAudience?.customerIds ?? [];
  assert.ok(suppressionIds.includes("m_good"));
  assert.ok(!suppressionIds.includes("m_noemail"));
  assert.ok(!suppressionIds.includes("m_old")); // outside the 30-day window
  assert.equal(
    (result.suppressionAudience?.exclusionRules as Record<string, number>)[
      "no destination-compatible identifier"
    ],
    1,
  );
});

test("meta seed: never found-money eligible and no lift language in the explanation", () => {
  const purchasers = [1, 2, 3, 4].map((n) =>
    makeCustomer({
      id: `m_p${n}`,
      totalOrders: 5,
      totalRevenue: 500 + n,
      lastPurchaseDate: daysAgo(10),
      consentAds: true,
    }),
  );
  const result = runMetaSeedSuppression(
    makeRecipeInput("meta_seed_suppression"),
    makeSnapshot({ customers: purchasers }),
  );
  assert.equal(result.estimate, null);

  // Never counted in the found-money header, at ANY confidence.
  const confidences: Confidence[] = ["low", "medium", "high"];
  for (const confidence of confidences) {
    assert.equal(
      isFoundMoneyEligible({
        recipeId: "meta_seed_suppression",
        confidence,
        estimateLabel: "modeled",
      }),
      false,
    );
  }

  // META directional-only invariant: no lift/incrementality/recovered-revenue/
  // causal-ROAS/holdout-verified language anywhere in the customer-facing copy.
  const copy = [
    result.explanation.found,
    result.explanation.whyItMatters,
    ...result.explanation.assumptions,
    result.explanation.risk,
    result.explanation.approvalNeeded,
  ].join(" ");
  for (const term of META_DISALLOWED_TERMS) {
    const escaped = term
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "[\\s-]+");
    const pattern = new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
    assert.ok(
      !pattern.test(copy),
      `Meta copy must never contain "${term}" (found in explanation copy)`,
    );
  }
  assert.equal(result.measurementPlan.mode, "directional");
});
