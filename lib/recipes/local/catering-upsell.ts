/**
 * lib/recipes/local/catering-upsell.ts — LOCAL Recipe: Catering / Large-Order Upsell.
 *
 * Detects identified (loyalty-matched) customers with repeated catering-scale
 * POS orders (>= largeOrderThreshold, >= minLargeOrders within lookbackDays)
 * who are not yet tagged as catering customers. Trust rules:
 *  - Tiny audience by design (~18 in demo data) and an exportable-brief
 *    activation level, so measurement is ALWAYS before/after, no control —
 *    the holdout branch still exists structurally and would trigger only at
 *    >= minHoldoutAudience (500) with an enforceable activation level (26A.1).
 *  - Estimate is ALWAYS labeled "modeled" (no merchant catering baseline
 *    exists by definition — these customers are not yet catering customers).
 *  - NEVER counted in the found-money header (isFoundMoneyEligible excludes
 *    catering_upsell categorically — lib/contracts.ts is law).
 *  - Coverage disclosure attached (identified customers only, trust rule #9).
 *
 * Snapshot conventions (soft contract with lib/demo/local):
 *  - "already tagged catering": Customer.sourceReferences Json carries
 *    { tags: [..., "catering", ...] } (case-insensitive).
 *  - An active existing flow of type "other" whose name contains "catering"
 *    nets out its members (26B.11 analogue for prior catering outreach).
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
  allSourcesFresh,
  eventsByCustomer,
  fmtDollars,
  fmtPct,
  identityJoinCoverage,
  isFlowMember,
  roundDollars,
  sortCustomers,
  unsubscribedCustomerIds,
} from "../shared";
import {
  RECIPE_VERSION,
  type ExclusionTally,
  type ExistingFlowSnapshot,
  type RecipeDataSnapshot,
} from "../types";
import {
  computePosCoverage,
  coverageAdjustedCompleteness,
  coverageConfidenceInput,
} from "./coverage";
import { buildLocalEmailMeasurementPlan } from "./measurement";

/** Refund-heavy threshold — same dissatisfaction proxy as every other recipe. */
const REFUND_HEAVY_RATE = 0.3;
/** Modeled upper-bound multiplier over the conservative upsell rate. */
const MODELED_HIGH_MULTIPLIER = 1.5;
/**
 * Personal outreach email brief — the owner sends it personally. This level
 * can never enforce a holdout exclusion (26A.1), so catering measurement is
 * always before/after, no control.
 */
const ACTIVATION_LEVEL = "exportable_brief" as const;

/** "Already tagged catering" — Customer.sourceReferences.tags convention. */
function hasCateringTag(c: Customer): boolean {
  const refs = c.sourceReferences;
  if (typeof refs !== "object" || refs === null || Array.isArray(refs)) return false;
  const tags = (refs as Record<string, unknown>).tags;
  return (
    Array.isArray(tags) &&
    tags.some((t) => typeof t === "string" && t.toLowerCase() === "catering")
  );
}

/** Lowercase emails of members of ACTIVE "other" flows named like catering outreach. */
function activeCateringOutreachEmails(flows: ExistingFlowSnapshot[]): Set<string> {
  const emails = new Set<string>();
  for (const f of flows) {
    if (!f.active || f.type !== "other") continue;
    if (!f.name.toLowerCase().includes("catering")) continue;
    for (const email of f.memberCustomerEmails) emails.add(email.toLowerCase());
  }
  return emails;
}

