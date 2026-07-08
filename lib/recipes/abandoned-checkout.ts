/**
 * lib/recipes/abandoned-checkout.ts — Recipe 1: Abandoned Checkout Recovery.
 *
 * PRD 10.2 + 26A/26B:
 *  - Source: checkout_started without purchase within `abandonmentHours` (default 4h),
 *    no older than `maxCheckoutAgeDays` (default 14d).
 *  - Exclusions incl. active recovery-flow members, holdout members, manual excludes.
 *  - NET estimates (26B.11): population already covered by an active recovery flow is
 *    subtracted; copy frames value as beyond what current flows already recover.
 *  - Estimate range: low = conservative rate, high = merchant historical rate when it
 *    exists; else conservative modeled with "modeled" label (26A.6); no baseline => null.
 *  - Holdout only when eligible audience >= minHoldoutAudience, downgrade per 26A.1.
 */

import type { EstimateRange, ExplanationContract, RecipeInput, RecipeResult } from "../contracts";
import type { Customer } from "../contracts/models";
import { scoreConfidence } from "./confidence";
import { buildKlaviyoMeasurementPlan } from "./measurement-plan";
import {
  MS_PER_DAY,
  MS_PER_HOUR,
  activeFlowMemberEmails,
  allSourcesFresh,
  computeAov,
  eventsByCustomer,
  fmtDollars,
  fmtPct,
  hasKlaviyoProfile,
  identityJoinCoverage,
  isFlowMember,
  roundDollars,
  sortCustomers,
  unsubscribedCustomerIds,
} from "./shared";
import {
  RECIPE_VERSION,
  type BaselineAvailability,
  type ExclusionTally,
  type RecipeDataSnapshot,
} from "./types";

/** Minimum resolved abandoned checkouts before merchant history replaces the modeled default (26A.6). */
const MIN_HISTORICAL_SAMPLE = 20;
/** Modeled upper-bound multiplier over the conservative rate when no merchant baseline exists. */
const MODELED_HIGH_MULTIPLIER = 1.5;
/** Alpha activation reality: Klaviyo flow-draft API assumed unavailable (26B.17). */
const ACTIVATION_LEVEL = "klaviyo_campaign_draft" as const;

interface HistoricalRecovery {
  rate: number | null;
  abandonedResolved: number;
  recovered: number;
}

/**
 * Merchant historical recovery rate: among checkouts old enough to be fully
 * resolved (checkout + maxAge <= asOf) that were abandoned (no purchase within
 * abandonmentHours), the share that still purchased within maxCheckoutAgeDays.
 */
function computeHistoricalRecoveryRate(
  snapshot: RecipeDataSnapshot,
  asOf: Date,
  abandonmentHours: number,
  maxCheckoutAgeDays: number,
): HistoricalRecovery {
  const purchasesByCustomer = eventsByCustomer(snapshot.events, [
    "purchase",
    "repeat_purchase",
  ]);
  let abandonedResolved = 0;
  let recovered = 0;
  for (const e of snapshot.events) {
    if (e.eventType !== "checkout_started" || !e.customerId) continue;
    const t = e.eventTimestamp.getTime();
    if (t + maxCheckoutAgeDays * MS_PER_DAY > asOf.getTime()) continue; // not resolved yet
    const purchases = purchasesByCustomer.get(e.customerId) ?? [];
    const convertedQuickly = purchases.some(
      (p) =>
        p.eventTimestamp.getTime() > t &&
        p.eventTimestamp.getTime() <= t + abandonmentHours * MS_PER_HOUR,
    );
    if (convertedQuickly) continue; // never abandoned
    abandonedResolved += 1;
    const recoveredLater = purchases.some(
      (p) =>
        p.eventTimestamp.getTime() > t + abandonmentHours * MS_PER_HOUR &&
        p.eventTimestamp.getTime() <= t + maxCheckoutAgeDays * MS_PER_DAY,
    );
    if (recoveredLater) recovered += 1;
  }
  return {
    rate:
      abandonedResolved >= MIN_HISTORICAL_SAMPLE
        ? recovered / abandonedResolved
        : null,
    abandonedResolved,
    recovered,
  };
}

