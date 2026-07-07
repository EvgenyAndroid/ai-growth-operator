/**
 * lib/demo/generator.ts — deterministic demo merchant generator (PRD 20, 25.1).
 *
 * Fixed seed + fixed reference date => byte-identical dataset on every run.
 * No Date.now()-dependent randomness anywhere.
 *
 * Engineered cohort targets (so the recipes module hits the PRD paths):
 * - Recipe 1 (abandoned checkout): ~885 customers with a checkout_started in
 *   the last 14 days and no purchase after it. An existing pre-Operator
 *   Klaviyo recovery flow covers ~30% of them (26B.11 net-of-existing), a few
 *   are unconsented/suppressed, leaving ~600 residual eligible — above the
 *   500 holdout floor (PRD 14.2).
 * - Recipe 2 (lapsed win-back): ~550 consented, unsuppressed customers with
 *   >=3 purchases and current gap > 1.5x personal median interval, none of
 *   them members of an ACTIVE recovery/win-back flow (PRD 10.3 exclusions).
 *   Plus refund-heavy lapsed outliers and gift-last-purchase edge cases to
 *   exercise the exclusion rules.
 * - Recipe 3 (Meta seed): a clear top-15% LTV cohort, consentAds mix with
 *   some false (26B.13), and recent purchasers for the suppression audience.
 * - One completed historical win-back action (launched 45 days before the
 *   reference date) with a measured 10% holdout, so the performance screen
 *   has holdout-verified history on day 0 (PRD 20.4).
 */

import type { ContractLifecycleStage, DemoDataset } from "../contracts";
import { buildCatalog, type DemoProduct } from "./catalog";
import { Rng, median, money } from "./prng";

// ---------------------------------------------------------------------------
// Fixed anchors — determinism
// ---------------------------------------------------------------------------

export const DEMO_SEED = 20260615;
/** Fixed reference "now" for all generated timestamps. */
export const DEMO_REFERENCE_DATE = "2026-06-15T12:00:00.000Z";
export const DEMO_ACCOUNT_NAME = "Brightleaf Botanicals (Demo)";

/** Existing pre-Operator Klaviyo flow names (26B.11 / 26A.5). */
export const EXISTING_RECOVERY_FLOW_NAME = "Abandoned Cart Rescue (pre-Operator)";
export const EXISTING_RECOVERY_FLOW_CAMPAIGN_ID = "klaviyo-flow:cart-rescue-pre-operator";
export const HISTORICAL_WINBACK_CAMPAIGN_ID = "operator-campaign:winback-2026-04";

// ---------------------------------------------------------------------------
// Cohort plan (~1215 customers)
// ---------------------------------------------------------------------------

export const COHORT_SIZES = {
  /** Recent abandoned checkout, eligible, NOT covered by existing flow, also lapsed. */
  residualLapsedAbandoners: 300,
  /** Recent abandoned checkout, eligible, light purchase history (1-2 orders, recent). */
  residualLightAbandoners: 150,
  /** Recent abandoned checkout, eligible, never purchased. */
  residualProspectAbandoners: 150,
  /** Recent abandoned checkout, covered by existing recovery flow, also lapsed. */
  flowLapsedAbandoners: 40,
  /** Recent abandoned checkout, covered by existing recovery flow, light history. */
  flowLightAbandoners: 130,
  /** Recent abandoned checkout, covered by existing recovery flow, prospect. */
  flowProspectAbandoners: 95,
  /** Recent abandoned checkout but consentEmail=false. */
  noConsentAbandoners: 12,
  /** Recent abandoned checkout but suppressed/unsubscribed. */
  suppressedAbandoners: 8,
  /** Lapsed (gap > 1.5x personal median), no recent checkout, eligible. */
  lapsedOnly: 250,
  /** Lapsed cadence but consentEmail=false or suppressed. */
  lapsedIneligible: 30,
  /** Healthy repeat buyers (high-LTV backbone; includes past win-back converters). */
  activeRepeat: 40,
  /** Lapsed cadence + refund-heavy (dissatisfaction exclusion, PRD 10.3). */
  refundHeavyLapsed: 10,
} as const;

export type DemoCohort = keyof typeof COHORT_SIZES;

// ---------------------------------------------------------------------------
// Internal (superset) types — assignable to the DemoDataset contract
// ---------------------------------------------------------------------------