export function runCateringUpsell(
  input: RecipeInput<"catering_upsell">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"catering_upsell"> {
  const cfg = input.config;
  const asOfMs = new Date(input.dataAsOf).getTime();
  const lookbackStartMs = asOfMs - cfg.lookbackDays * MS_PER_DAY;

  const customers = sortCustomers(snapshot.customers);
  const purchasesByCustomer = eventsByCustomer(snapshot.events, [
    "purchase",
    "repeat_purchase",
  ]);
  const unsubscribed = unsubscribedCustomerIds(snapshot.events);
  const cateringOutreachEmails = activeCateringOutreachEmails(snapshot.existingFlows);
  const heldOut = new Set(
    snapshot.heldOutCustomerIdsByActionType.klaviyo_winback_flow ?? [],
  );
  const manualExcluded = new Set(snapshot.manualExclusionCustomerIds);

  // POS coverage disclosure (trust rule #9).
  const posCoverage = computePosCoverage(snapshot);

  // ---- Candidates: identified customers with catering-scale POS orders ----
  interface Candidate {
    customer: Customer;
    largeOrderCount: number;
    largeOrderValues: number[];
  }
  const candidates: Candidate[] = [];
  let identifiedWithRecentPurchases = 0;
  for (const c of customers) {
    const purchases = purchasesByCustomer.get(c.id) ?? [];
    const recent = purchases.filter(
      (e) => e.eventTimestamp.getTime() >= lookbackStartMs,
    );
    if (recent.length === 0) continue;
    identifiedWithRecentPurchases += 1;
    const largeOrderValues = recent
      .map((e) => e.value)
      .filter((v): v is number => typeof v === "number" && v >= cfg.largeOrderThreshold);
    if (largeOrderValues.length >= cfg.minLargeOrders) {
      candidates.push({
        customer: c,
        largeOrderCount: largeOrderValues.length,
        largeOrderValues,
      });
    }
  }

  // ---- Exclusions -----------------------------------------------------------
  const tally = new Map<string, number>();
  const bump = (reason: string) => tally.set(reason, (tally.get(reason) ?? 0) + 1);

  const eligible: Candidate[] = [];
  let netSubtracted = 0;
  for (const cand of candidates) {
    const c = cand.customer;
    if (hasCateringTag(c)) {
      bump("already tagged as a catering customer");
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
    if (!c.consentEmail) {
      bump("no email consent");
      continue;
    }
    if ((c.refundRate ?? 0) >= REFUND_HEAVY_RATE) {
      bump("refund-heavy customer (dissatisfaction signal)");
      continue;
    }
    if (isFlowMember(c, cateringOutreachEmails)) {
      bump("already in active catering outreach (netted out per 26B.11)");
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
    eligible.push(cand);
  }

  const exclusions: ExclusionTally[] = [...tally.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([reason, count]) => ({ reason, count }));
  const n = eligible.length;

  // ---- Estimate — ALWAYS modeled, always a range ---------------------------
  // No merchant catering baseline can exist for customers who are not yet
  // catering customers, so the merchant-historical branch is intentionally
  // absent (task law: estimate labeled modeled).
  let avgLargeTicket: number | null = null;
  if (n > 0) {
    let sum = 0;
    let count = 0;
    for (const cand of eligible) {
      for (const v of cand.largeOrderValues) {
        sum += v;
        count += 1;
      }
    }
    avgLargeTicket = count > 0 ? sum / count : null;
  }

  let estimate: EstimateRange | null = null;
  const assumptions: string[] = [];
  if (avgLargeTicket !== null && n > 0) {
    estimate = {
      low: roundDollars(cfg.conservativeUpsellRate * n * avgLargeTicket),
      high: roundDollars(
        cfg.conservativeUpsellRate * MODELED_HIGH_MULTIPLIER * n * avgLargeTicket,
      ),
      label: "modeled",
    };
    assumptions.push(
      `MODELED ASSUMPTION (editable, 26A.6): conservative upsell rate ${fmtPct(cfg.conservativeUpsellRate)} — no merchant catering baseline exists for customers not yet doing catering. Range spans 1x-${MODELED_HIGH_MULTIPLIER}x the conservative rate.`,
      `Average catering-scale order value ${fmtDollars(avgLargeTicket)} across the ${n} eligible customers' qualifying orders (>= ${fmtDollars(cfg.largeOrderThreshold)}).`,
    );
  } else if (n > 0) {
    assumptions.push(
      "Qualifying large orders carry no order values, so no dollar estimate is shown (PRD 16.3 step 4).",
    );
  }
  assumptions.push(
    `Catering-scale defined as a POS order >= ${fmtDollars(cfg.largeOrderThreshold)}; qualification requires >= ${cfg.minLargeOrders} such orders in the last ${cfg.lookbackDays} days.`,
    `This opportunity is never counted in the found-money header (upsell estimates are modeled, not recovered revenue). ${netSubtracted} customers already in catering outreach were netted out (26B.11).`,
    posCoverage.coverage.note, // trust rule #9 — coverage disclosure in every readout
  );

  // ---- Measurement + confidence -------------------------------------------
  // Exportable brief -> holdout can never be enforced (26A.1): ALWAYS
  // before/after, no control. The >= 500 holdout branch exists in the shared
  // builder and stays dormant for this audience size by design.
  const measurementPlan = buildLocalEmailMeasurementPlan({
    recipeId: "catering_upsell",
    eligibleAudienceSize: n,
    holdoutPercent: cfg.holdoutPercent,
    minHoldoutAudience: cfg.minHoldoutAudience,
    activationLevel: ACTIVATION_LEVEL,
    extraCaveats: [posCoverage.coverage.note],
  });

  const { confidence, inputs: confidenceInputs } = scoreConfidence({
    dataFresh: allSourcesFresh(snapshot),
    audienceSize: n,
    consentRatio: candidates.length > 0 ? n / candidates.length : 0,
    baseline: "modeled",
    activationLevel: ACTIVATION_LEVEL,
    measurementMode: measurementPlan.mode,
    sourceCompleteness: coverageAdjustedCompleteness(
      identityJoinCoverage(customers),
      posCoverage.identifiedShare,
    ),
    recipeMaturity: "new",
  });
  confidenceInputs.pos_identified_coverage = coverageConfidenceInput(posCoverage);

  // ---- Explanation contract (PRD 4.4) -------------------------------------
  const estimateCopy = estimate
    ? `a modeled ${fmtDollars(estimate.low)}-${fmtDollars(estimate.high)} if a conservative share converts to a catering relationship`
    : "no dollar estimate (no order values available)";
  const explanation: ExplanationContract = {
    found: `${n} identified customers placed >= ${cfg.minLargeOrders} catering-scale orders (>= ${fmtDollars(cfg.largeOrderThreshold)}) in the last ${cfg.lookbackDays} days and are not yet tagged as catering customers. ${posCoverage.coverage.note}`,
    whyItMatters: `Repeated large orders usually mean an office, event, or team behind the counter visit — a personal catering pitch is warranted and worth ${estimateCopy}.`,
    dataUsed: [
      "POS (Square-like) purchase events with order values — identified (loyalty-matched) transactions only",
      "Customer catering tags (source references)",
      "Email consent status (Mailchimp-like list)",
      "Existing catering outreach membership (26B.11)",
      "Suppression list and manual exclusions",
    ],
    dataFreshness: snapshot.freshness,
    assumptions,
    risk: "A catering pitch to someone buying large personal orders can feel presumptuous. The draft is a personal note from the owner, not an automated campaign, and the audience is deliberately small.",
    approvalNeeded:
      "Draft only — creating this brief sends nothing (26A.4). The personal outreach email brief requires explicit approval, and the owner sends each note individually.",
    measurementPlan,
  };

  const result: RecipeResult<"catering_upsell"> = {
    recipeId: "catering_upsell",
    recipeVersion: RECIPE_VERSION,
    title: "Pitch catering to repeat large-order customers",
    category: "upsell",
    sourceSignal: `Identified POS orders >= ${fmtDollars(cfg.largeOrderThreshold)}, ${cfg.minLargeOrders}+ times in ${cfg.lookbackDays} days, no catering tag. Identified customers only.`,
    audience: {
      name: "Catering upsell — repeat large-order customers",
      inclusionRules: {
        identifiedCustomersOnly: true,
        largeOrderThreshold: cfg.largeOrderThreshold,
        minLargeOrders: cfg.minLargeOrders,
        lookbackDays: cfg.lookbackDays,
        notYetTaggedCatering: true,
        emailConsentRequired: true,
        identifiedTransactionShare: posCoverage.identifiedShare,
      },
      exclusionRules: Object.fromEntries(exclusions.map((e) => [e.reason, e.count])),
      size: n,
      eligibleChannels: ["mailchimp_email"],
      customerIds: eligible.map((cand) => cand.customer.id),
    },
    exclusionsApplied: exclusions.map((e) => `${e.reason} (${e.count})`),
    estimate,
    confidence,
    confidenceInputs,
    recommendedAction: "klaviyo_winback_flow", // existing email action type; brief-level activation
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
        {
          what: "identified customers with purchases in the lookback window",
          count: identifiedWithRecentPurchases,
        },
        { what: "customers with repeated catering-scale orders", count: candidates.length },
        { what: "eligible after tag/consent/suppression exclusions", count: n },
      ],
      whyNotQualified:
        candidates.length === 0
          ? `No identified customer placed >= ${cfg.minLargeOrders} orders of ${fmtDollars(cfg.largeOrderThreshold)}+ in the last ${cfg.lookbackDays} days. Unidentified walk-in sales cannot be evaluated.`
          : `All ${candidates.length} large-order customers were excluded: ${exclusions.map((e) => `${e.reason} (${e.count})`).join(", ")}.`,
      nearestNextAction: "Run the lapsed regulars win-back scan.",
      unlocks:
        "Growing the loyalty program raises the identified-transaction share and surfaces more large-order buyers.",
    };
  }

  return result;
}
