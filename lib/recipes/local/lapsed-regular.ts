/**
 * lib/recipes/local/lapsed-regular.ts — LOCAL Recipe: Lapsed Regulars Win-Back.
 *
 * The café/bakery analogue of lapsed_winback, over Square-like POS purchases,
 * IDENTIFIED (loyalty-matched) customers only (trust rule #9):
 *  - Lapsed when current visit gap > cadenceMultiplier (default 1.5) x expected cadence.
 *  - Personal cadence only with >= minVisitsForPersonalCadence (3) POS purchases
 *    and >= minIntervalsForPersonalCadence (2) intervals; the category fallback
 *    for a café IS the merchant median visit cadence (no product-category tier).
 *  - Estimate = eligible x historical return rate x average identified ticket,
 *    ALWAYS a range; modeled conservative floor when merchant history is thin (26A.6).
 *  - Coverage disclosure attached: the identified-transaction share is stated
 *    on the result and inside the explanation contract.
 *  - Action = Mailchimp-style win-back email through the existing email draft
 *    ladder (campaign-draft level); draft is not activation (26A.4).
 *  - Holdout branch exists and triggers ONLY at >= minHoldoutAudience (500);
 *    local audiences run ~180, so measurement is before/after, no control.
 *  - NET of existing win-back automations (26B.11).
 */

import type {
  EstimateRange,
  ExplanationContract,
  RecipeInput,
  RecipeResult,
} from "../../contracts";
import type { Customer } from "../../contracts/models";
import { scoreConfidence } from "../confidence";
import {
  MS_PER_DAY,
  activeFlowMemberEmails,
  allSourcesFresh,
  eventsByCustomer,
  fmtDollars,
  fmtPct,
  identityJoinCoverage,
  isFlowMember,
  median,
  purchaseIntervalsDays,
  roundDollars,
  sortCustomers,
  unsubscribedCustomerIds,
} from "../shared";
import {
  RECIPE_VERSION,
  type BaselineAvailability,
  type ExclusionTally,
  type RecipeDataSnapshot,
} from "../types";
import {
  computeIdentifiedAvgTicket,
  computePosCoverage,
  coverageAdjustedCompleteness,
  coverageConfidenceInput,
} from "./coverage";
import { buildLocalEmailMeasurementPlan } from "./measurement";

/** Refund-heavy threshold — dissatisfaction proxy (same rule as DTC win-back). */
const REFUND_HEAVY_RATE = 0.3;
/** Minimum lapse observations before merchant history replaces the modeled default (26A.6). */
const MIN_HISTORICAL_SAMPLE = 20;
/** Modeled upper-bound multiplier over the conservative rate. */
const MODELED_HIGH_MULTIPLIER = 1.5;
/** Minimum contributing regulars before a merchant-median cadence is trusted. */
const MIN_COHORT_FOR_MEDIAN = 3;
/**
 * Alpha activation reality: the Mailchimp-like connector is mocked; the email
 * draft rides the existing campaign-draft rung of the activation ladder.
 */
const ACTIVATION_LEVEL = "klaviyo_campaign_draft" as const;

type CadenceBasis = "personal" | "merchant";