export function runAbandonedCheckoutRecovery(
  input: RecipeInput<"abandoned_checkout_recovery">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"abandoned_checkout_recovery"> {
  const cfg = input.config;
  const asOf = new Date(input.dataAsOf);
  const abandonedBefore = asOf.getTime() - cfg.abandonmentHours * MS_PER_HOUR;
  const staleBefore = asOf.getTime() - cfg.maxCheckoutAgeDays * MS_PER_DAY;

  const customers = sortCustomers(snapshot.customers);
  const purchasesByCustomer = eventsByCustomer(snapshot.events, [
    "purchase",
    "repeat_purchase",
  ]);
  const unsubscribed = unsubscribedCustomerIds(snapshot.events);
  const recoveryFlowEmails = activeFlowMemberEmails(snapshot.existingFlows, "recovery");
  const heldOut = new Set(
    snapshot.heldOutCustomerIdsByActionType.klaviyo_recovery_flow ?? [],
  );
  const manualExcluded = new Set(snapshot.manualExclusionCustomerIds);

  // Latest checkout_started per customer (any age — staleness excluded below with a count).
  const latestCheckoutByCustomer = new Map<string, number>();
  let checkoutsChecked = 0;
  for (const e of snapshot.events) {
    if (e.eventType !== "checkout_started" || !e.customerId) continue;
    checkoutsChecked += 1;
    const t = e.eventTimestamp.getTime();
    const prev = latestCheckoutByCustomer.get(e.customerId);
    if (prev === undefined || t > prev) latestCheckoutByCustomer.set(e.customerId, t);
  }

  const tally = new Map<string, number>();
  const bump = (reason: string) => tally.set(reason, (tally.get(reason) ?? 0) + 1);

  const eligible: Customer[] = [];
  let consideredWithCheckout = 0;
  let netSubtracted = 0;

  // Deterministic iteration order: sorted customers.
  for (const c of customers) {
    const checkoutAt = latestCheckoutByCustomer.get(c.id);
    if (checkoutAt === undefined) continue;
    if (checkoutAt > abandonedBefore) continue; // not yet abandoned (< X hours old)
    consideredWithCheckout += 1;

    if (checkoutAt < staleBefore) {
      bump(`stale checkout older than ${cfg.maxCheckoutAgeDays} days`);
      continue;
    }
    const purchases = purchasesByCustomer.get(c.id) ?? [];
    if (purchases.some((p) => p.eventTimestamp.getTime() > checkoutAt)) {
      bump("purchased since checkout");
      continue;
    }
    if (unsubscribed.has(c.id)) {
      bump("unsubscribed");
      continue;
    }
    if (c.suppressionStatus !== "none") {
      bump("suppressed");
      continue;
    }
    if (!c.consentEmail && !hasKlaviyoProfile(c)) {
      bump("no email consent and no eligible Klaviyo profile");
      continue;
    }
    if (isFlowMember(c, recoveryFlowEmails)) {
      bump("already in active abandoned-checkout recovery flow (netted out per 26B.11)");
      netSubtracted += 1;
      continue;
    }
    if (heldOut.has(c.id)) {
      bump("already assigned to a holdout for this action");
      continue;
    }
    if (manualExcluded.has(c.id)) {
      bump("manually excluded by merchant");
      continue;
    }
    eligible.push(c);
  }

  const exclusions: ExclusionTally[] = [...tally.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([reason, count]) => ({ reason, count }));

  // ---- Estimate (PRD 10.2 formula + 16.3 fallbacks; NET per 26B.11) ----
  const aov = computeAov(snapshot);
  const history = computeHistoricalRecoveryRate(
    snapshot,
    asOf,
    cfg.abandonmentHours,
    cfg.maxCheckoutAgeDays,
  );
  const n = eligible.length;

  let estimate: EstimateRange | null = null;
  let baseline: BaselineAvailability = "none";
  const assumptions: string[] = [];
  if (aov !== null && n > 0) {
    if (history.rate !== null) {
      baseline = "merchant_historical";
      const low = cfg.conservativeRecoveryRate * n * aov;
      const high = history.rate * n * aov;
      estimate = {
        low: roundDollars(Math.min(low, high)),
        high: roundDollars(Math.max(low, high)),
        label: "merchant_historical",
      };
      assumptions.push(
        `Merchant historical recovery rate ${fmtPct(history.rate)} computed from ${history.recovered} of ${history.abandonedResolved} resolved abandoned checkouts; conservative floor ${fmtPct(cfg.conservativeRecoveryRate)}.`,
      );
    } else {
      baseline = "modeled";
      estimate = {
        low: roundDollars(cfg.conservativeRecoveryRate * n * aov),
        high: roundDollars(
          cfg.conservativeRecoveryRate * MODELED_HIGH_MULTIPLIER * n * aov,
        ),
        label: "modeled",
      };
      assumptions.push(
        `MODELED ASSUMPTION (editable, 26A.6): conservative recovery rate ${fmtPct(cfg.conservativeRecoveryRate)} used because merchant history is weak (${history.abandonedResolved} resolved abandoned checkouts < ${MIN_HISTORICAL_SAMPLE} minimum). Range spans 1x-${MODELED_HIGH_MULTIPLIER}x the conservative rate.`,
      );
    }
    assumptions.push(
      `Average order value ${fmtDollars(aov)} from merchant purchase history.`,
    );
  } else if (n > 0) {
    assumptions.push(
      "No purchase baseline exists, so no dollar estimate is shown (PRD 16.3 step 4: directional label without dollar value). Not included in the found-money header.",
    );
  }
  assumptions.push(
    `Estimate covers only the ${n} customers NOT already reached by an active recovery flow (${netSubtracted} netted out per 26B.11).`,
  );

  // ---- Measurement (PRD 10.2 + 26A.1) ----
  const flowDataReliable = snapshot.flowMembershipSource === "flow_membership";
  const contaminationCaveats = flowDataReliable
    ? []
    : [
        snapshot.flowMembershipSource === "event_proxy"
          ? "Active-flow exclusions derived from recent flow/campaign event history (proxy) — contamination risk, confidence lowered (26A.5)."
          : "Klaviyo flow membership unavailable — active-flow exclusion could not be verified; contamination risk flagged and confidence lowered (26A.5).",
      ];
  const measurementPlan = buildKlaviyoMeasurementPlan({
    recipeId: "abandoned_checkout_recovery",
    eligibleAudienceSize: n,
    holdoutPercent: cfg.holdoutPercent,
    minHoldoutAudience: cfg.minHoldoutAudience,
    activationLevel: ACTIVATION_LEVEL,
    extraCaveats: contaminationCaveats,
  });

  // ---- Confidence (PRD 11) ----
  const { confidence, inputs: confidenceInputs } = scoreConfidence({
    dataFresh: allSourcesFresh(snapshot),
    audienceSize: n,
    consentRatio: consideredWithCheckout > 0 ? n / consideredWithCheckout : 0,
    baseline,
    activationLevel: ACTIVATION_LEVEL,
    measurementMode: measurementPlan.mode,
    sourceCompleteness: identityJoinCoverage(customers),
    recipeMaturity: "new",
    flowExclusionReliable: flowDataReliable,
  });

  // ---- Explanation contract (PRD 4.4) ----
  const estimateCopy = estimate
    ? `an estimated ${fmtDollars(estimate.low)}-${fmtDollars(estimate.high)} (${estimate.label === "merchant_historical" ? "merchant historical" : "modeled estimate"})`
    : "value shown without a dollar figure because no baseline exists";
  const explanation: ExplanationContract = {
    found: `${n} shoppers started checkout in the last ${cfg.maxCheckoutAgeDays} days, went ${cfg.abandonmentHours}+ hours without purchasing, and are not already covered by an existing recovery flow.`,
    whyItMatters: `These are warm, consent-eligible shoppers — ${estimateCopy} in recoverable orders beyond what your current flows already recover.`,
    dataUsed: [
      "Shopify checkout_started events (last 90-day priority sync)",
      "Shopify purchase / repeat_purchase events",
      "Klaviyo consent status and profile match (lowercase-email join, 26B.12)",
      "Klaviyo unsubscribe events",
      "Existing Klaviyo recovery-flow membership (26B.11)",
      "Suppression list and manual exclusions",
    ],
    dataFreshness: snapshot.freshness,
    assumptions,
    risk: "Over-mailing risk if the shopper completes purchase between draft and send; recipients are re-checked at activation. Sending to stale checkouts (>14 days) is excluded by rule.",
    approvalNeeded:
      "Draft only — creating this draft sends nothing (26A.4). A 3-email recovery sequence (reminder, objection handling, incentive only if Operating Rules allow) requires explicit approval before any customer-facing send.",
    measurementPlan,
  };

  const result: RecipeResult<"abandoned_checkout_recovery"> = {
    recipeId: "abandoned_checkout_recovery",
    recipeVersion: RECIPE_VERSION,
    title: "Recover abandoned checkouts",
    category: "recovery",
    sourceSignal: `Shopify checkout_started without purchase within ${cfg.abandonmentHours} hours (max age ${cfg.maxCheckoutAgeDays} days)`,
    audience: {
      name: "Abandoned checkout recovery — eligible shoppers",
      inclusionRules: {
        checkoutStartedWithinDays: cfg.maxCheckoutAgeDays,
        noPurchaseSinceCheckout: true,
        abandonedForAtLeastHours: cfg.abandonmentHours,
        emailConsentOrKlaviyoProfile: true,
      },
      exclusionRules: Object.fromEntries(
        exclusions.map((e) => [e.reason, e.count]),
      ),
      size: n,
      eligibleChannels: ["klaviyo_email"],
      customerIds: eligible.map((c) => c.id),
    },
    exclusionsApplied: exclusions.map((e) => `${e.reason} (${e.count})`),
    estimate,
    confidence,
    confidenceInputs,
    recommendedAction: "klaviyo_recovery_flow",
    activationLevel: ACTIVATION_LEVEL,
    measurementPlan,
    explanation,
    dataAsOf: input.dataAsOf,
    dedupKey: `${input.accountId}:${input.recipeId}`,
  };

  if (n === 0) {
    result.noOpportunity = {
      checked: [
        { what: "checkouts checked", count: checkoutsChecked },
        { what: "customers with an abandoned checkout", count: consideredWithCheckout },
        {
          what: "eligible after consent/suppression/flow exclusions",
          count: n,
        },
      ],
      whyNotQualified:
        consideredWithCheckout === 0
          ? `No checkout_started events older than ${cfg.abandonmentHours} hours without a subsequent purchase were found in the last ${cfg.maxCheckoutAgeDays} days.`
          : `All ${consideredWithCheckout} abandoned checkouts were excluded: ${exclusions.map((e) => `${e.reason} (${e.count})`).join(", ")}.`,
      nearestNextAction: "Run the lapsed customer win-back scan.",
      unlocks:
        "Connect Meta to unlock high-LTV audience seed and purchaser suppression opportunities.",
    };
  }

  return result;
}
