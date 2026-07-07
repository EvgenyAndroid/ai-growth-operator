/**
 * lib/recipes/lapsed-winback.ts — Recipe 2: Lapsed Customer Win-Back.
 *
 * PRD 10.3 + 26A/26B:
 *  - Lapsed when current gap > cadenceMultiplier (default 1.5) x expected cadence.
 *  - Personal cadence only with >= minPurchasesForPersonalCadence (3) purchases,
 *    >= minIntervalsForPersonalCadence (2) intervals, no active refund dispute,
 *    no suppression; else category-of-last-product median; else merchant median.
 *  - Product-aware rules (26A.7): merchant repeatability override wins over the
 *    system-inferred value; one-time/gift, out-of-season seasonal, and
 *    discontinued/unavailable products are excluded unless overridden; unknown
 *    repeatability is treated as weak and forces confidence Low.
 *  - NET estimates (26B.11): active win-back flow members are subtracted.
 */

import type {
  Customer,
  EstimateRange,
  ExplanationContract,
  Product,
  RecipeInput,
  RecipeResult,
} from "../contracts";
import { scoreConfidence } from "./confidence";
import { buildKlaviyoMeasurementPlan } from "./measurement-plan";
import {
  MS_PER_DAY,
  activeFlowMemberEmails,
  allSourcesFresh,
  computeAov,
  eventsByCustomer,
  fmtDollars,
  fmtPct,
  hasKlaviyoProfile,
  identityJoinCoverage,
  isFlowMember,
  median,
  purchaseIntervalsDays,
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

/** Refund-heavy threshold — dissatisfaction proxy (PRD 10.3 exclusions). */
const REFUND_HEAVY_RATE = 0.3;
/** A refund event within this window counts as an active refund dispute (cadence gate). */
const ACTIVE_REFUND_DISPUTE_DAYS = 30;
/** Minimum lapse observations before merchant history replaces the modeled default (26A.6). */
const MIN_HISTORICAL_SAMPLE = 20;
/** Modeled upper-bound multiplier over the conservative rate. */
const MODELED_HIGH_MULTIPLIER = 1.5;
/** Minimum contributing customers for a category/merchant cadence median. */
const MIN_COHORT_FOR_MEDIAN = 3;
/** Alpha activation reality (26B.17). */
const ACTIVATION_LEVEL = "klaviyo_campaign_draft" as const;

type CadenceBasis = "personal" | "category" | "merchant";
type Repeatability = "strong" | "partial" | "weak";

/** 26A.7 — merchant override wins over the system-inferred repeatability. */
function effectiveRepeatability(p: Product): string {
  return p.repeatabilityOverride ?? p.repeatability;
}

interface ProductRule {
  excluded: boolean;
  reason?: string;
  weak: boolean;
}

function lastProductRule(p: Product | undefined): ProductRule {
  if (!p) return { excluded: false, weak: true }; // no product context — weak repeat logic
  const rep = effectiveRepeatability(p);
  if (p.availability !== "available") {
    return {
      excluded: true,
      reason: "last product discontinued or unavailable",
      weak: false,
    };
  }
  if (rep === "one_time_gift") {
    return {
      excluded: true,
      reason: "last product is one-time/gift (unlikely to repeat; merchant can override)",
      weak: false,
    };
  }
  if (rep === "seasonal" || (p.seasonalFlag && rep !== "repeatable" && rep !== "replenishable")) {
    return {
      excluded: true,
      reason: "last product is seasonal (excluded unless merchant overrides)",
      weak: false,
    };
  }
  if (rep === "repeatable" || rep === "replenishable" || p.repeatPurchaseFlag) {
    return { excluded: false, weak: false };
  }
  return { excluded: false, weak: true }; // unknown repeatability — include, weak
}

export function runLapsedWinback(
  input: RecipeInput<"lapsed_winback">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"lapsed_winback"> {
  const cfg = input.config;
  const asOf = new Date(input.dataAsOf);
  const asOfMs = asOf.getTime();

  const customers = sortCustomers(snapshot.customers);
  const productById = new Map(snapshot.products.map((p) => [p.id, p]));
  const purchasesByCustomer = eventsByCustomer(snapshot.events, [
    "purchase",
    "repeat_purchase",
  ]);
  const refundsByCustomer = eventsByCustomer(snapshot.events, ["refund"]);
  const unsubscribed = unsubscribedCustomerIds(snapshot.events);
  const winbackFlowEmails = activeFlowMemberEmails(snapshot.existingFlows, "winback");
  const recoveryFlowEmails = activeFlowMemberEmails(snapshot.existingFlows, "recovery");
  const heldOut = new Set(
    snapshot.heldOutCustomerIdsByActionType.klaviyo_winback_flow ?? [],
  );
  const manualExcluded = new Set(snapshot.manualExclusionCustomerIds);

  // ---- Per-customer purchase profile (deterministic pre-pass) -------------
  interface Profile {
    customer: Customer;
    intervals: number[];
    personalMedian: number | null; // gate NOT yet applied
    personalCadenceEligible: boolean;
    gapDays: number | null;
    lastProduct: Product | undefined;
    purchaseCount: number;
  }
  const profiles: Profile[] = [];
  for (const c of customers) {
    const purchases = purchasesByCustomer.get(c.id) ?? [];
    const purchaseCount = Math.max(c.totalOrders, purchases.length);
    if (purchaseCount === 0) continue;
    const lastPurchaseMs =
      c.lastPurchaseDate?.getTime() ??
      (purchases.length > 0
        ? purchases[purchases.length - 1].eventTimestamp.getTime()
        : null);
    const gapDays =
      lastPurchaseMs !== null ? (asOfMs - lastPurchaseMs) / MS_PER_DAY : null;
    const intervals = purchaseIntervalsDays(c, purchases);
    const refunds = refundsByCustomer.get(c.id) ?? [];
    const activeRefundDispute = refunds.some(
      (r) => asOfMs - r.eventTimestamp.getTime() <= ACTIVE_REFUND_DISPUTE_DAYS * MS_PER_DAY,
    );
    const personalCadenceEligible =
      purchaseCount >= cfg.minPurchasesForPersonalCadence &&
      intervals.length >= cfg.minIntervalsForPersonalCadence &&
      !activeRefundDispute &&
      c.suppressionStatus === "none";
    const lastPurchaseEventWithProduct = [...purchases]
      .reverse()
      .find((p) => p.productId != null);
    profiles.push({
      customer: c,
      intervals,
      personalMedian: median(intervals),
      personalCadenceEligible,
      gapDays,
      lastProduct: lastPurchaseEventWithProduct?.productId
        ? productById.get(lastPurchaseEventWithProduct.productId)
        : undefined,
      purchaseCount,
    });
  }

  // ---- Cadence fallbacks: category-of-last-product, then merchant (PRD 10.3) ----
  const categoryMedians = new Map<string, number>();
  const byCategory = new Map<string, number[]>();
  const merchantContrib: number[] = [];
  for (const p of profiles) {
    if (p.personalMedian === null) continue;
    merchantContrib.push(p.personalMedian);
    const cat = p.lastProduct?.category;
    if (cat) {
      const list = byCategory.get(cat);
      if (list) list.push(p.personalMedian);
      else byCategory.set(cat, [p.personalMedian]);
    }
  }
  for (const [cat, meds] of byCategory) {
    if (meds.length >= MIN_COHORT_FOR_MEDIAN) {
      const m = median(meds);
      if (m !== null) categoryMedians.set(cat, m);
    }
  }
  const merchantMedian: number | null =
    merchantContrib.length >= MIN_COHORT_FOR_MEDIAN ? median(merchantContrib) : null;

  const resolveCadence = (
    p: Profile,
  ): { days: number; basis: CadenceBasis } | null => {
    if (p.personalCadenceEligible && p.personalMedian !== null) {
      return { days: p.personalMedian, basis: "personal" };
    }
    const cat = p.lastProduct?.category;
    if (cat) {
      const m = categoryMedians.get(cat);
      if (m !== undefined) return { days: m, basis: "category" };
    }
    return merchantMedian !== null
      ? { days: merchantMedian, basis: "merchant" }
      : null;
  };

  // ---- Eligibility + exclusions -------------------------------------------
  const tally = new Map<string, number>();
  const bump = (reason: string) => tally.set(reason, (tally.get(reason) ?? 0) + 1);

  const eligible: Profile[] = [];
  const basisCounts: Record<CadenceBasis, number> = { personal: 0, category: 0, merchant: 0 };
  let consideredLapsed = 0;
  let netSubtracted = 0;
  let weakRepeatIncluded = 0;

  for (const p of profiles) {
    const cadence = resolveCadence(p);
    if (cadence === null || p.gapDays === null) continue; // no cadence determinable
    if (p.gapDays <= cfg.cadenceMultiplier * cadence.days) continue; // not lapsed
    consideredLapsed += 1;
    const c = p.customer;

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
    if ((c.refundRate ?? 0) >= REFUND_HEAVY_RATE) {
      bump("refund-heavy customer (dissatisfaction signal)");
      continue;
    }
    const rule = lastProductRule(p.lastProduct);
    if (rule.excluded) {
      bump(rule.reason ?? "product unlikely to repeat");
      continue;
    }
    if (isFlowMember(c, winbackFlowEmails)) {
      bump("already in active win-back flow (netted out per 26B.11)");
      netSubtracted += 1;
      continue;
    }
    if (isFlowMember(c, recoveryFlowEmails)) {
      bump("active recovery-flow member");
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
    if (rule.weak) weakRepeatIncluded += 1;
    basisCounts[cadence.basis] += 1;
    eligible.push(p);
  }

  const exclusions: ExclusionTally[] = [...tally.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([reason, count]) => ({ reason, count }));
  const n = eligible.length;

  // ---- Merchant historical win-back rate (deterministic proxy) ------------
  // A "lapse" is any personal interval > multiplier x that customer's median —
  // by definition the customer returned, so it counts as a win-back. Currently
  // lapsed customers are open lapses that have not converted.
  let winbackInstances = 0;
  let lapseInstances = 0;
  for (const p of profiles) {
    if (p.personalMedian === null || p.intervals.length < 2) continue;
    for (const gap of p.intervals) {
      if (gap > cfg.cadenceMultiplier * p.personalMedian) {
        winbackInstances += 1;
        lapseInstances += 1;
      }
    }
    const cadence = resolveCadence(p);
    if (
      cadence !== null &&
      p.gapDays !== null &&
      p.gapDays > cfg.cadenceMultiplier * cadence.days
    ) {
      lapseInstances += 1; // open lapse, not (yet) won back
    }
  }
  const merchantWinbackRate =
    lapseInstances >= MIN_HISTORICAL_SAMPLE ? winbackInstances / lapseInstances : null;

  // ---- Estimate (PRD 10.3 formula + 16.3 fallbacks; NET per 26B.11) -------
  const aov = computeAov(snapshot);
  let estimate: EstimateRange | null = null;
  let baseline: BaselineAvailability = "none";
  const assumptions: string[] = [];
  if (aov !== null && n > 0) {
    if (merchantWinbackRate !== null) {
      baseline = "merchant_historical";
      const low = cfg.conservativeWinbackRate * n * aov;
      const high = merchantWinbackRate * n * aov;
      estimate = {
        low: roundDollars(Math.min(low, high)),
        high: roundDollars(Math.max(low, high)),
        label: "merchant_historical",
      };
      assumptions.push(
        `Merchant historical win-back rate ${fmtPct(merchantWinbackRate)} from ${winbackInstances} win-backs across ${lapseInstances} observed lapses; conservative floor ${fmtPct(cfg.conservativeWinbackRate)}.`,
      );
    } else {
      baseline = "modeled";
      estimate = {
        low: roundDollars(cfg.conservativeWinbackRate * n * aov),
        high: roundDollars(
          cfg.conservativeWinbackRate * MODELED_HIGH_MULTIPLIER * n * aov,
        ),
        label: "modeled",
      };
      assumptions.push(
        `MODELED ASSUMPTION (editable, 26A.6): conservative win-back rate ${fmtPct(cfg.conservativeWinbackRate)} used because merchant lapse history is weak (${lapseInstances} observed lapses < ${MIN_HISTORICAL_SAMPLE} minimum). Range spans 1x-${MODELED_HIGH_MULTIPLIER}x the conservative rate.`,
      );
    }
    assumptions.push(`Average order value ${fmtDollars(aov)} from merchant purchase history.`);
  } else if (n > 0) {
    assumptions.push(
      "No purchase baseline exists, so no dollar estimate is shown (PRD 16.3 step 4). Not included in the found-money header.",
    );
  }
  assumptions.push(
    `Lapse defined as gap > ${cfg.cadenceMultiplier}x expected cadence. Cadence basis for the eligible audience: personal ${basisCounts.personal}, category ${basisCounts.category}, merchant ${basisCounts.merchant}.`,
    `Estimate covers only the ${n} customers NOT already reached by an active win-back flow (${netSubtracted} netted out per 26B.11).`,
  );

  // ---- Measurement + confidence -------------------------------------------
  const flowDataReliable = snapshot.flowMembershipSource === "flow_membership";
  const contaminationCaveats = flowDataReliable
    ? []
    : [
        snapshot.flowMembershipSource === "event_proxy"
          ? "Active-flow exclusions derived from recent flow/campaign event history (proxy) — contamination risk, confidence lowered (26A.5)."
          : "Klaviyo flow membership unavailable — active-flow exclusion could not be verified; contamination risk flagged and confidence lowered (26A.5).",
      ];
  const measurementPlan = buildKlaviyoMeasurementPlan({
    recipeId: "lapsed_winback",
    eligibleAudienceSize: n,
    holdoutPercent: cfg.holdoutPercent,
    minHoldoutAudience: cfg.minHoldoutAudience,
    activationLevel: ACTIVATION_LEVEL,
    extraCaveats: contaminationCaveats,
  });

  const weakShare = n > 0 ? weakRepeatIncluded / n : 0;
  const productRepeatability: Repeatability =
    weakShare > 0.3 ? "weak" : weakShare > 0 || basisCounts.merchant > basisCounts.personal ? "partial" : "strong";

  const { confidence, inputs: confidenceInputs } = scoreConfidence({
    dataFresh: allSourcesFresh(snapshot),
    audienceSize: n,
    consentRatio: consideredLapsed > 0 ? n / consideredLapsed : 0,
    baseline,
    activationLevel: ACTIVATION_LEVEL,
    measurementMode: measurementPlan.mode,
    sourceCompleteness: identityJoinCoverage(customers),
    recipeMaturity: "new",
    productRepeatability,
    flowExclusionReliable: flowDataReliable,
  });

  // ---- Explanation contract (PRD 4.4) -------------------------------------
  const estimateCopy = estimate
    ? `an estimated ${fmtDollars(estimate.low)}-${fmtDollars(estimate.high)} (${estimate.label === "merchant_historical" ? "merchant historical" : "modeled estimate"})`
    : "value shown without a dollar figure because no baseline exists";
  const explanation: ExplanationContract = {
    found: `${n} previously active customers are past ${cfg.cadenceMultiplier}x their expected purchase cadence and are not already covered by an existing win-back flow.`,
    whyItMatters: `Lapsed repeat buyers are the cheapest revenue to win back — ${estimateCopy} beyond what your current flows already recover.`,
    dataUsed: [
      "Shopify purchase / repeat_purchase / refund events",
      "Per-customer purchase interval stats (personal median cadence)",
      "Product catalog: category, availability, repeat/seasonal flags, repeatability + merchant override (26A.7)",
      "Klaviyo consent status and profile match (lowercase-email join, 26B.12)",
      "Existing Klaviyo win-back/recovery flow membership (26B.11)",
      "Suppression list and manual exclusions",
    ],
    dataFreshness: snapshot.freshness,
    assumptions,
    risk: "Re-engaging refund-heavy or dissatisfied customers is excluded by rule, but win-back sends to customers whose last product no longer fits can still cause unsubscribes; product-rule exclusions mitigate this and the merchant can override repeatability per product.",
    approvalNeeded:
      "Draft only — creating this draft sends nothing (26A.4). Win-back sequence (non-discount re-engagement first, replenishment reminder, offer only if Operating Rules allow) requires explicit approval before any customer-facing send.",
    measurementPlan,
  };

  const result: RecipeResult<"lapsed_winback"> = {
    recipeId: "lapsed_winback",
    recipeVersion: RECIPE_VERSION,
    title: "Win back lapsed customers",
    category: "winback",
    sourceSignal: `Current purchase gap > ${cfg.cadenceMultiplier}x expected cadence (personal median with >= ${cfg.minPurchasesForPersonalCadence} purchases and >= ${cfg.minIntervalsForPersonalCadence} intervals; category then merchant fallback)`,
    audience: {
      name: "Lapsed win-back — eligible customers",
      inclusionRules: {
        gapExceedsCadenceMultiplier: cfg.cadenceMultiplier,
        personalCadenceMinPurchases: cfg.minPurchasesForPersonalCadence,
        personalCadenceMinIntervals: cfg.minIntervalsForPersonalCadence,
        cadenceFallback: "category median, then merchant median",
        emailConsentOrKlaviyoProfile: true,
        cadenceBasisCounts: basisCounts,
      },
      exclusionRules: Object.fromEntries(exclusions.map((e) => [e.reason, e.count])),
      size: n,
      eligibleChannels: ["klaviyo_email"],
      customerIds: eligible.map((p) => p.customer.id),
    },
    exclusionsApplied: exclusions.map((e) => `${e.reason} (${e.count})`),
    estimate,
    confidence,
    confidenceInputs,
    recommendedAction: "klaviyo_winback_flow",
    activationLevel: ACTIVATION_LEVEL,
    measurementPlan,
    explanation,
    dataAsOf: input.dataAsOf,
    dedupKey: `${input.accountId}:${input.recipeId}`,
  };

  if (n === 0) {
    result.noOpportunity = {
      checked: [
        { what: "customers with purchase history", count: profiles.length },
        { what: "customers past expected cadence", count: consideredLapsed },
        { what: "eligible after consent/suppression/product/flow exclusions", count: n },
      ],
      whyNotQualified:
        consideredLapsed === 0
          ? "No customer is past their expected purchase cadence (or no cadence could be established from personal, category, or merchant history)."
          : `All ${consideredLapsed} lapsed customers were excluded: ${exclusions.map((e) => `${e.reason} (${e.count})`).join(", ")}.`,
      nearestNextAction: "Run the abandoned checkout recovery scan.",
      unlocks:
        "Connect Meta to unlock high-LTV audience seed and purchaser suppression opportunities.",
    };
  }

  return result;
}
