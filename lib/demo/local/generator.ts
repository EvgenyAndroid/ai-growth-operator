/**
 * lib/demo/local/generator.ts — deterministic LOCAL-vertical demo merchant
 * (PRD 25.1, LOCAL pack): "Cardamom & Rye", a bakery-café on a Square-like
 * POS + Mailchimp-like email + Google Business Profile, driving IN-STORE
 * purchases.
 *
 * Fixed seed + the same fixed reference date as the DTC demo => byte-identical
 * dataset on every run. No Date.now()-dependent randomness anywhere.
 *
 * Engineered targets (so the LOCAL recipes hit the intended paths):
 * - ~640 identified (loyalty-matched) customers PLUS an anonymous walk-in
 *   transaction mass sized so the identified share of POS purchases lands at
 *   ~65%. The exact share is computed from the generated events and stored on
 *   the dataset (`coverageStats`) — the seeder persists it to the Preference
 *   key "pos_identified_coverage" where the LOCAL recipes read it for the
 *   POS coverage disclosure (trust rule #9).
 * - ~7000 POS purchase events over 180 days with strong PERSONAL WEEKLY
 *   cadence for regulars.
 * - Exactly 180 recipe-eligible lapsed regulars (consented, unsuppressed,
 *   >=3 visits, >=2 intervals, gap > 1.5x personal median visit cadence) —
 *   DELIBERATELY below the 500 holdout floor so local_lapsed_regular exercises
 *   the before/after-no-control path (PRD 14.2/14.6).
 * - 25 large catering-signal orders (value >= catering_upsell
 *   largeOrderThreshold 60, within the 90-day lookback) from 18 customers.
 * - Consent mix: email consent ~70%; consentAds false for ~40% (26B.13).
 * - One HISTORICAL completed email action (launched 38 days before the
 *   reference date) measured BEFORE/AFTER with NO holdout — the audience was
 *   210, under the 500 minimum — so performance history shows the
 *   before-after-no-control label on day 0.
 */

import type {
  ContractLifecycleStage,
  DemoDataset,
  IdentifiedCoverage,
} from "../../contracts";
import { buildIdentifiedCoverage } from "../../verticals";
import { Rng, money } from "../prng";
import { DEMO_REFERENCE_DATE } from "../generator";
import { buildLocalCatalog, type LocalDemoProduct } from "./catalog";

// ---------------------------------------------------------------------------
// Fixed anchors — determinism
// ---------------------------------------------------------------------------

/** New seed constant for the LOCAL pack (never share the DTC stream). */
export const LOCAL_DEMO_SEED = 0x10ca1ca;
/** Same fixed reference "now" as the DTC demo dataset. */
export const LOCAL_DEMO_REFERENCE_DATE = DEMO_REFERENCE_DATE;
export const LOCAL_DEMO_ACCOUNT_NAME = "Cardamom & Rye (Demo)";

/** Mailchimp-like campaign id for the historical lapsed-regular send. */
export const HISTORICAL_LOCAL_CAMPAIGN_ID =
  "mailchimp-campaign:lapsed-regulars-2026-05";

/** Target identified (loyalty-matched) share of POS purchase transactions. */
export const LOCAL_IDENTIFIED_SHARE_TARGET = 0.65;

/**
 * Soft contract with the LOCAL recipes phase (`lib/recipes/local/`): the
 * seeder persists `coverageStats` under this Preference key; local recipes
 * read it to attach the `IdentifiedCoverage` disclosure to every result.
 */
export const POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY = "pos_identified_coverage";

// ---------------------------------------------------------------------------
// Cohort plan (640 identified customers)
// ---------------------------------------------------------------------------