export function runLocalLapsedRegular(
  input: RecipeInput<"local_lapsed_regular">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"local_lapsed_regular"> {
  const cfg = input.config;
  const asOfMs = new Date(input.dataAsOf).getTime();

  const customers = sortCustomers(snapshot.customers);
  const purchasesByCustomer = eventsByCustomer(snapshot.events, [
    "purchase",
    "repeat_purchase",
  ]);
  const unsubscribed = unsubscribedCustomerIds(snapshot.events);
  const winbackFlowEmails = activeFlowMemberEmails(snapshot.existingFlows, "winback");
  const heldOut = new Set(
    snapshot.heldOutCustomerIdsByActionType.klaviyo_winback_flow ?? [],
  );
  const manualExcluded = new Set(snapshot.manualExclusionCustomerIds);

  // POS coverage disclosure (trust rule #9) — computed once, attached everywhere.
  const posCoverage = computePosCoverage(snapshot);

  // ---- Per-customer visit profile (identified customers only — every
  // Customer row is loyalty-matched; walk-ins have no Customer row) ---------
  interface Profile {
    customer: Customer;
    intervals: number[];
    personalMedian: number | null;
    personalCadenceEligible: boolean;
    gapDays: number | null;
    visitCount: number;
  }
  const profiles: Profile[] = [];
  for (const c of customers) {
    const purchases = purchasesByCustomer.get(c.id) ?? [];
    const visitCount = Math.max(c.totalOrders, purchases.length);
    if (visitCount === 0) continue;
    const lastPurchaseMs =
      c.lastPurchaseDate?.getTime() ??
      (purchases.length > 0
        ? purchases[purchases.length - 1].eventTimestamp.getTime()
        : null);
    const gapDays =
      lastPurchaseMs !== null ? (asOfMs - lastPurchaseMs) / MS_PER_DAY : null;
    const intervals = purchaseIntervalsDays(c, purchases);
    const personalCadenceEligible =
      visitCount >= cfg.minVisitsForPersonalCadence &&
      intervals.length >= cfg.minIntervalsForPersonalCadence &&
      c.suppressionStatus === "none";
    profiles.push({
      customer: c,
      intervals,
      personalMedian: median(intervals),
      personalCadenceEligible,
      gapDays,
      visitCount,
    });
  }

  // ---- Cadence fallback: merchant median visit cadence (the "category"
  // fallback for a single-location café IS the merchant median) -------------
  const merchantContrib: number[] = [];
  for (const p of profiles) {
    if (p.personalCadenceEligible && p.personalMedian !== null) {
      merchantContrib.push(p.personalMedian);
    }
  }
  const merchantMedian: number | null =
    merchantContrib.length >= MIN_COHORT_FOR_MEDIAN
      ? median(merchantContrib)
      : null;

  const resolveCadence = (
    p: Profile,
  ): { days: number; basis: CadenceBasis } | null => {
    if (p.personalCadenceEligible && p.personalMedian !== null) {
      return { days: p.personalMedian, basis: "personal" };
    }
    return merchantMedian !== null
      ? { days: merchantMedian, basis: "merchant" }
      : null;
  };

  // ---- Eligibility + exclusions -------------------------------------------
  const tally = new Map<string, number>();
  const bump = (reason: string) => tally.set(reason, (tally.get(reason) ?? 0) + 1);

  const eligible: Profile[] = [];
  const basisCounts: Record<CadenceBasis, number> = { personal: 0, merchant: 0 };
  let consideredLapsed = 0;
  let netSubtracted = 0;

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
    if (!c.consentEmail) {
      bump("no email consent");
      continue;
    }
    if ((c.refundRate ?? 0) >= REFUND_HEAVY_RATE) {
      bump("refund-heavy customer (dissatisfaction signal)");
      continue;
    }
    if (isFlowMember(c, winbackFlowEmails)) {
      bump("already in active win-back automation (netted out per 26B.11)");
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
    basisCounts[cadence.basis] += 1;
    eligible.push(p);
  }

  const exclusions: ExclusionTally[] = [...tally.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([reason, count]) => ({ reason, count }));
  const n = eligible.length;

  // ---- Merchant historical return rate (deterministic proxy) --------------
  // A "lapse" is any personal interval > multiplier x that customer's median —
  // by definition the customer came back, so it counts as a return. Currently
  // lapsed regulars are open lapses that have not (yet) returned.
  let returnInstances = 0;
  let lapseInstances = 0;
  for (const p of profiles) {
    if (p.personalMedian === null || p.intervals.length < 2) continue;
    for (const gap of p.intervals) {
      if (gap > cfg.cadenceMultiplier * p.personalMedian) {
        returnInstances += 1;
        lapseInstances += 1;
      }
    }
    const cadence = resolveCadence(p);
    if (
      cadence !== null &&
      p.gapDays !== null &&
      p.gapDays > cfg.cadenceMultiplier * cadence.days
    ) {
      lapseInstances += 1; // open lapse, not (yet) returned
    }
  }
  const merchantReturnRate =
    lapseInstances >= MIN_HISTORICAL_SAMPLE
      ? returnInstances / lapseInstances
      : null;

  // ---- Estimate: eligible x return rate x avg identified ticket (RANGE) ---
  const avgTicket = computeIdentifiedAvgTicket(snapshot);
  let estimate: EstimateRange | null = null;
  let baseline: BaselineAvailability = "none";
  const assumptions: string[] = [];
  if (avgTicket !== null && n > 0) {
    if (merchantReturnRate !== null) {
      baseline = "merchant_historical";
      const low = cfg.conservativeReturnRate * n * avgTicket;
      const high = merchantReturnRate * n * avgTicket;
      estimate = {
        low: roundDollars(Math.min(low, high)),
        high: roundDollars(Math.max(low, high)),
        label: "merchant_historical",
      };
      assumptions.push(
        `Merchant historical return rate ${fmtPct(merchantReturnRate)} from ${returnInstances} returns across ${lapseInstances} observed lapses; conservative floor ${fmtPct(cfg.conservativeReturnRate)}.`,
      );
    } else {
      baseline = "modeled";
      estimate = {
        low: roundDollars(cfg.conservativeReturnRate * n * avgTicket),
        high: roundDollars(
          cfg.conservativeReturnRate * MODELED_HIGH_MULTIPLIER * n * avgTicket,
        ),
        label: "modeled",
      };
      assumptions.push(
        `MODELED ASSUMPTION (editable, 26A.6): conservative return rate ${fmtPct(cfg.conservativeReturnRate)} used because merchant lapse history is thin (${lapseInstances} observed lapses < ${MIN_HISTORICAL_SAMPLE} minimum). Range spans 1x-${MODELED_HIGH_MULTIPLIER}x the conservative rate.`,
      );
    }
    assumptions.push(
      `Average identified ticket ${fmtDollars(avgTicket)} from identified POS purchase history.`,
    );
  } else if (n > 0) {
    assumptions.push(
      "No identified POS purchase baseline exists, so no dollar estimate is shown (PRD 16.3 step 4). Not included in the found-money header.",
    );
  }
  assumptions.push(
    `Lapse defined as visit gap > ${cfg.cadenceMultiplier}x expected cadence. Cadence basis for the eligible audience: personal ${basisCounts.personal}, merchant median ${basisCounts.merchant}.`,
    `Estimate covers only the ${n} identified customers NOT already reached by an active win-back automation (${netSubtracted} netted out per 26B.11).`,
    posCoverage.coverage.note, // trust rule #9 — coverage disclosure in every readout
  );

  // ---- Measurement + confidence -------------------------------------------
  const flowDataReliable = snapshot.flowMembershipSource === "flow_membership";
  const contaminationCaveats = flowDataReliable
    ? []
    : [
        snapshot.flowMembershipSource === "event_proxy"
          ? "Active-automation exclusions derived from recent campaign event history (proxy) — contamination risk, confidence lowered (26A.5)."
          : "Email automation membership unavailable — active-automation exclusion could not be verified; contamination risk flagged and confidence lowered (26A.5).",
      ];
  const measurementPlan = buildLocalEmailMeasurementPlan({
    recipeId: "local_lapsed_regular",
    eligibleAudienceSize: n,
    holdoutPercent: cfg.holdoutPercent,
    minHoldoutAudience: cfg.minHoldoutAudience,
    activationLevel: ACTIVATION_LEVEL,
    extraCaveats: [...contaminationCaveats, posCoverage.coverage.note],
  });

  // Trust rule #9: identified-transaction share LOWERS source completeness.
  const { confidence, inputs: confidenceInputs } = scoreConfidence({
    dataFresh: allSourcesFresh(snapshot),
    audienceSize: n,
    consentRatio: consideredLapsed > 0 ? n / consideredLapsed : 0,
    baseline,
    activationLevel: ACTIVATION_LEVEL,
    measurementMode: measurementPlan.mode,
    sourceCompleteness: coverageAdjustedCompleteness(
      identityJoinCoverage(customers),
      posCoverage.identifiedShare,
    ),
    recipeMaturity: "new",
    flowExclusionReliable: flowDataReliable,
  });
  confidenceInputs.pos_identified_coverage = coverageConfidenceInput(posCoverage);

  // ---- Explanation contract (PRD 4.4) -------------------------------------
  const estimateCopy = estimate
    ? `an estimated ${fmtDollars(estimate.low)}-${fmtDollars(estimate.high)} (${estimate.label === "merchant_historical" ? "merchant historical" : "modeled estimate"})`
    : "value shown without a dollar figure because no baseline exists";
  const explanation: ExplanationContract = {
    found: `${n} identified regulars are past ${cfg.cadenceMultiplier}x their expected visit cadence and are not already covered by an existing win-back automation. ${posCoverage.coverage.note}`,
    whyItMatters: `Lapsed regulars are the cheapest in-store revenue to win back — ${estimateCopy} beyond what your current automations already recover.`,
    dataUsed: [
      "POS (Square-like) purchase / repeat_purchase / refund events — identified (loyalty-matched) transactions only",
      "Per-customer visit interval stats (personal median cadence, merchant-median fallback)",
      "Email consent status (Mailchimp-like list)",
      "Existing win-back automation membership (26B.11)",
      "Suppression list and manual exclusions",
    ],
    dataFreshness: snapshot.freshness,
    assumptions,
    risk: "Win-back emails to lapsed regulars can cause unsubscribes if the lapse was intentional (moved away, dietary change). Refund-heavy customers are excluded by rule, and the first touch is non-discount.",
    approvalNeeded:
      "Draft only — creating this draft sends nothing (26A.4). Win-back email (personal we-miss-you note first, small offer only if Operating Rules allow) requires explicit approval before any customer-facing send.",
    measurementPlan,
  };

  const result: RecipeResult<"local_lapsed_regular"> = {
    recipeId: "local_lapsed_regular",
    recipeVersion: RECIPE_VERSION,
    title: "Win back lapsed regulars",
    category: "winback",
    sourceSignal: `Identified POS visit gap > ${cfg.cadenceMultiplier}x expected cadence (personal median with >= ${cfg.minVisitsForPersonalCadence} visits and >= ${cfg.minIntervalsForPersonalCadence} intervals; merchant-median fallback). Identified customers only.`,
    audience: {
      name: "Lapsed regulars — identified customers",
      inclusionRules: {
        identifiedCustomersOnly: true,
        gapExceedsCadenceMultiplier: cfg.cadenceMultiplier,
        personalCadenceMinVisits: cfg.minVisitsForPersonalCadence,
        personalCadenceMinIntervals: cfg.minIntervalsForPersonalCadence,
        cadenceFallback: "merchant median visit cadence",
        emailConsentRequired: true,
        cadenceBasisCounts: basisCounts,
        identifiedTransactionShare: posCoverage.identifiedShare,
      },
      exclusionRules: Object.fromEntries(exclusions.map((e) => [e.reason, e.count])),
      size: n,
      eligibleChannels: ["mailchimp_email"],
      customerIds: eligible.map((p) => p.customer.id),
    },
    exclusionsApplied: exclusions.map((e) => `${e.reason} (${e.count})`),
    estimate,
    confidence,
    confidenceInputs,
    recommendedAction: "klaviyo_winback_flow", // existing email action type; Mailchimp-style draft rides the same ladder
    activationLevel: ACTIVATION_LEVEL,
    measurementPlan,
    explanation,
    dataAsOf: input.dataAsOf,
    dedupKey: `${input.accountId}:${input.recipeId}`,
    coverage: posCoverage.coverage, // REQUIRED for LOCAL results (trust rule #9)
  };

  if (n === 0) {
    result.noOpportunity = {
      checked: [
        { what: "identified customers with POS purchase history", count: profiles.length },
        { what: "identified customers past expected visit cadence", count: consideredLapsed },
        { what: "eligible after consent/suppression/automation exclusions", count: n },
      ],
      whyNotQualified:
        consideredLapsed === 0
          ? "No identified customer is past their expected visit cadence (or no cadence could be established from personal or merchant history). Unidentified walk-in sales cannot be evaluated."
          : `All ${consideredLapsed} lapsed regulars were excluded: ${exclusions.map((e) => `${e.reason} (${e.count})`).join(", ")}.`,
      nearestNextAction: "Run the catering / large-order upsell scan.",
      unlocks:
        "Growing the loyalty program raises the identified-transaction share and unlocks more win-back coverage.",
    };
  }

  return result;
}