/** Contract event + optional campaign attribution the seeder persists. */
export type DemoEventDraft = DemoDataset["events"][number] & {
  campaignId?: string;
};

export interface HistoricalWinback {
  /** Days before the reference date the action launched. */
  launchDaysAgo: number;
  audienceName: string;
  eligibleEmails: string[];
  treatedEmails: string[];
  heldOutEmails: string[];
  convertedTreatedEmails: string[];
  convertedHeldOutEmails: string[];
  treatedRate: number;
  heldOutRate: number;
  /** Absolute purchase-rate lift range, in fractions (e.g. 0.008 = 0.8pp). */
  liftLow: number;
  liftHigh: number;
  incrementalRevenueLow: number;
  incrementalRevenueHigh: number;
}

export interface DemoDatasetInternal extends DemoDataset {
  seed: number;
  referenceDate: string;
  events: DemoEventDraft[];
  /** Cohort tag -> member emails (for the seeder + smoke assertions). */
  cohorts: Record<DemoCohort, string[]>;
  historicalWinback: HistoricalWinback;
}

type DemoCustomer = DemoDataset["customers"][number];

interface CustomerStory {
  cohort: DemoCohort;
  customer: DemoCustomer;
  events: DemoEventDraft[];
}

// ---------------------------------------------------------------------------
// Name / email pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "ava", "liam", "mia", "noah", "zoe", "eli", "ruby", "finn", "isla", "jude",
  "nora", "owen", "lena", "theo", "iris", "cole", "maya", "reid", "elsa", "hugo",
  "june", "axel", "vera", "seth", "cora", "nash", "faye", "otis", "gwen", "kai",
  "tess", "remy", "lola", "abel", "nina", "dane", "opal", "rhys", "sadie", "milo",
  "wren", "levi", "cleo", "enzo", "dora", "amos", "lucy", "brek", "hattie", "omar",
  "pearl", "quinn", "rosa", "silas", "thea", "umar", "viola", "wade", "xena", "yara",
];
const LAST_NAMES = [
  "hartley", "brooks", "calder", "davies", "ellison", "fontaine", "garner", "holt",
  "ibarra", "jennings", "keller", "lambert", "mercer", "nolan", "oakes", "pruitt",
  "quimby", "rowe", "sandoval", "tate", "underhill", "vance", "whitaker", "xiong",
  "yates", "zimmer", "ashford", "barlow", "coates", "delaney", "eastman", "farrell",
  "gibbs", "hooper", "ives", "jaffe", "kimura", "lombardi", "mcallister", "nieves",
  "ogden", "paxton", "quill", "ramsey", "sterling", "thorne", "ulrich", "vega",
  "winslow", "xavier", "york", "zeller", "abbott", "bishop", "conway", "drummond",
  "ferris", "granger", "hollis", "ingram",
];
const EMAIL_DOMAINS = ["demo-mail.example.com", "inbox.example.net", "post.example.org"];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateDemoDataset(
  referenceDate: string = DEMO_REFERENCE_DATE
): DemoDatasetInternal {
  const rng = new Rng(DEMO_SEED);
  const refMs = new Date(referenceDate).getTime();
  const iso = (daysAgo: number): string => new Date(refMs - daysAgo * 86400000).toISOString();

  const products = buildCatalog(new Rng(DEMO_SEED ^ 0x5eed));
  const productById = new Map(products.map((p) => [p.sourceProductId, p]));
  const replenishablePool = products.filter((p) => p.repeatPurchaseFlag);
  const giftPool = products.filter((p) => p.category === "gift-sets");
  const anyPool = products;

  let emailCounter = 0;
  const nextIdentity = (): { emailLower: string; shopifyId: string } => {
    emailCounter += 1;
    const emailLower = `${rng.pick(FIRST_NAMES)}.${rng.pick(LAST_NAMES)}.${emailCounter}@${rng.pick(EMAIL_DOMAINS)}`;
    return { emailLower, shopifyId: `shp_${String(100000 + emailCounter)}` };
  };

  const pickProduct = (replenishBias: number): DemoProduct =>
    rng.chance(replenishBias) ? rng.pick(replenishablePool) : rng.pick(anyPool);

  const orderValue = (product: DemoProduct): number => {
    const qty = rng.chance(0.25) ? 2 : 1;
    return money(product.price * qty * rng.float(0.95, 1.15));
  };

  interface PurchaseSpec {
    daysAgo: number;
    product: DemoProduct;
    value: number;
  }

  /** Purchases at the given days-ago offsets (any order), newest-last output. */
  const purchasesAt = (daysAgoList: number[], replenishBias: number, lastProduct?: DemoProduct): PurchaseSpec[] => {
    const sorted = daysAgoList.slice().sort((a, b) => b - a); // oldest first
    return sorted.map((daysAgo, i) => {
      const product =
        lastProduct !== undefined && i === sorted.length - 1 ? lastProduct : pickProduct(replenishBias);
      return { daysAgo, product, value: orderValue(product) };
    });
  };

  /**
   * Lapsed timeline: n purchases whose ACTUAL median interval m satisfies
   * currentGap > 1.5 * m with margin, all within the 180-day event window.
   */
  const lapsedDaysAgo = (): number[] => {
    const n = rng.int(3, 5);
    const base = rng.int(14, 28);
    let intervals = Array.from({ length: n - 1 }, () =>
      Math.max(6, Math.round(base * rng.float(0.75, 1.3)))
    );
    let m = median(intervals);
    const gap = Math.round(m * rng.float(1.95, 2.75));
    let span = gap + intervals.reduce((a, b) => a + b, 0);
    if (span > 172) {
      const scale = (172 - gap) / (span - gap);
      intervals = intervals.map((iv) => Math.max(5, Math.floor(iv * scale)));
      m = median(intervals);
      span = gap + intervals.reduce((a, b) => a + b, 0);
    }
    // gap was sized from the pre-scale median; scaling only shrinks m, so
    // gap > 1.5 * m still holds.
    const out: number[] = [];
    let d = gap;
    out.push(d);
    for (const iv of intervals) {
      d += iv;
      out.push(d);
    }
    return out;
  };

  /** Active timeline: last purchase well within 1.5x median cadence, and one purchase forced into the historical win-back window (36-44 days ago). */
  const activeDaysAgo = (): number[] => {
    const n = rng.int(4, 7);
    const base = rng.int(14, 24);
    const intervals = Array.from({ length: n - 1 }, () =>
      Math.max(6, Math.round(base * rng.float(0.8, 1.25)))
    );
    const m = median(intervals);
    const gap = Math.max(2, Math.round(m * rng.float(0.2, 1.0)));
    const list: number[] = [];
    let d = gap;
    list.push(d);
    for (const iv of intervals) {
      d += iv;
      list.push(d);
    }
    // Force one purchase into [37, 43] days ago (win-back conversion window).
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < list.length; i += 1) {
      const dist = Math.abs((list[i] as number) - 40);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    list[closestIdx] = rng.int(37, 43);
    // De-dupe collisions deterministically.
    const seen = new Set<number>();
    for (let i = 0; i < list.length; i += 1) {
      let v = list[i] as number;
      while (seen.has(v)) v += 1;
      seen.add(v);
      list[i] = v;
    }
    return list;
  };

  /** Light history: 1-2 purchases, most recent 20-40 days ago (NOT lapsed-qualifying, some inside the Recipe 3 30-day suppression window). */
  const lightDaysAgo = (): number[] => {
    const last = rng.int(20, 40);
    if (rng.chance(0.45)) return [last];
    return [last, last + rng.int(25, 55)];
  };

  // -------------------------------------------------------------------------
  // Story assembly
  // -------------------------------------------------------------------------

  const stories: CustomerStory[] = [];

  interface BuildOpts {
    cohort: DemoCohort;
    kind: "lapsed" | "active" | "light" | "prospect";
    consentEmail: boolean;
    suppressed: boolean;
    recentCheckout: boolean;
    flowCovered: boolean;
    refundHeavy?: boolean;
    giftLastPurchase?: boolean;
    forceKlaviyo?: boolean;
    klaviyoChance?: number;
  }

  const build = (opts: BuildOpts): CustomerStory => {
    const { emailLower, shopifyId } = nextIdentity();
    const events: DemoEventDraft[] = [];

    // --- purchases ---
    let purchases: PurchaseSpec[] = [];
    if (opts.kind === "lapsed") {
      purchases = purchasesAt(
        lapsedDaysAgo(),
        0.85,
        opts.giftLastPurchase ? rng.pick(giftPool) : undefined
      );
    } else if (opts.kind === "active") {
      purchases = purchasesAt(activeDaysAgo(), 0.8);
    } else if (opts.kind === "light") {
      purchases = purchasesAt(lightDaysAgo(), 0.6);
    }

    for (const p of purchases) {
      events.push({
        customerEmailLower: emailLower,
        eventType: "purchase",
        eventTimestamp: iso(p.daysAgo),
        source: "demo",
        sourceProductId: p.product.sourceProductId,
        value: p.value,
      });
    }

    // --- refunds (refund-heavy outliers) ---
    let refundRate: number | undefined;
    if (opts.refundHeavy && purchases.length > 0) {
      const refundCount = Math.max(2, Math.ceil(purchases.length * rng.float(0.4, 0.7)));
      const refunded = rng.sample(purchases, refundCount);
      for (const p of refunded) {
        events.push({
          customerEmailLower: emailLower,
          eventType: "refund",
          eventTimestamp: iso(Math.max(0.5, p.daysAgo - rng.float(2, 8))),
          source: "demo",
          sourceProductId: p.product.sourceProductId,
          value: p.value,
        });
      }
      refundRate = money(refundCount / purchases.length);
    }

    // --- recent abandoned checkout (Recipe 1 signal) ---
    if (opts.recentCheckout) {
      const daysAgo = rng.float(0.3, 13.2); // >4h old, <14d old
      const product = pickProduct(0.7);
      events.push({
        customerEmailLower: emailLower,
        eventType: "checkout_started",
        eventTimestamp: iso(daysAgo),
        source: "demo",
        sourceProductId: product.sourceProductId,
        value: money(orderValue(product) * rng.float(1.0, 1.6)),
      });
      // Existing recovery flow engagement (26A.5 event-history proxy).
      if (opts.flowCovered && opts.consentEmail) {
        const openDaysAgo = Math.max(0.05, daysAgo - rng.float(0.05, 0.4));
        if (rng.chance(0.8)) {
          events.push({
            customerEmailLower: emailLower,
            eventType: "email_open",
            eventTimestamp: iso(openDaysAgo),
            source: "demo",
            campaignId: EXISTING_RECOVERY_FLOW_CAMPAIGN_ID,
          });
          if (rng.chance(0.25)) {
            events.push({
              customerEmailLower: emailLower,
              eventType: "email_click",
              eventTimestamp: iso(Math.max(0.02, openDaysAgo - 0.02)),
              source: "demo",
              campaignId: EXISTING_RECOVERY_FLOW_CAMPAIGN_ID,
            });
          }
        }
      }
    }

    // --- historical abandoned checkout noise (stale, outside 14d window) ---
    if (purchases.length > 0 && rng.chance(0.2)) {
      const product = pickProduct(0.6);
      events.push({
        customerEmailLower: emailLower,
        eventType: "checkout_started",
        eventTimestamp: iso(rng.int(20, 170)),
        source: "demo",
        sourceProductId: product.sourceProductId,
        value: orderValue(product),
      });
    }

    // --- suppression / unsubscribe ---
    if (opts.suppressed) {
      events.push({
        customerEmailLower: emailLower,
        eventType: "unsubscribe",
        eventTimestamp: iso(rng.int(25, 150)),
        source: "demo",
      });
    }

    // --- aggregates ---
    const sortedPurchases = purchases.slice().sort((a, b) => b.daysAgo - a.daysAgo);
    const totalOrders = purchases.length;
    const totalRevenue = money(purchases.reduce((sum, p) => sum + p.value, 0));
    const intervals: number[] = [];
    for (let i = 1; i < sortedPurchases.length; i += 1) {
      intervals.push(
        (sortedPurchases[i - 1] as PurchaseSpec).daysAgo - (sortedPurchases[i] as PurchaseSpec).daysAgo
      );
    }

    let lifecycleStage: ContractLifecycleStage;
    if (totalOrders === 0) lifecycleStage = "prospect";
    else if (opts.kind === "lapsed") lifecycleStage = "lapsed";
    else if (opts.kind === "active") lifecycleStage = "won_back";
    else if (totalOrders === 1) lifecycleStage = "first_purchase";
    else lifecycleStage = "repeat";

    const hasKlaviyo = opts.forceKlaviyo === true || rng.chance(opts.klaviyoChance ?? 0.9);

    const customer: DemoCustomer = {
      emailLower,
      consentEmail: opts.consentEmail,
      consentAds: rng.chance(0.72), // 26B.13 mix incl. false
      lifecycleStage,
      ...(sortedPurchases.length > 0
        ? {
            // sortedPurchases is oldest-first (descending daysAgo)
            firstPurchaseDate: iso((sortedPurchases[0] as PurchaseSpec).daysAgo),
            lastPurchaseDate: iso((sortedPurchases[sortedPurchases.length - 1] as PurchaseSpec).daysAgo),
          }
        : {}),
      totalOrders,
      totalRevenue,
      ...(refundRate !== undefined ? { refundRate } : {}),
      suppressionStatus: opts.suppressed ? "suppressed" : "none",
      ...(intervals.length > 0 ? { purchaseIntervalDays: intervals } : {}),
      shopifyId,
      ...(hasKlaviyo ? { klaviyoId: `klv_${String(500000 + emailCounter)}` } : {}),
    };

    const story: CustomerStory = { cohort: opts.cohort, customer, events };
    stories.push(story);
    return story;
  };

  const buildMany = (count: number, opts: Omit<BuildOpts, "cohort"> & { cohort: DemoCohort }): void => {
    for (let i = 0; i < count; i += 1) build(opts);
  };

  // Residual recovery-eligible abandoners (~600)
  buildMany(COHORT_SIZES.residualLapsedAbandoners, {
    cohort: "residualLapsedAbandoners",
    kind: "lapsed", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: false, forceKlaviyo: true,
  });
  buildMany(COHORT_SIZES.residualLightAbandoners, {
    cohort: "residualLightAbandoners",
    kind: "light", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: false, klaviyoChance: 0.9,
  });
  buildMany(COHORT_SIZES.residualProspectAbandoners, {
    cohort: "residualProspectAbandoners",
    kind: "prospect", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: false, klaviyoChance: 0.75,
  });

  // Abandoners already covered by the existing recovery flow (~30% of abandoners)
  buildMany(COHORT_SIZES.flowLapsedAbandoners, {
    cohort: "flowLapsedAbandoners",
    kind: "lapsed", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: true, forceKlaviyo: true,
  });
  buildMany(COHORT_SIZES.flowLightAbandoners, {
    cohort: "flowLightAbandoners",
    kind: "light", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: true, forceKlaviyo: true,
  });
  buildMany(COHORT_SIZES.flowProspectAbandoners, {
    cohort: "flowProspectAbandoners",
    kind: "prospect", consentEmail: true, suppressed: false,
    recentCheckout: true, flowCovered: true, forceKlaviyo: true,
  });

  // Ineligible abandoners
  buildMany(COHORT_SIZES.noConsentAbandoners, {
    cohort: "noConsentAbandoners",
    kind: "light", consentEmail: false, suppressed: false,
    recentCheckout: true, flowCovered: false, klaviyoChance: 0.5,
  });
  buildMany(COHORT_SIZES.suppressedAbandoners, {
    cohort: "suppressedAbandoners",
    kind: "light", consentEmail: false, suppressed: true,
    recentCheckout: true, flowCovered: false, klaviyoChance: 0.8,
  });

  // Lapsed-only win-back pool (~250; a few with one-time-gift last purchases)
  for (let i = 0; i < COHORT_SIZES.lapsedOnly; i += 1) {
    build({
      cohort: "lapsedOnly",
      kind: "lapsed", consentEmail: true, suppressed: false,
      recentCheckout: false, flowCovered: false, forceKlaviyo: true,
      giftLastPurchase: i < 12, // PRD 10.3 weak-repeat-category exclusion cases
    });
  }
  for (let i = 0; i < COHORT_SIZES.lapsedIneligible; i += 1) {
    const suppressed = i < 12;
    build({
      cohort: "lapsedIneligible",
      kind: "lapsed", consentEmail: false, suppressed,
      recentCheckout: false, flowCovered: false, klaviyoChance: 0.7,
    });
  }

  // Healthy actives (high-LTV backbone + historical win-back converters)
  buildMany(COHORT_SIZES.activeRepeat, {
    cohort: "activeRepeat",
    kind: "active", consentEmail: true, suppressed: false,
    recentCheckout: false, flowCovered: false, forceKlaviyo: true,
  });

  // Refund-heavy lapsed outliers
  buildMany(COHORT_SIZES.refundHeavyLapsed, {
    cohort: "refundHeavyLapsed",
    kind: "lapsed", consentEmail: true, suppressed: false,
    recentCheckout: false, flowCovered: false, refundHeavy: true, forceKlaviyo: true,
  });

  // Scattered single refunds for realism (kept below dissatisfaction levels)
  const withPurchases = stories.filter((s) => s.customer.totalOrders > 1 && s.customer.refundRate === undefined);
  for (const story of rng.sample(withPurchases, 25)) {
    const purchaseEvents = story.events.filter((e) => e.eventType === "purchase");
    const target = rng.pick(purchaseEvents);
    story.events.push({
      customerEmailLower: story.customer.emailLower,
      eventType: "refund",
      eventTimestamp: new Date(new Date(target.eventTimestamp).getTime() + rng.int(2, 6) * 86400000).toISOString(),
      source: "demo",
      ...(target.sourceProductId !== undefined ? { sourceProductId: target.sourceProductId } : {}),
      ...(target.value !== undefined ? { value: target.value } : {}),
    });
    story.customer.refundRate = money(1 / story.customer.totalOrders);
  }

  // -------------------------------------------------------------------------
  // Historical win-back action (launched 45 days ago, measured holdout)
  // -------------------------------------------------------------------------

  const cohorts = {} as Record<DemoCohort, string[]>;
  for (const key of Object.keys(COHORT_SIZES) as DemoCohort[]) cohorts[key] = [];
  for (const s of stories) cohorts[s.cohort].push(s.customer.emailLower);

  const storyByEmail = new Map(stories.map((s) => [s.customer.emailLower, s]));

  const lapsedPool = [...cohorts.residualLapsedAbandoners, ...cohorts.lapsedOnly];
  const lapsedMembers = rng.sample(lapsedPool, 500);
  const activeMembers = rng.shuffle(cohorts.activeRepeat); // all 40, all with a purchase 37-43d ago

  const shuffledLapsed = rng.shuffle(lapsedMembers);
  const heldOutLapsed = shuffledLapsed.slice(0, 52);
  const treatedLapsed = shuffledLapsed.slice(52); // 448, none converted (still lapsed today)
  const heldOutActive = activeMembers.slice(0, 2); // organic converters in the holdout arm
  const treatedActive = activeMembers.slice(2); // 38 treated converters

  const treatedEmails = [...treatedLapsed, ...treatedActive]; // 486
  const heldOutEmails = [...heldOutLapsed, ...heldOutActive]; // 54
  const eligibleEmails = [...treatedEmails, ...heldOutEmails]; // 540

  // Win-back campaign engagement events for the treated arm (send at T-45).
  for (const email of treatedEmails) {
    const story = storyByEmail.get(email);
    if (story === undefined) continue;
    if (rng.chance(0.7)) {
      const openDaysAgo = rng.float(38, 44.6);
      story.events.push({
        customerEmailLower: email,
        eventType: "email_open",
        eventTimestamp: iso(openDaysAgo),
        source: "demo",
        campaignId: HISTORICAL_WINBACK_CAMPAIGN_ID,
      });
      if (rng.chance(0.22)) {
        story.events.push({
          customerEmailLower: email,
          eventType: "email_click",
          eventTimestamp: iso(Math.max(36.5, openDaysAgo - 0.1)),
          source: "demo",
          campaignId: HISTORICAL_WINBACK_CAMPAIGN_ID,
        });
      }
    }
  }

  const round4 = (n: number): number => Math.round(n * 10000) / 10000;
  const treatedRate = round4(treatedActive.length / treatedEmails.length); // ~0.0782
  const heldOutRate = round4(heldOutActive.length / heldOutEmails.length); // ~0.037

  const conversionRevenue = treatedActive
    .map((email) => {
      const story = storyByEmail.get(email);
      if (story === undefined) return 0;
      const inWindow = story.events.filter((e) => {
        if (e.eventType !== "purchase") return false;
        const daysAgo = (refMs - new Date(e.eventTimestamp).getTime()) / 86400000;
        return daysAgo >= 36 && daysAgo <= 44;
      });
      return inWindow.reduce((sum, e) => sum + (e.value ?? 0), 0);
    })
    .reduce((a, b) => a + b, 0);

  const historicalWinback: HistoricalWinback = {
    launchDaysAgo: 45,
    audienceName: "Lapsed customers — April 2026 cohort",
    eligibleEmails,
    treatedEmails,
    heldOutEmails,
    convertedTreatedEmails: [...treatedActive],
    convertedHeldOutEmails: [...heldOutActive],
    treatedRate,
    heldOutRate,
    liftLow: 0.008, // conservative bound, absolute purchase-rate fraction
    liftHigh: 0.074,
    incrementalRevenueLow: money(conversionRevenue * 0.35),
    incrementalRevenueHigh: money(conversionRevenue * 0.95),
  };

  // -------------------------------------------------------------------------
  // Existing flows (26B.11) + assembly
  // -------------------------------------------------------------------------

  const flowCoveredEmails = [
    ...cohorts.flowLapsedAbandoners,
    ...cohorts.flowLightAbandoners,
    ...cohorts.flowProspectAbandoners,
  ];
  const consentedEmails = stories
    .filter((s) => s.customer.consentEmail)
    .map((s) => s.customer.emailLower);

  const existingFlows: DemoDataset["existingFlows"] = [
    {
      type: "recovery",
      name: EXISTING_RECOVERY_FLOW_NAME,
      active: true,
      memberCustomerEmails: flowCoveredEmails,
    },
    {
      // Inactive — must NOT net against Recipe 2 estimates (26B.11: "active equivalent flow").
      type: "winback",
      name: "We Miss You (paused 2025)",
      active: false,
      memberCustomerEmails: rng.sample([...cohorts.lapsedOnly, ...cohorts.lapsedIneligible], 80),
    },
    {
      type: "other",
      name: "Weekly Newsletter",
      active: true,
      memberCustomerEmails: rng.sample(consentedEmails, 420),
    },
  ];

  const events = stories
    .flatMap((s) => s.events)
    .sort((a, b) => a.eventTimestamp.localeCompare(b.eventTimestamp));

  const dataset: DemoDatasetInternal = {
    seed: DEMO_SEED,
    referenceDate,
    account: { name: DEMO_ACCOUNT_NAME, vertical: "shopify_dtc" },
    constitution: {
      // PRD 12.3 required setup numbers + 12.4 defaults (Shopify DTC template,
      // beauty/wellness banned-claims variant).
      monthlyBudgetCap: 4000,
      maxDiscountPercent: 15,
      // Must exceed the recovery audience (~870) so demo mode can exercise the
      // full approve -> activate loop (PRD 26 DoD #23); merchants edit this
      // number during onboarding (PRD 12.3).
      dailySendCap: 1000,
      bannedClaims: [
        "clinically proven",
        "cures",
        "treats",
        "prevents",
        "guaranteed",
        "FDA-approved",
        "medical-grade",
        "dermatologist-approved",
        "safe for all skin types",
        "best",
        "#1",
        "fastest",
        "permanent",
        "no side effects",
        "scientifically proven",
        "doctor recommended",
      ],
      toneGuide:
        "Warm, plainspoken, botanical. Speak like a knowledgeable friend, not a lab. " +
        "No urgency theatrics, no medical language, no superlatives. " +
        "Lead with the ritual and the ingredient story; mention offers last.",
    },
    integrations: [
      { source: "shopify", mode: "mock", lastSyncAt: iso(1 / 24), freshnessThresholdHours: 24 },
      { source: "klaviyo", mode: "mock", lastSyncAt: iso(2 / 24), freshnessThresholdHours: 24 },
      { source: "meta", mode: "mock", lastSyncAt: iso(5 / 24), freshnessThresholdHours: 24 },
      { source: "ga4", mode: "mock", lastSyncAt: iso(12 / 24), freshnessThresholdHours: 48 },
    ],
    customers: stories.map((s) => s.customer),
    products,
    events,
    existingFlows,
    cohorts,
    historicalWinback,
  };

  return dataset;
}

/** Average order value across all purchase events (used by the seeder for context). */
export function datasetAov(dataset: DemoDataset): number {
  const purchases = dataset.events.filter((e) => e.eventType === "purchase" && e.value !== undefined);
  if (purchases.length === 0) return 0;
  return money(purchases.reduce((sum, e) => sum + (e.value ?? 0), 0) / purchases.length);
}

// Re-export for convenience in assertions/tests.
export { median };
export type { DemoProduct };