export const LOCAL_COHORT_SIZES = {
  /** Strong personal weekly cadence, last visit within cadence. */
  weeklyRegulars: 110,
  /** Lapsed regulars, eligible: last visit 55-85 days ago (did NOT return after the May send). */
  deepLapsed: 138,
  /** Lapsed regulars, eligible: returned once after the May send (19-28 days ago), lapsed again. */
  reLapsedReturners: 42,
  /** Returned after the May send and kept visiting — active again today. */
  wonBackRegulars: 30,
  /** Lapsed cadence but consentEmail=false. */
  lapsedNoConsent: 24,
  /** Lapsed cadence but unsubscribed/suppressed. */
  lapsedSuppressed: 16,
  /** Catering-signal customers: regular visits + large catering orders. */
  cateringBuyers: 18,
  /** Light history walk-ins who joined loyalty (1-3 visits). */
  casualIdentified: 262,
} as const;

export type LocalCohort = keyof typeof LOCAL_COHORT_SIZES;

/** deepLapsed + reLapsedReturners = the ~180 recipe-eligible lapsed cohort. */
export const LOCAL_ELIGIBLE_LAPSED_COUNT =
  LOCAL_COHORT_SIZES.deepLapsed + LOCAL_COHORT_SIZES.reLapsedReturners; // 180 < 500

// ---------------------------------------------------------------------------
// Internal (superset) types — assignable to the DemoDataset contract
// ---------------------------------------------------------------------------

/**
 * Contract event + persistence hints. `source` stays the contract literal
 * "demo"; `posSource` tells the seeder to persist Event.source = "square" for
 * POS orders (schema comment: POS orders reuse Event/purchase with source
 * "square"). Email events persist as "demo" — "mailchimp" is not a legal
 * Event.source value in this phase.
 */
export type LocalEventDraft = DemoDataset["events"][number] & {
  posSource?: "square";
  campaignId?: string;
};

/** Contract constitution + the LOCAL template extras the seeder persists. */
export type LocalConstitutionSpec = DemoDataset["constitution"] & {
  templateDisplayName: string; // "Local & multi-location service"
  marginFloorPercent: number;
  /** Holiday blackout dates (ISO yyyy-mm-dd). */
  blackoutDates: string[];
  frequencyCaps: {
    emailPerCustomerPerWeek: number;
    smsPerCustomerPerWeek: number;
    quietHours: { start: string; end: string; note: string };
  };
};

export interface LocalCoverageStats {
  /** identifiedPurchases / totalPurchases — lands ~0.65 by construction. */
  identifiedShare: number;
  identifiedPurchases: number;
  anonymousPurchases: number;
  totalPurchases: number;
  lookbackDays: number;
  /** Ready-to-render disclosure (trust rule #9). */
  coverage: IdentifiedCoverage;
}

/** The historical before/after email action (NO holdout — audience 210). */
export interface HistoricalLocalCampaign {
  /** Days before the reference date the send went out. */
  launchDaysAgo: number;
  audienceName: string;
  campaignId: string;
  /** 210 — deliberately under the 500 holdout minimum. */
  audienceEmails: string[];
  /** Members with an in-store purchase in the 21 days BEFORE the send. */
  returnedBeforeEmails: string[];
  /** Members with an in-store purchase in the 21 days AFTER the send. */
  returnedAfterEmails: string[];
  returnRateBefore: number;
  returnRateAfter: number;
  revenueBeforeWindow: number;
  revenueAfterWindow: number;
  /** Estimated range only — before/after cannot support a causal lift claim. */
  estimatedIncrementalRevenueLow: number;
  estimatedIncrementalRevenueHigh: number;
}

export interface LocalDemoDatasetInternal extends DemoDataset {
  seed: number;
  referenceDate: string;
  constitution: LocalConstitutionSpec;
  events: LocalEventDraft[];
  /** Cohort tag -> member emails (for the seeder + smoke assertions). */
  cohorts: Record<LocalCohort, string[]>;
  coverageStats: LocalCoverageStats;
  historicalCampaign: HistoricalLocalCampaign;
}

/**
 * NOTE on id fields: the frozen DemoDataset customer shape is DTC-named. For
 * the LOCAL merchant, `shopifyId` carries the SQUARE loyalty customer id
 * (sq_*) and `klaviyoId` carries the MAILCHIMP subscriber id (mc_*); the
 * LOCAL seeder maps them into sourceCustomerIds { square, mailchimp }.
 */
