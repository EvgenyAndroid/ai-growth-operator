/**
 * lib/demo/local/seed.ts — writes the deterministic LOCAL demo dataset to the
 * database as a SECOND demo account alongside the DTC one.
 *
 * One local Account ("Cardamom & Rye") + "Local & multi-location service"
 * Constitution v1 (10% discount ceiling, quiet hours, holiday blackout dates,
 * food/health banned claims), mock square/mailchimp/gbp/meta Integration rows
 * with fresh syncs, 640 identified customers, 40 products, ~7000 POS purchase
 * events over 180 days (identified share ~65% — persisted to the Preference
 * key "pos_identified_coverage" for the LOCAL recipes' coverage disclosure,
 * trust rule #9), and one completed historical email action measured
 * BEFORE/AFTER with no holdout (audience was 210 < 500) so performance history
 * shows the before-after-no-control label on day 0.
 *
 * Idempotent: re-running deletes and recreates the local demo account.
 * POS purchases/refunds persist with Event.source = "square"; email events
 * persist as "demo" ("mailchimp" is not a legal Event.source in this phase).
 */

import { createHash } from "node:crypto";
import db from "../../db";
import {
  DEFAULT_MEASUREMENT_WINDOWS,
  LOCAL_RECIPE_IDS,
  MEASUREMENT_LABELS,
  MEASUREMENT_LABEL_COPY,
  RECIPE_CONFIG_DEFAULTS,
  type ExplanationContract,
  type Prisma,
} from "../../contracts";
import { median, money } from "../prng";
import {
  LOCAL_DEMO_ACCOUNT_NAME,
  LOCAL_ELIGIBLE_LAPSED_COUNT,
  POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY,
  localDatasetAvgTicket,
  type LocalDemoDatasetInternal,
} from "./generator";
import { loadLocalDemoDataset } from "./index";

export interface LocalSeedSummary {
  accountId: string;
  accountName: string;
  referenceDate: string;
  customers: number;
  products: number;
  events: number;
  integrations: number;
  audiences: number;
  ledgerEntries: number;
  recipeConfigs: number;
  historicalActionId: string;
  avgTicket: number;
  identifiedShare: number;
  eligibleLapsed: number;
  cateringSignalOrders: number;
  cohortCounts: Record<string, number>;
}

const HISTORICAL_DEDUP_SUFFIX = "lapsed-regulars-2026-05"; // keeps 26B.16 active-card key free

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function seedLocalDemoDatabase(
  dataset: LocalDemoDatasetInternal = loadLocalDemoDataset()
): Promise<LocalSeedSummary> {
  const refMs = new Date(dataset.referenceDate).getTime();
  const at = (daysAgo: number): Date => new Date(refMs - daysAgo * 86400000);
  const avgTicket = localDatasetAvgTicket(dataset);
  const coverage = dataset.coverageStats;

  // --- idempotency: wipe any previous local demo account (cascades) --------
  await db.account.deleteMany({ where: { name: LOCAL_DEMO_ACCOUNT_NAME } });

  // --- account + "Local & multi-location service" Constitution v1 ----------
  const account = await db.account.create({
    data: {
      name: dataset.account.name,
      vertical: dataset.account.vertical, // "local_service" routes everything
      demoMode: true, // PRD 20.3: demo must be clearly labeled
    },
  });

  await db.constitution.create({
    data: {
      accountId: account.id,
      templateVertical: "local_service",
      version: 1,
      monthlyBudgetCap: dataset.constitution.monthlyBudgetCap,
      maxDiscountPercent: dataset.constitution.maxDiscountPercent, // 10 — lower local ceiling
      marginFloorPercent: dataset.constitution.marginFloorPercent,
      dailySendCap: dataset.constitution.dailySendCap,
      frequencyCaps: dataset.constitution
        .frequencyCaps as unknown as Prisma.InputJsonValue, // includes quiet-hours note
      blackoutDates: dataset.constitution
        .blackoutDates as unknown as Prisma.InputJsonValue, // holiday blackouts
      toneGuide: dataset.constitution.toneGuide,
      bannedClaims: dataset.constitution
        .bannedClaims as unknown as Prisma.InputJsonValue, // food/health claims incl. "boosts immunity", "superfood", "healthiest", "cures"
      suppressionDefaults: {
        excludeUnsubscribed: true,
        excludeSuppressed: true,
        excludeNoEmailConsent: true,
        excludeNoAdsConsentForAudienceSync: true,
        excludeUnidentifiedWalkIns: true, // LOCAL: only loyalty-matched customers are reachable
      },
      approvalRequirements: {
        customerFacingSend: true,
        audienceSync: true,
        suppressionChange: true,
        budgetChange: true,
        publicFacingAction: true, // GBP posts are public-facing
      },
      effectiveFrom: at(60),
    },
  });

  // --- integrations (mock connectors) + sync runs ---------------------------
  const purchaseEvents = dataset.events.filter((e) => e.eventType === "purchase").length;
  const recordsBySource: Record<string, number> = {
    square:
      dataset.customers.length + dataset.products.length + purchaseEvents,
    mailchimp: dataset.customers.filter((c) => c.klaviyoId !== undefined).length,
    gbp: 178, // profile views + reviews + Q&A rows (context only)
    meta: 1, // audience container visible on the mock ad account
  };

  for (const integ of dataset.integrations) {
    const row = await db.integration.create({
      data: {
        accountId: account.id,
        source: integ.source,
        mode: "mock",
        oauthStatus: "mock",
        scopes: ["read"],
        lastSyncAt: new Date(integ.lastSyncAt),
        freshnessThresholdHours: integ.freshnessThresholdHours,
      },
    });
    const completed = new Date(integ.lastSyncAt);
    await db.syncRun.create({
      data: {
        accountId: account.id,
        integrationId: row.id,
        source: integ.source,
        startedAt: new Date(completed.getTime() - 9 * 60000),
        completedAt: completed,
        status: "succeeded",
        recordsRead: recordsBySource[integ.source] ?? 0,
      },
    });
  }

  // --- recipe configs (LOCAL pack recipes; defaults, 26A.6 editable) -------
  for (const recipeId of LOCAL_RECIPE_IDS) {
    await db.recipeConfig.create({
      data: {
        accountId: account.id,
        recipeId,
        params: RECIPE_CONFIG_DEFAULTS[recipeId] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // --- products -------------------------------------------------------------
  await db.product.createMany({
    data: dataset.products.map((p) => ({
      accountId: account.id,
      sourceProductId: p.sourceProductId,
      name: p.name,
      category: p.category,
      price: p.price,
      repeatPurchaseFlag: p.repeatPurchaseFlag,
      replenishmentWindowDays: p.replenishmentWindowDays ?? null,
      seasonalFlag: p.seasonalFlag,
      repeatability: p.repeatability,
    })),
  });
  const productRows = await db.product.findMany({
    where: { accountId: account.id },
    select: { id: true, sourceProductId: true },
  });
  const productIdBySource = new Map(productRows.map((r) => [r.sourceProductId, r.id]));

  // --- customers (identified loyalty members only) ---------------------------
  // Contract field mapping: customer.shopifyId carries the SQUARE loyalty id,
  // customer.klaviyoId carries the MAILCHIMP subscriber id (see generator note).
  const customerData: Prisma.CustomerCreateManyInput[] = dataset.customers.map((c) => {
    const intervals = c.purchaseIntervalDays;
    const stats =
      intervals !== undefined && intervals.length > 0
        ? {
            medianDays: median(intervals),
            meanDays: money(intervals.reduce((a, b) => a + b, 0) / intervals.length),
            intervals,
          }
        : null;
    return {
      accountId: account.id,
      sourceCustomerIds: {
        square: c.shopifyId,
        ...(c.klaviyoId !== undefined ? { mailchimp: c.klaviyoId } : {}),
      },
      emailHash: sha256(c.emailLower),
      emailLower: c.emailLower, // 26B.12 v0 identity join key
      consentEmail: c.consentEmail,
      consentProvenance: c.consentEmail
        ? "square loyalty signup -> mailchimp double opt-in (demo import)"
        : "loyalty member without email opt-in (demo import)",
      consentAds: c.consentAds,
      consentAdsProvenance: `square customer directory ads_opt_out=${c.consentAds ? "false" : "true"} (demo import)`,
      lifecycleStage: c.lifecycleStage,
      firstPurchaseDate: c.firstPurchaseDate !== undefined ? new Date(c.firstPurchaseDate) : null,
      lastPurchaseDate: c.lastPurchaseDate !== undefined ? new Date(c.lastPurchaseDate) : null,
      totalOrders: c.totalOrders,
      totalRevenue: c.totalRevenue,
      purchaseIntervalStats: stats === null ? undefined : (stats as unknown as Prisma.InputJsonValue),
      refundRate: c.refundRate ?? null,
      suppressionStatus: c.suppressionStatus,
      sourceReferences: { origin: "local-demo-dataset", seed: dataset.seed },
    };
  });
  for (const batch of chunk(customerData, 150)) {
    await db.customer.createMany({ data: batch });
  }
  const customerRows = await db.customer.findMany({
    where: { accountId: account.id },
    select: { id: true, emailLower: true },
  });
  const customerIdByEmail = new Map(customerRows.map((r) => [r.emailLower ?? "", r.id]));

  // --- events ----------------------------------------------------------------
  // Anonymous walk-in purchases use synthetic @anon.pos.invalid addresses with
  // NO customer row => customerId stays null (the unidentified POS mass).
  const eventData: Prisma.EventCreateManyInput[] = dataset.events.map((e) => ({
    accountId: account.id,
    customerId: customerIdByEmail.get(e.customerEmailLower) ?? null,
    productId:
      e.sourceProductId !== undefined ? (productIdBySource.get(e.sourceProductId) ?? null) : null,
    eventType: e.eventType,
    eventTimestamp: new Date(e.eventTimestamp),
    source: e.posSource ?? e.source, // POS orders persist as "square"
    campaignId: e.campaignId ?? null,
    value: e.value ?? null,
  }));
  for (const batch of chunk(eventData, 400)) {
    await db.event.createMany({ data: batch });
  }

  // --- existing email programs (26B.11) as manual Audience rows -------------
  let audienceCount = 0;
  for (const flow of dataset.existingFlows) {
    await db.audience.create({
      data: {
        accountId: account.id,
        name: `Existing Mailchimp program: ${flow.name}`,
        creationMethod: "manual",
        inclusionRules: {
          type: "existing_mailchimp_program",
          flowType: flow.type,
          active: flow.active,
          memberEmails: flow.memberCustomerEmails,
        },
        exclusionRules: {},
        size: flow.memberCustomerEmails.length,
        eligibleChannels: ["mailchimp_email"],
        destinationStatus: "accepted",
      },
    });
    audienceCount += 1;
  }

  // Soft contract with the recipe loader: pre-existing email program
  // membership is read from Preference key "existing_flows" (26A.5).
  await db.preference.upsert({
    where: { accountId_key: { accountId: account.id, key: "existing_flows" } },
    update: {
      value: dataset.existingFlows as unknown as Prisma.InputJsonValue,
      source: "explicit",
    },
    create: {
      accountId: account.id,
      key: "existing_flows",
      value: dataset.existingFlows as unknown as Prisma.InputJsonValue,
      source: "explicit",
    },
  });

  // POS coverage disclosure source of truth (trust rule #9): the LOCAL recipes
  // read the identified-transaction share from this Preference row and attach
  // buildIdentifiedCoverage(identifiedShare) to every result.
  await db.preference.upsert({
    where: {
      accountId_key: {
        accountId: account.id,
        key: POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY,
      },
    },
    update: {
      value: coverage as unknown as Prisma.InputJsonValue,
      source: "explicit",
    },
    create: {
      accountId: account.id,
      key: POS_IDENTIFIED_COVERAGE_PREFERENCE_KEY,
      value: coverage as unknown as Prisma.InputJsonValue,
      source: "explicit",
    },
  });

  // -------------------------------------------------------------------------
  // Historical completed email action, measured BEFORE/AFTER — NO holdout
  // (audience 210 < 500 minimum, PRD 14.2/14.6) => before-after-no-control.
  // -------------------------------------------------------------------------

  const hc = dataset.historicalCampaign;
  const launched = at(hc.launchDaysAgo);
  const windows = DEFAULT_MEASUREMENT_WINDOWS.local_lapsed_regular;

  const audienceCustomerIds = hc.audienceEmails
    .map((email) => customerIdByEmail.get(email))
    .filter((id): id is string => id !== undefined);

  const campaignAudience = await db.audience.create({
    data: {
      accountId: account.id,
      name: hc.audienceName,
      creationMethod: "recipe",
      inclusionRules: {
        recipeId: "local_lapsed_regular",
        rule: "gap > 1.5x personal median visit cadence (identified loyalty customers only)",
        minVisits: 3,
        consentEmail: true,
        identifiedOnly: true,
        identifiedShare: coverage.identifiedShare,
        customerIds: audienceCustomerIds,
      },
      exclusionRules: {
        suppressed: true,
        unsubscribed: true,
        unidentifiedWalkIns: true,
        recentVisitors14d: true,
      },
      size: hc.audienceEmails.length,
      eligibleChannels: ["mailchimp_email"],
      lastSyncedAt: launched,
      destinationStatus: "accepted",
    },
  });
  audienceCount += 1;

  const estimateLow = money(hc.audienceEmails.length * 0.04 * avgTicket);
  const estimateHigh = money(hc.audienceEmails.length * 0.1 * avgTicket);
  const coveragePct = Math.round(coverage.identifiedShare * 100);

  const explanation: ExplanationContract = {
    found: `${hc.audienceEmails.length} identified regulars were past 1.5x their personal median visit cadence with email consent and no coverage by an existing win-back automation.`,
    whyItMatters:
      "A regular who misses two personal cycles is drifting to another café; a timely nudge is cheap and the habit is recoverable.",
    dataUsed: [
      "square: POS purchases (identified/loyalty-matched), visit intervals",
      "mailchimp: consent, suppression, program membership",
    ],
    dataFreshness: [
      {
        source: "demo",
        lastSyncAt: at(hc.launchDaysAgo + 0.1).toISOString(),
        thresholdHours: 24,
        isStale: false,
      },
    ],
    assumptions: [
      "Modeled return rate 4-10% (conservative editable default, no merchant baseline at launch — 26A.6).",
      `Average identified POS ticket $${avgTicket.toFixed(2)} from 180-day history.`,
      coverage.coverage.note, // POS coverage disclosure (trust rule #9)
    ],
    risk: "Offer limited to a free pastry with any drink — no discount code, under the 10% Operating Rules ceiling; sends respect quiet hours and holiday blackouts.",
    approvalNeeded: "Approved by the owner before send; draft alone did not activate (26A.4).",
    measurementPlan: {
      mode: "before_after_no_control",
      label: MEASUREMENT_LABELS.before_after_no_control,
      summary:
        `Eligible audience of ${hc.audienceEmails.length} is below the 500 minimum for a holdout ` +
        "(PRD 14.2), so results are measured before/after with NO control group; primary read at 21 days.",
      windows: windows.map((w) => ({ readType: w.readType, days: w.days })),
      caveats: [
        "No control group — the before/after change cannot be attributed to the campaign alone (weather, season, and foot traffic move these numbers too).",
        coverage.coverage.note, // every local readout states the identified share
      ],
    },
  };

  const opportunity = await db.opportunity.create({
    data: {
      accountId: account.id,
      // Historical (measured) card: suffixed key so the live
      // `${accountId}:local_lapsed_regular` dedup key (26B.16) stays free.
      dedupKey: `${account.id}:local_lapsed_regular:${HISTORICAL_DEDUP_SUFFIX}`,
      recipeId: "local_lapsed_regular",
      recipeVersion: "1.0.0",
      title: "Bring back lapsed regulars — May 2026 cohort",
      category: "winback",
      estimatedValueLow: estimateLow,
      estimatedValueHigh: estimateHigh,
      estimateLabel: "modeled",
      confidence: "medium",
      dataAsOf: at(hc.launchDaysAgo + 2),
      estimateVerifiedAt: at(hc.launchDaysAgo + 1),
      recommendedAction: null,
      explanation: explanation as unknown as Prisma.InputJsonValue,
      status: "measured",
      outcome: {
        measurementMode: "before_after_no_control",
        label: MEASUREMENT_LABEL_COPY.before_after_no_control,
        audienceSize: hc.audienceEmails.length,
        whyNoControl: `Audience of ${hc.audienceEmails.length} is below the 500 holdout minimum (PRD 14.2/14.6).`,
        returnedBefore: hc.returnedBeforeEmails.length,
        returnedAfter: hc.returnedAfterEmails.length,
        returnRateBefore: hc.returnRateBefore,
        returnRateAfter: hc.returnRateAfter,
        revenueBeforeWindow: hc.revenueBeforeWindow,
        revenueAfterWindow: hc.revenueAfterWindow,
        estimatedIncrementalRevenueRange: {
          low: hc.estimatedIncrementalRevenueLow,
          high: hc.estimatedIncrementalRevenueHigh,
        },
        coverage: {
          identifiedShare: coverage.identifiedShare,
          note: coverage.coverage.note,
        },
      },
      createdAt: at(hc.launchDaysAgo + 2),
    },
  });

  const action = await db.action.create({
    data: {
      accountId: account.id,
      // DEVIATION (documented): ContractActionType has no Mailchimp variant yet
      // (the local-recipes phase adds it together with governance). This string
      // anticipates that extension; the column is a plain String in SQLite.
      type: "mailchimp_winback_email",
      objective: "Bring back lapsed regulars past their personal visit cadence",
      channel: "mailchimp",
      audienceId: campaignAudience.id,
      opportunityId: opportunity.id,
      status: "launched",
      createdBy: "operator",
      approvedBy: "owner@cardamom-rye-demo.example",
      launchedAt: launched,
      constitutionVersion: 1,
      holdoutId: null, // NO holdout — audience 210 < 500
      measurementMode: "before_after_no_control",
      expectedOutcome: {
        estimateRange: { low: estimateLow, high: estimateHigh, label: "modeled" },
        assumedReturnRate: { low: 0.04, high: 0.1 },
      },
      measuredOutcome: {
        window: { readType: "primary", days: 21 },
        audienceSize: hc.audienceEmails.length,
        whyNoControl: `Eligible audience of ${hc.audienceEmails.length} is below the 500 minimum for a holdout (PRD 14.2/14.6).`,
        returnedBefore: hc.returnedBeforeEmails.length,
        returnedAfter: hc.returnedAfterEmails.length,
        returnRateBefore: hc.returnRateBefore,
        returnRateAfter: hc.returnRateAfter,
        revenueBeforeWindow: hc.revenueBeforeWindow,
        revenueAfterWindow: hc.revenueAfterWindow,
        estimatedIncrementalRevenueRange: {
          low: hc.estimatedIncrementalRevenueLow,
          high: hc.estimatedIncrementalRevenueHigh,
        },
        coverage: {
          identifiedShare: coverage.identifiedShare,
          note: coverage.coverage.note,
        },
        caveats: [
          "Before/after, no control group — the change cannot be attributed to the campaign alone.",
          "Identified (loyalty-matched) customers only; unidentified walk-in sales are excluded from both windows.",
          "Never presented as lift: no holdout arm exists for this send.",
        ],
      },
      liftLow: null, // lift is a holdout-only concept — never for before/after
      liftHigh: null,
      confidenceLevel: "low",
      activationLevel: "exportable_brief", // owner sent it from Mailchimp; no in-path enforcement
      sourceReferences: { campaignId: hc.campaignId },
      createdAt: at(hc.launchDaysAgo + 2),
    },
  });

  const draft = await db.draft.create({
    data: {
      accountId: account.id,
      opportunityId: opportunity.id,
      actionId: action.id,
      copy: [
        {
          step: 1,
          subject: "The rye came out of the oven without you",
          preview: "Your usual is still your usual.",
          body:
            "Hi {{first_name}}, the Saturday bake list has not changed — but the counter " +
            "misses you. This week: dark rye on Friday, cardamom knots all weekend.",
          offer: null,
        },
        {
          step: 2,
          subject: "A pastry on us, next time you're in",
          preview: "Any drink + a free pastry, this week only.",
          body:
            "Come say hi this week and take a pastry with any drink, on the house. Show " +
            "this email at the counter. Valid 7 days, one per person.",
          offer: { type: "free_item", value: "pastry with any drink", code: null },
        },
      ],
      sequence: { steps: 2, spacingDays: [0, 4], exitOnPurchase: true },
      activationTarget: "exportable_brief",
      currentVersion: 1,
      edits: [],
      status: "activated",
      createdAt: at(hc.launchDaysAgo + 1.5),
    },
  });

  await db.approval.create({
    data: {
      accountId: account.id,
      actionId: action.id,
      draftId: draft.id,
      approver: "owner@cardamom-rye-demo.example",
      status: "approved",
      timestamp: at(hc.launchDaysAgo + 1),
    },
  });

  for (const w of windows) {
    await db.measurementWindow.create({
      data: {
        accountId: account.id,
        actionId: action.id,
        start: launched,
        end: at(hc.launchDaysAgo - w.days),
        mode: "before_after_no_control",
        readType: w.readType,
        assumptions: {
          attribution:
            "identified (loyalty-matched) in-store purchase by audience member within window vs the same-length window before the send",
          joinKey: "lowercase email exact match (26B.12)",
          lookbackDays: 180,
          identifiedShare: coverage.identifiedShare,
        },
      },
    });
  }

  // --- context ledger history (PRD 18 / 20.2) -------------------------------
  let ledgerCount = 0;
  const ledger = async (data: Prisma.LedgerEntryUncheckedCreateInput): Promise<void> => {
    await db.ledgerEntry.create({ data });
    ledgerCount += 1;
  };

  for (const integ of dataset.integrations) {
    await ledger({
      accountId: account.id,
      timestamp: new Date(integ.lastSyncAt),
      eventType: "data_sync",
      skillInvoked: "connector_sync",
      sourceDataUsed: { source: integ.source, recordsRead: recordsBySource[integ.source] ?? 0 },
      sourceFreshness: [
        {
          source: integ.source,
          lastSyncAt: integ.lastSyncAt,
          thresholdHours: integ.freshnessThresholdHours,
          isStale: false,
        },
      ],
      reasoningSummary: `Mock ${integ.source} sync completed (demo mode, LOCAL pack).`,
    });
  }

  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo + 2),
    eventType: "opportunity_found",
    opportunityId: opportunity.id,
    skillInvoked: "recipe:local_lapsed_regular",
    constitutionVersion: 1,
    confidence: "medium",
    reasoningSummary:
      `${hc.audienceEmails.length} identified regulars past 1.5x personal median visit cadence; ` +
      `modeled estimate $${estimateLow}-$${estimateHigh}. Covers identified customers only ` +
      `(${coveragePct}% of POS transactions are identified).`,
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo + 1.5),
    eventType: "opportunity_drafted",
    opportunityId: opportunity.id,
    actionId: action.id,
    skillInvoked: "drafting:local_winback_email",
    constitutionVersion: 1,
    reasoningSummary:
      "2-email bring-back sequence drafted; free-pastry offer instead of a discount code (10% local ceiling); morning sends only (quiet hours).",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo + 1),
    eventType: "approval",
    userId: "owner@cardamom-rye-demo.example",
    opportunityId: opportunity.id,
    actionId: action.id,
    constitutionVersion: 1,
    approvalStatus: "approved",
    reasoningSummary: "Owner approved the send after copy review.",
  });
  await ledger({
    accountId: account.id,
    timestamp: launched,
    eventType: "activation_success",
    actionId: action.id,
    constitutionVersion: 1,
    destination: "mailchimp",
    activationLevel: "exportable_brief",
    actionTaken: `Bring-back email sent to ${hc.audienceEmails.length} lapsed regulars via Mailchimp (owner-executed from the exported brief). NO holdout assigned: audience below the 500 minimum — measurement is before/after with no control group.`,
    rollbackPath: "Nothing to roll back post-send; suppress the segment to stop follow-ups.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo - 7),
    eventType: "measurement_readback",
    actionId: action.id,
    measurementMode: "before_after_no_control",
    measuredOutcome: {
      window: "early(7d)",
      note: "early before/after read recorded; no control group — no causal claim",
    },
    reasoningSummary: "Early read at 7 days recorded; waiting for the primary window.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo - 21),
    eventType: "measurement_readback",
    actionId: action.id,
    measurementMode: "before_after_no_control",
    confidence: "low",
    measuredOutcome: {
      window: "primary(21d)",
      returnedBefore: hc.returnedBeforeEmails.length,
      returnedAfter: hc.returnedAfterEmails.length,
      returnRateBefore: hc.returnRateBefore,
      returnRateAfter: hc.returnRateAfter,
      identifiedShare: coverage.identifiedShare,
    },
    reasoningSummary:
      `Primary read: ${hc.returnedAfterEmails.length} of ${hc.audienceEmails.length} audience members ` +
      `visited in the 21 days after the send vs ${hc.returnedBeforeEmails.length} in the 21 days before. ` +
      "Before/after, no control group — not presented as lift.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hc.launchDaysAgo - 21),
    eventType: "performance_summary",
    actionId: action.id,
    measurementMode: "before_after_no_control",
    confidence: "low",
    reasoningSummary:
      `Before/after, no control group: return rate moved from ${(hc.returnRateBefore * 100).toFixed(1)}% to ` +
      `${(hc.returnRateAfter * 100).toFixed(1)}%; estimated $${hc.estimatedIncrementalRevenueLow}-$${hc.estimatedIncrementalRevenueHigh} ` +
      `in identified in-store revenue (range, never a point; no causal claim). Covers identified customers only — ` +
      `${coveragePct}% of POS transactions are identified.`,
  });

  const cohortCounts = Object.fromEntries(
    Object.entries(dataset.cohorts).map(([k, v]) => [k, v.length])
  );

  return {
    accountId: account.id,
    accountName: account.name,
    referenceDate: dataset.referenceDate,
    customers: dataset.customers.length,
    products: dataset.products.length,
    events: dataset.events.length,
    integrations: dataset.integrations.length,
    audiences: audienceCount,
    ledgerEntries: ledgerCount,
    recipeConfigs: LOCAL_RECIPE_IDS.length,
    historicalActionId: action.id,
    avgTicket,
    identifiedShare: coverage.identifiedShare,
    eligibleLapsed: LOCAL_ELIGIBLE_LAPSED_COUNT,
    cateringSignalOrders: 25,
    cohortCounts,
  };
}