type LocalDemoCustomer = DemoDataset["customers"][number];

interface CustomerStory {
  cohort: LocalCohort;
  customer: LocalDemoCustomer;
  events: LocalEventDraft[];
}

// ---------------------------------------------------------------------------
// Name / email pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "amara", "bea", "colin", "dara", "edie", "franco", "greta", "hollis", "ines",
  "jonah", "kira", "luca", "mabel", "nico", "odette", "piotr", "queenie", "rafa",
  "sena", "tobias", "uma", "vince", "willa", "xander", "yusuf", "zadie", "arlo",
  "birdie", "caspian", "delphine", "ezra", "flora", "gideon", "hazel", "ivo",
  "juniper", "kofi", "leona", "marcel", "noor", "ophelia", "petra", "quill",
  "romy", "sylvie", "tamsin", "ursula", "viggo", "winona", "yael",
] as const;
const LAST_NAMES = [
  "ashby", "birch", "crane", "dunmore", "eaves", "farrow", "gale", "hartwell",
  "iverson", "juno", "kessler", "larkspur", "molnar", "north", "oakden",
  "pemberton", "quiroga", "rooke", "salter", "thistle", "unger", "varga",
  "wexford", "xu", "yarrow", "zoller", "alcott", "bellamy", "cutler",
  "danforth", "ellery", "fenwick", "grove", "hale", "irwin", "jessup",
  "knox", "linden", "marsh", "noble",
] as const;
const EMAIL_DOMAINS = [
  "demo-mail.example.com",
  "inbox.example.net",
  "post.example.org",
] as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateLocalDemoDataset(
  referenceDate: string = LOCAL_DEMO_REFERENCE_DATE
): LocalDemoDatasetInternal {
  const rng = new Rng(LOCAL_DEMO_SEED);
  const refMs = new Date(referenceDate).getTime();
  const iso = (daysAgo: number): string =>
    new Date(refMs - daysAgo * 86400000).toISOString();

  const products = buildLocalCatalog(new Rng(LOCAL_DEMO_SEED ^ 0xba6e1));
  const cateringPool = products.filter((p) => p.category === "catering");
  const counterPool = products.filter((p) => p.category !== "catering");
  const smallTicketPool = products.filter(
    (p) => p.category === "pastries" || p.category === "coffee-drinks"
  );

  let emailCounter = 0;
  const nextIdentity = (): { emailLower: string; squareId: string } => {
    emailCounter += 1;
    const emailLower = `${rng.pick(FIRST_NAMES)}.${rng.pick(LAST_NAMES)}.${emailCounter}@${rng.pick(EMAIL_DOMAINS)}`;
    return { emailLower, squareId: `sq_${String(200000 + emailCounter)}` };
  };

  /** Typical café counter ticket: 1-3 items, mostly pastries + drinks. */
  const counterTicket = (): { product: LocalDemoProduct; value: number } => {
    const product = rng.chance(0.78) ? rng.pick(smallTicketPool) : rng.pick(counterPool);
    const items = rng.chance(0.55) ? 1 : rng.chance(0.7) ? 2 : 3;
    // Basket value anchored on the headline product plus sides.
    const value = money(product.price * items * rng.float(0.95, 1.35));
    return { product, value };
  };

  /** Catering-scale order — always at/above the largeOrderThreshold (60). */
  const cateringTicket = (): { product: LocalDemoProduct; value: number } => {
    const product = rng.pick(cateringPool);
    const value = money(Math.max(68, product.price * rng.float(1.0, 1.5)));
    return { product, value };
  };

  interface VisitSpec {
    daysAgo: number;
    product: LocalDemoProduct;
    value: number;
    catering?: boolean;
  }

  const visitsAt = (daysAgoList: number[]): VisitSpec[] =>
    daysAgoList
      .slice()
      .sort((a, b) => b - a) // oldest first
      .map((daysAgo) => ({ daysAgo, ...counterTicket() }));

  /** Weekly regular: personal median 5-9 days, last visit within cadence. */
  const regularDaysAgo = (): number[] => {
    const base = rng.int(5, 9);
    const n = Math.min(rng.int(18, 26), Math.floor(168 / base) + 1);
    const gap = rng.int(1, base);
    const out: number[] = [gap];
    let d = gap;
    for (let i = 1; i < n; i += 1) {
      d += Math.max(3, Math.round(base * rng.float(0.8, 1.25)));
      if (d > 176) break; // stay inside the 180-day event window
      out.push(d);
    }
    return out;
  };

  /** Deep lapsed: weekly cadence historically, silent for 55-85 days. */
  const deepLapsedDaysAgo = (gapMin = 55, gapMax = 85): number[] => {
    const base = rng.int(6, 10);
    const n = rng.int(4, 7);
    const gap = rng.int(gapMin, gapMax);
    const out: number[] = [gap];
    let d = gap;
    for (let i = 1; i < n; i += 1) {
      d += Math.max(3, Math.round(base * rng.float(0.8, 1.3)));
      if (d > 176) break; // stay inside the 180-day event window
      out.push(d);
    }
    return out; // median ~base (6-13); gap 55-85 >> 1.5x median
  };

  /**
   * Re-lapsed returner: was lapsed at the May send (T-38), came back ONCE
   * 19-28 days ago (inside the campaign's 21-day after-window), and has
   * lapsed again — gap 19-28 still exceeds 1.5x the weekly personal median.
   */
  const reLapsedDaysAgo = (): number[] => {
    const returnGap = rng.int(19, 28);
    const base = rng.int(6, 9);
    const priorStart = rng.int(50, 72);
    const nPrior = rng.int(3, 5);
    const out: number[] = [returnGap, priorStart];
    let d = priorStart;
    for (let i = 1; i < nPrior; i += 1) {
      d += Math.max(3, Math.round(base * rng.float(0.8, 1.25)));
      out.push(d);
    }
    return out; // intervals: one long (~25-50) + weekly ones => median stays weekly
  };

  /** Won back: lapsed at the send, returned 20-34 days ago, weekly since. */
  const wonBackDaysAgo = (): number[] => {
    const firstReturn = rng.int(20, 34);
    const out: number[] = [];
    let d = rng.int(2, 6);
    while (d < firstReturn) {
      out.push(d);
      d += rng.int(5, 9);
    }
    out.push(firstReturn);
    const priorStart = rng.int(52, 75);
    const base = rng.int(6, 10);
    const nPrior = rng.int(2, 4);
    let p = priorStart;
    out.push(p);
    for (let i = 1; i < nPrior; i += 1) {
      p += Math.max(3, Math.round(base * rng.float(0.85, 1.25)));
      out.push(p);
    }
    return out;
  };

  /** Casual: 1-3 visits, no reliable cadence. */
  const casualDaysAgo = (): number[] => {
    const out: number[] = [rng.int(5, 170)];
    const n = rng.int(1, 3);
    for (let i = 1; i < n; i += 1) {
      const next = (out[out.length - 1] as number) + rng.int(20, 55);
      if (next > 176) break;
      out.push(next);
    }
    return out;
  };

  /** Catering buyer: relaxed regular cadence (base 7-12 days). */
  const cateringVisitDaysAgo = (): number[] => {
    const base = rng.int(7, 12);
    const n = rng.int(7, 11);
    const gap = rng.int(2, base);
    const out: number[] = [gap];
    let d = gap;
    for (let i = 1; i < n; i += 1) {
      d += Math.max(4, Math.round(base * rng.float(0.8, 1.3)));
      if (d > 176) break; // stay inside the 180-day event window
      out.push(d);
    }
    return out;
  };

  // -------------------------------------------------------------------------
  // Story assembly
  // -------------------------------------------------------------------------

  const stories: CustomerStory[] = [];

  interface BuildOpts {
    cohort: LocalCohort;
    daysAgoList: number[];
    consentEmail: boolean;
    suppressed: boolean;
    lifecycleOverride?: ContractLifecycleStage;
    cateringOrderDays?: number[];
  }

  const build = (opts: BuildOpts): CustomerStory => {
    const { emailLower, squareId } = nextIdentity();
    const events: LocalEventDraft[] = [];

    const visits: VisitSpec[] = visitsAt(opts.daysAgoList);
    for (const day of opts.cateringOrderDays ?? []) {
      visits.push({ daysAgo: day, catering: true, ...cateringTicket() });
    }
    visits.sort((a, b) => b.daysAgo - a.daysAgo); // oldest first

    for (const v of visits) {
      events.push({
        customerEmailLower: emailLower,
        eventType: "purchase",
        eventTimestamp: iso(v.daysAgo),
        source: "demo",
        posSource: "square",
        sourceProductId: v.product.sourceProductId,
        value: v.value,
      });
    }

    if (opts.suppressed) {
      events.push({
        customerEmailLower: emailLower,
        eventType: "unsubscribe",
        eventTimestamp: iso(rng.int(20, 120)),
        source: "demo",
      });
    }

    // --- aggregates ---
    const totalOrders = visits.length;
    const totalRevenue = money(visits.reduce((sum, v) => sum + v.value, 0));
    const intervals: number[] = [];
    for (let i = 1; i < visits.length; i += 1) {
      intervals.push((visits[i - 1] as VisitSpec).daysAgo - (visits[i] as VisitSpec).daysAgo);
    }

    let lifecycleStage: ContractLifecycleStage;
    if (opts.lifecycleOverride !== undefined) lifecycleStage = opts.lifecycleOverride;
    else if (totalOrders === 0) lifecycleStage = "prospect";
    else if (totalOrders === 1) lifecycleStage = "first_purchase";
    else lifecycleStage = "repeat";

    const hasMailchimp = opts.consentEmail || rng.chance(0.25);

    const customer: LocalDemoCustomer = {
      emailLower,
      consentEmail: opts.consentEmail,
      consentAds: rng.chance(0.6), // ~40% false (26B.13 mix)
      lifecycleStage,
      ...(visits.length > 0
        ? {
            firstPurchaseDate: iso((visits[0] as VisitSpec).daysAgo),
            lastPurchaseDate: iso((visits[visits.length - 1] as VisitSpec).daysAgo),
          }
        : {}),
      totalOrders,
      totalRevenue,
      suppressionStatus: opts.suppressed ? "suppressed" : "none",
      ...(intervals.length > 0 ? { purchaseIntervalDays: intervals } : {}),
      // Contract field names are DTC-shaped: shopifyId carries the SQUARE
      // loyalty id; klaviyoId carries the MAILCHIMP subscriber id (see note
      // on LocalDemoDatasetInternal). The local seeder maps them to
      // sourceCustomerIds { square, mailchimp }.
      shopifyId: squareId,
      ...(hasMailchimp ? { klaviyoId: `mc_${String(900000 + emailCounter)}` } : {}),
    };

    const story: CustomerStory = { cohort: opts.cohort, customer, events };
    stories.push(story);
    return story;
  };

  for (let i = 0; i < LOCAL_COHORT_SIZES.weeklyRegulars; i += 1) {
    build({
      cohort: "weeklyRegulars",
      daysAgoList: regularDaysAgo(),
      consentEmail: rng.chance(0.72),
      suppressed: false,
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.deepLapsed; i += 1) {
    build({
      cohort: "deepLapsed",
      daysAgoList: deepLapsedDaysAgo(),
      consentEmail: true,
      suppressed: false,
      lifecycleOverride: "lapsed",
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.reLapsedReturners; i += 1) {
    build({
      cohort: "reLapsedReturners",
      daysAgoList: reLapsedDaysAgo(),
      consentEmail: true,
      suppressed: false,
      lifecycleOverride: "lapsed",
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.wonBackRegulars; i += 1) {
    build({
      cohort: "wonBackRegulars",
      daysAgoList: wonBackDaysAgo(),
      consentEmail: true,
      suppressed: false,
      lifecycleOverride: "won_back",
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.lapsedNoConsent; i += 1) {
    build({
      cohort: "lapsedNoConsent",
      daysAgoList: deepLapsedDaysAgo(40, 90),
      consentEmail: false,
      suppressed: false,
      lifecycleOverride: "lapsed",
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.lapsedSuppressed; i += 1) {
    build({
      cohort: "lapsedSuppressed",
      daysAgoList: deepLapsedDaysAgo(40, 90),
      consentEmail: false,
      suppressed: true,
      lifecycleOverride: "lapsed",
    });
  }
  // 25 large catering-signal orders across 18 customers: the first 7 get two
  // (they clear the catering_upsell minLargeOrders=2 default), the other 11
  // show one large order each. All within the 90-day lookback.
  for (let i = 0; i < LOCAL_COHORT_SIZES.cateringBuyers; i += 1) {
    const orderCount = i < 7 ? 2 : 1;
    const days = new Set<number>();
    while (days.size < orderCount) days.add(rng.int(4, 88));
    build({
      cohort: "cateringBuyers",
      daysAgoList: cateringVisitDaysAgo(),
      consentEmail: true,
      suppressed: false,
      cateringOrderDays: [...days],
    });
  }
  for (let i = 0; i < LOCAL_COHORT_SIZES.casualIdentified; i += 1) {
    build({
      cohort: "casualIdentified",
      daysAgoList: casualDaysAgo(),
      consentEmail: rng.chance(0.55),
      suppressed: false,
    });
  }

  // Scattered POS refunds for realism (kept below dissatisfaction levels).
  const refundable = stories.filter((s) => s.customer.totalOrders >= 2);
  for (const story of rng.sample(refundable, 12)) {
    const purchaseEvents = story.events.filter((e) => e.eventType === "purchase");
    const target = rng.pick(purchaseEvents);
    story.events.push({
      customerEmailLower: story.customer.emailLower,
      eventType: "refund",
      eventTimestamp: new Date(
        new Date(target.eventTimestamp).getTime() + rng.float(0.02, 0.5) * 86400000
      ).toISOString(),
      source: "demo",
      posSource: "square",
      ...(target.sourceProductId !== undefined
        ? { sourceProductId: target.sourceProductId }
        : {}),
      ...(target.value !== undefined ? { value: target.value } : {}),
    });
    story.customer.refundRate = money(1 / story.customer.totalOrders);
  }

  // -------------------------------------------------------------------------
  // Cohort index
  // -------------------------------------------------------------------------

  const cohorts = {} as Record<LocalCohort, string[]>;
  for (const key of Object.keys(LOCAL_COHORT_SIZES) as LocalCohort[]) cohorts[key] = [];
  for (const s of stories) cohorts[s.cohort].push(s.customer.emailLower);

  // -------------------------------------------------------------------------
  // Anonymous walk-in transaction mass — sized so the identified share of POS
  // purchases lands at ~65% (LOCAL_IDENTIFIED_SHARE_TARGET). Anonymous events
  // use synthetic non-customer addresses; the seeder persists them with
  // customerId = null.
  // -------------------------------------------------------------------------

  const identifiedPurchases = stories.reduce(
    (sum, s) => sum + s.events.filter((e) => e.eventType === "purchase").length,
    0
  );
  const anonymousPurchases = Math.round(
    (identifiedPurchases * (1 - LOCAL_IDENTIFIED_SHARE_TARGET)) /
      LOCAL_IDENTIFIED_SHARE_TARGET
  );

  const anonymousEvents: LocalEventDraft[] = [];
  for (let i = 0; i < anonymousPurchases; i += 1) {
    const ticket = counterTicket();
    anonymousEvents.push({
      customerEmailLower: `walkin-${String(i + 1).padStart(5, "0")}@anon.pos.invalid`,
      eventType: "purchase",
      eventTimestamp: iso(rng.float(0.05, 179.5)),
      source: "demo",
      posSource: "square",
      sourceProductId: ticket.product.sourceProductId,
      value: ticket.value,
    });
  }

  const totalPurchases = identifiedPurchases + anonymousPurchases;
  const identifiedShare =
    Math.round((identifiedPurchases / totalPurchases) * 10000) / 10000;
  const coverageStats: LocalCoverageStats = {
    identifiedShare,
    identifiedPurchases,
    anonymousPurchases,
    totalPurchases,
    lookbackDays: 180,
    coverage: buildIdentifiedCoverage(identifiedShare),
  };

  // -------------------------------------------------------------------------
  // Historical email action (T-38): lapsed-regular win-back via Mailchimp-like
  // send. Audience 210 (< 500) => NO holdout; measured BEFORE/AFTER only.
  // -------------------------------------------------------------------------

  const LAUNCH_DAYS_AGO = 38;
  const WINDOW_DAYS = 21; // primary read (DEFAULT_MEASUREMENT_WINDOWS.local_lapsed_regular)
  const audienceEmails = [
    ...cohorts.deepLapsed,
    ...cohorts.reLapsedReturners,
    ...cohorts.wonBackRegulars,
  ]; // 210

  const storyByEmail = new Map(stories.map((s) => [s.customer.emailLower, s]));

  // Campaign engagement events (send at T-38, opens shortly after).
  for (const email of audienceEmails) {
    if (!rng.chance(0.62)) continue;
    const story = storyByEmail.get(email);
    if (story === undefined) continue;
    const openDaysAgo = rng.float(35.2, 37.7);
    story.events.push({
      customerEmailLower: email,
      eventType: "email_open",
      eventTimestamp: iso(openDaysAgo),
      source: "demo",
      campaignId: HISTORICAL_LOCAL_CAMPAIGN_ID,
    });
    if (rng.chance(0.2)) {
      story.events.push({
        customerEmailLower: email,
        eventType: "email_click",
        eventTimestamp: iso(Math.max(34.6, openDaysAgo - 0.15)),
        source: "demo",
        campaignId: HISTORICAL_LOCAL_CAMPAIGN_ID,
      });
    }
  }

  // Before/after metrics computed from the ACTUAL generated events.
  const purchasesIn = (email: string, fromDaysAgo: number, toDaysAgo: number) => {
    const story = storyByEmail.get(email);
    if (story === undefined) return { count: 0, revenue: 0 };
    let count = 0;
    let revenue = 0;
    for (const e of story.events) {
      if (e.eventType !== "purchase") continue;
      const daysAgo = (refMs - new Date(e.eventTimestamp).getTime()) / 86400000;
      if (daysAgo > toDaysAgo && daysAgo <= fromDaysAgo) {
        count += 1;
        revenue += e.value ?? 0;
      }
    }
    return { count, revenue };
  };

  const returnedBeforeEmails: string[] = [];
  const returnedAfterEmails: string[] = [];
  let revenueBeforeWindow = 0;
  let revenueAfterWindow = 0;
  for (const email of audienceEmails) {
    const before = purchasesIn(email, LAUNCH_DAYS_AGO + WINDOW_DAYS, LAUNCH_DAYS_AGO);
    const after = purchasesIn(email, LAUNCH_DAYS_AGO, LAUNCH_DAYS_AGO - WINDOW_DAYS);
    if (before.count > 0) returnedBeforeEmails.push(email);
    if (after.count > 0) returnedAfterEmails.push(email);
    revenueBeforeWindow += before.revenue;
    revenueAfterWindow += after.revenue;
  }
  revenueBeforeWindow = money(revenueBeforeWindow);
  revenueAfterWindow = money(revenueAfterWindow);

  const round4 = (n: number): number => Math.round(n * 10000) / 10000;
  const revenueDelta = Math.max(0, revenueAfterWindow - revenueBeforeWindow);

  const historicalCampaign: HistoricalLocalCampaign = {
    launchDaysAgo: LAUNCH_DAYS_AGO,
    audienceName: "Lapsed regulars — May 2026 cohort",
    campaignId: HISTORICAL_LOCAL_CAMPAIGN_ID,
    audienceEmails,
    returnedBeforeEmails,
    returnedAfterEmails,
    returnRateBefore: round4(returnedBeforeEmails.length / audienceEmails.length),
    returnRateAfter: round4(returnedAfterEmails.length / audienceEmails.length),
    revenueBeforeWindow,
    revenueAfterWindow,
    // Conservative estimated range; before/after cannot isolate the campaign
    // effect, so the range is wide and never presented as lift.
    estimatedIncrementalRevenueLow: money(revenueDelta * 0.35),
    estimatedIncrementalRevenueHigh: money(revenueDelta * 0.9),
  };

  // -------------------------------------------------------------------------
  // Existing email programs (Mailchimp-like) + assembly
  // -------------------------------------------------------------------------

  const consentedEmails = stories
    .filter((s) => s.customer.consentEmail)
    .map((s) => s.customer.emailLower);

  const existingFlows: DemoDataset["existingFlows"] = [
    {
      // No active recovery/win-back automation exists at the café — nothing to
      // net local_lapsed_regular estimates against (26B.11).
      type: "other",
      name: "Weekend Bake List (Mailchimp newsletter)",
      active: true,
      memberCustomerEmails: rng.sample(consentedEmails, 300),
    },
  ];

  const events = [...stories.flatMap((s) => s.events), ...anonymousEvents].sort(
    (a, b) => a.eventTimestamp.localeCompare(b.eventTimestamp)
  );

  const dataset: LocalDemoDatasetInternal = {
    seed: LOCAL_DEMO_SEED,
    referenceDate,
    account: { name: LOCAL_DEMO_ACCOUNT_NAME, vertical: "local_service" },
    constitution: {
      // "Local & multi-location service" template v1: lower discount ceiling,
      // quiet hours, holiday blackout dates, food/health banned claims.
      templateDisplayName: "Local & multi-location service",
      monthlyBudgetCap: 1500,
      maxDiscountPercent: 10, // lower ceiling than the DTC template's 15
      dailySendCap: 400,
      marginFloorPercent: 60,
      blackoutDates: [
        "2026-07-04", // Independence Day
        "2026-11-26", // Thanksgiving
        "2026-12-24",
        "2026-12-25",
        "2027-01-01",
      ],
      frequencyCaps: {
        emailPerCustomerPerWeek: 2,
        smsPerCustomerPerWeek: 0,
        quietHours: {
          start: "20:00",
          end: "07:00",
          note: "Quiet hours: no sends before 7am or after 8pm local time — café customers read email at breakfast, not at night.",
        },
      },
      bannedClaims: [
        // Food/health claims added for the local template:
        "boosts immunity",
        "superfood",
        "healthiest",
        "cures",
        // Shared unsupportable-claim guards:
        "treats",
        "prevents",
        "guaranteed",
        "doctor recommended",
        "weight-loss",
        "detox",
        "best",
        "#1",
      ],
      toneGuide:
        "Neighborly, warm, floury. Speak like the baker at the counter, not a brand. " +
        "Name the bake and the day it comes out of the oven; no health claims, no " +
        "superlatives, no urgency theatrics. Respect quiet hours — morning sends only.",
    },
    integrations: [
      { source: "square", mode: "mock", lastSyncAt: iso(1 / 24), freshnessThresholdHours: 24 },
      { source: "mailchimp", mode: "mock", lastSyncAt: iso(2 / 24), freshnessThresholdHours: 24 },
      { source: "gbp", mode: "mock", lastSyncAt: iso(6 / 24), freshnessThresholdHours: 48 },
      { source: "meta", mode: "mock", lastSyncAt: iso(5 / 24), freshnessThresholdHours: 24 },
    ],
    customers: stories.map((s) => s.customer),
    products,
    events,
    existingFlows,
    cohorts,
    coverageStats,
    historicalCampaign,
  };

  return dataset;
}

/** Average identified POS ticket value (used by the seeder for context). */
export function localDatasetAvgTicket(dataset: LocalDemoDatasetInternal): number {
  const purchases = dataset.events.filter(
    (e) =>
      e.eventType === "purchase" &&
      e.value !== undefined &&
      !e.customerEmailLower.endsWith("@anon.pos.invalid")
  );
  if (purchases.length === 0) return 0;
  return money(purchases.reduce((sum, e) => sum + (e.value ?? 0), 0) / purchases.length);
}
