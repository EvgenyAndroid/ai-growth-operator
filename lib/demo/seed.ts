/**
 * lib/demo/seed.ts — writes the deterministic demo dataset to the database.
 *
 * One demo Account + Shopify DTC Constitution v1 (PRD 12.2-12.4), mock
 * Integration rows with freshness timestamps, ~1215 customers, 150 products,
 * ~5000 events, existing pre-Operator Klaviyo flows (26B.11), recipe configs,
 * and one completed historical win-back action with a measured 10% holdout so
 * the performance screen has holdout-verified history on day 0 (PRD 20.4).
 *
 * Idempotent: re-running deletes and recreates the demo account (cascade).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { createHash } from "node:crypto";
import db from "../db";
import {
  DEFAULT_MEASUREMENT_WINDOWS,
  MEASUREMENT_LABEL_COPY,
  RECIPE_CONFIG_DEFAULTS,
  RECIPE_IDS,
  type ExplanationContract,
} from "../contracts";
import type { Prisma } from "../contracts/models";
import {
  DEMO_ACCOUNT_NAME,
  EXISTING_RECOVERY_FLOW_CAMPAIGN_ID,
  HISTORICAL_WINBACK_CAMPAIGN_ID,
  datasetAov,
  type DemoDatasetInternal,
} from "./generator";
import { loadDemoDataset } from "./index";
import { median, money } from "./prng";

export interface SeedSummary {
  accountId: string;
  accountName: string;
  referenceDate: string;
  customers: number;
  products: number;
  events: number;
  integrations: number;
  audiences: number;
  holdoutMemberships: number;
  ledgerEntries: number;
  recipeConfigs: number;
  historicalActionId: string;
  aov: number;
  cohortCounts: Record<string, number>;
}

const HISTORICAL_DEDUP_SUFFIX = "winback-2026-04"; // keeps 26B.16 active-card key free

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function seedDemoDatabase(
  dataset: DemoDatasetInternal = loadDemoDataset()
): Promise<SeedSummary> {
  const refMs = new Date(dataset.referenceDate).getTime();
  const at = (daysAgo: number): Date => new Date(refMs - daysAgo * 86400000);
  const aov = datasetAov(dataset);

  // --- idempotency: wipe any previous demo account (cascades to children) ---
  await db.account.deleteMany({ where: { name: DEMO_ACCOUNT_NAME } });

  // --- account + constitution v1 (Shopify DTC template, PRD 12.2-12.4) ---
  const account = await db.account.create({
    data: {
      name: dataset.account.name,
      vertical: dataset.account.vertical,
      demoMode: true, // PRD 20.3: demo must be clearly labeled
    },
  });

  await db.constitution.create({
    data: {
      accountId: account.id,
      templateVertical: "shopify_dtc",
      version: 1,
      monthlyBudgetCap: dataset.constitution.monthlyBudgetCap,
      maxDiscountPercent: dataset.constitution.maxDiscountPercent,
      marginFloorPercent: 55,
      dailySendCap: dataset.constitution.dailySendCap,
      frequencyCaps: { emailPerCustomerPerWeek: 3, smsPerCustomerPerWeek: 0 },
      blackoutDates: [],
      toneGuide: dataset.constitution.toneGuide,
      bannedClaims: dataset.constitution.bannedClaims,
      suppressionDefaults: {
        excludeUnsubscribed: true,
        excludeSuppressed: true,
        excludeNoEmailConsent: true,
        excludeNoAdsConsentForAudienceSync: true,
      },
      approvalRequirements: {
        // 26A.4: draft is not activation — all of these require explicit approval.
        customerFacingSend: true,
        audienceSync: true,
        suppressionChange: true,
        budgetChange: true,
        publicFacingAction: true,
      },
      effectiveFrom: at(60),
    },
  });

  // --- integrations (mock connectors, PRD 25.1) + sync runs ---
  const purchaseEvents = dataset.events.filter((e) => e.eventType === "purchase").length;
  const checkoutEvents = dataset.events.filter((e) => e.eventType === "checkout_started").length;
  const recordsBySource: Record<string, number> = {
    shopify: dataset.customers.length + dataset.products.length + purchaseEvents + checkoutEvents,
    klaviyo: dataset.customers.filter((c) => c.klaviyoId !== undefined).length,
    meta: 2, // audience containers visible on the mock ad account
    ga4: 8600, // sessions in lookback (context only; GA4 not required for value)
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
        startedAt: new Date(completed.getTime() - 14 * 60000),
        completedAt: completed,
        status: "succeeded",
        recordsRead: recordsBySource[integ.source] ?? 0,
      },
    });
  }

  // --- recipe configs (defaults; 26A.6 editable assumptions) ---
  for (const recipeId of RECIPE_IDS) {
    await db.recipeConfig.create({
      data: {
        accountId: account.id,
        recipeId,
        params: RECIPE_CONFIG_DEFAULTS[recipeId] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // --- products ---
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

  // --- customers ---
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
        shopify: c.shopifyId,
        ...(c.klaviyoId !== undefined ? { klaviyo: c.klaviyoId } : {}),
      },
      emailHash: sha256(c.emailLower),
      emailLower: c.emailLower, // 26B.12 v0 identity join key
      consentEmail: c.consentEmail,
      consentProvenance: c.consentEmail
        ? "klaviyo profile opt-in (demo import)"
        : "no opt-in on record (demo import)",
      consentAds: c.consentAds,
      consentAdsProvenance: `shopify customer_privacy opt_out_of_sharing=${c.consentAds ? "false" : "true"} (demo import)`,
      lifecycleStage: c.lifecycleStage,
      firstPurchaseDate: c.firstPurchaseDate !== undefined ? new Date(c.firstPurchaseDate) : null,
      lastPurchaseDate: c.lastPurchaseDate !== undefined ? new Date(c.lastPurchaseDate) : null,
      totalOrders: c.totalOrders,
      totalRevenue: c.totalRevenue,
      purchaseIntervalStats: stats === null ? undefined : (stats as unknown as Prisma.InputJsonValue),
      refundRate: c.refundRate ?? null,
      suppressionStatus: c.suppressionStatus,
      sourceReferences: { origin: "demo-dataset", seed: dataset.seed },
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

  // --- events ---
  const eventData: Prisma.EventCreateManyInput[] = dataset.events.map((e) => ({
    accountId: account.id,
    customerId: customerIdByEmail.get(e.customerEmailLower) ?? null,
    productId:
      e.sourceProductId !== undefined ? (productIdBySource.get(e.sourceProductId) ?? null) : null,
    eventType: e.eventType,
    eventTimestamp: new Date(e.eventTimestamp),
    source: e.source,
    campaignId: e.campaignId ?? null,
    value: e.value ?? null,
  }));
  for (const batch of chunk(eventData, 400)) {
    await db.event.createMany({ data: batch });
  }

  // --- existing pre-Operator Klaviyo flows (26B.11) as manual Audience rows ---
  // No dedicated Flow model exists; membership lives in inclusionRules.memberEmails
  // and engagement is also visible as email events with the flow campaignId (26A.5).
  let audienceCount = 0;
  for (const flow of dataset.existingFlows) {
    await db.audience.create({
      data: {
        accountId: account.id,
        name: `Existing Klaviyo flow: ${flow.name}`,
        creationMethod: "manual",
        inclusionRules: {
          type: "existing_klaviyo_flow",
          flowType: flow.type,
          active: flow.active,
          campaignId: flow.type === "recovery" ? EXISTING_RECOVERY_FLOW_CAMPAIGN_ID : null,
          memberEmails: flow.memberCustomerEmails,
        },
        exclusionRules: {},
        size: flow.memberCustomerEmails.length,
        eligibleChannels: ["klaviyo_email"],
        destinationStatus: "accepted",
      },
    });
    audienceCount += 1;
  }

  // Soft contract with lib/recipes/loader.ts and lib/server/shared.ts: flow
  // membership is read from Preference key "existing_flows" (26A.5 — real
  // flow membership, not proxy). Without this row every recipe flags
  // contamination risk and downgrades to Low confidence, which empties the
  // found-money header (PRD 16.2).
  await db.preference.upsert({
    where: {
      accountId_key: { accountId: account.id, key: "existing_flows" },
    },
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

  // -------------------------------------------------------------------------
  // Historical completed win-back action with measured holdout (PRD 20.4)
  // -------------------------------------------------------------------------

  const hw = dataset.historicalWinback;
  const launched = at(hw.launchDaysAgo);
  const windows = DEFAULT_MEASUREMENT_WINDOWS.lapsed_winback;

  const winbackAudience = await db.audience.create({
    data: {
      accountId: account.id,
      name: hw.audienceName,
      creationMethod: "recipe",
      inclusionRules: {
        recipeId: "lapsed_winback",
        rule: "gap > 1.5x personal median purchase interval",
        minPurchases: 3,
        consentEmail: true,
      },
      exclusionRules: {
        suppressed: true,
        unsubscribed: true,
        activeRecoveryFlowMembers: true,
        activeWinbackFlowMembers: true,
        recentPurchasers30d: true,
      },
      size: hw.eligibleEmails.length,
      eligibleChannels: ["klaviyo_email"],
      lastSyncedAt: launched,
      destinationStatus: "accepted",
    },
  });
  audienceCount += 1;

  const holdout = await db.holdout.create({
    data: {
      accountId: account.id,
      eligibleAudienceSize: hw.eligibleEmails.length,
      holdoutPercent: 10,
      holdoutSize: hw.heldOutEmails.length,
      assignmentMethod: "randomized_customer_level",
      startedAt: launched,
      exclusionWindow: "P30D",
      status: "measured",
      measuredLiftLow: hw.liftLow,
      measuredLiftHigh: hw.liftHigh,
      confidence: "medium",
      contaminationRisk: "low",
    },
  });

  const membershipData: Prisma.HoldoutMembershipCreateManyInput[] = [];
  for (const email of hw.treatedEmails) {
    const customerId = customerIdByEmail.get(email);
    if (customerId === undefined) continue;
    membershipData.push({ holdoutId: holdout.id, customerId, arm: "treated", assignedAt: launched });
  }
  for (const email of hw.heldOutEmails) {
    const customerId = customerIdByEmail.get(email);
    if (customerId === undefined) continue;
    membershipData.push({ holdoutId: holdout.id, customerId, arm: "held_out", assignedAt: launched });
  }
  for (const batch of chunk(membershipData, 400)) {
    await db.holdoutMembership.createMany({ data: batch });
  }

  const estimateLow = money(hw.eligibleEmails.length * 0.02 * aov);
  const estimateHigh = money(hw.eligibleEmails.length * 0.05 * aov);

  const explanation: ExplanationContract = {
    found: `${hw.eligibleEmails.length} customers were past 1.5x their personal reorder cadence with email consent and no active win-back coverage.`,
    whyItMatters:
      "Lapsed repeat buyers respond to a timely nudge; waiting longer lowers the win-back rate.",
    dataUsed: [
      "shopify: orders, purchase intervals",
      "klaviyo: consent, suppression, existing flow membership",
    ],
    dataFreshness: [
      {
        source: "demo",
        lastSyncAt: at(hw.launchDaysAgo + 0.1).toISOString(),
        thresholdHours: 24,
        isStale: false,
      },
    ],
    assumptions: [
      "Modeled win-back rate 2-5% (conservative editable default, no merchant baseline at launch — 26A.6).",
      `Average order value $${aov.toFixed(2)} from 180-day order history.`,
    ],
    risk: "Discount exposure limited to 10% single-use code, under the 15% Operating Rules ceiling.",
    approvalNeeded: "Approved by founder before send; draft alone did not activate (26A.4).",
    measurementPlan: {
      mode: "holdout",
      label: "holdout-verified",
      summary:
        "10% randomized customer-level holdout assigned at launch; primary read at 21 days.",
      holdout: {
        eligibleAudienceSize: hw.eligibleEmails.length,
        holdoutPercent: 10,
        holdoutSize: hw.heldOutEmails.length,
        assignmentMethod: "randomized_customer_level",
        exclusionWindow: "P30D",
        enforceable: true,
      },
      windows: windows.map((w) => ({ readType: w.readType, days: w.days })),
      caveats: [
        "Holdout excludes customers from this Operator campaign only; the active pre-Operator recovery flow may still reach a few members (26A.5) — risk assessed low.",
        "Customers may belong to multiple concurrent holdouts; cross-flow interaction possible (26B.14).",
      ],
    },
  };

  const opportunity = await db.opportunity.create({
    data: {
      accountId: account.id,
      // Historical (measured) card: suffixed key so the live `${accountId}:lapsed_winback`
      // dedup key (26B.16) stays free for the recipes module's active card.
      dedupKey: `${account.id}:lapsed_winback:${HISTORICAL_DEDUP_SUFFIX}`,
      recipeId: "lapsed_winback",
      recipeVersion: "1.0.0",
      title: "Win back lapsed customers — April 2026 cohort",
      category: "winback",
      estimatedValueLow: estimateLow,
      estimatedValueHigh: estimateHigh,
      estimateLabel: "modeled",
      confidence: "medium",
      dataAsOf: at(hw.launchDaysAgo + 2),
      estimateVerifiedAt: at(hw.launchDaysAgo + 1),
      recommendedAction: "klaviyo_winback_flow",
      explanation: explanation as unknown as Prisma.InputJsonValue,
      status: "measured",
      outcome: {
        measurementMode: "holdout",
        label: MEASUREMENT_LABEL_COPY.holdout,
        treatedRate: hw.treatedRate,
        heldOutRate: hw.heldOutRate,
        liftRangeAbsolute: { low: hw.liftLow, high: hw.liftHigh },
        incrementalRevenueRange: {
          low: hw.incrementalRevenueLow,
          high: hw.incrementalRevenueHigh,
        },
      },
      createdAt: at(hw.launchDaysAgo + 2),
    },
  });

  const action = await db.action.create({
    data: {
      accountId: account.id,
      type: "klaviyo_winback_flow",
      objective: "Win back lapsed customers past their personal reorder cadence",
      channel: "klaviyo",
      audienceId: winbackAudience.id,
      opportunityId: opportunity.id,
      status: "launched",
      createdBy: "operator",
      approvedBy: "founder@brightleaf-demo.example",
      launchedAt: launched,
      constitutionVersion: 1,
      holdoutId: holdout.id,
      measurementMode: "holdout",
      expectedOutcome: {
        estimateRange: { low: estimateLow, high: estimateHigh, label: "modeled" },
        assumedWinbackRate: { low: 0.02, high: 0.05 },
      },
      measuredOutcome: {
        window: { readType: "primary", days: 21 },
        treated: hw.treatedEmails.length,
        heldOut: hw.heldOutEmails.length,
        treatedPurchasers: hw.convertedTreatedEmails.length,
        heldOutPurchasers: hw.convertedHeldOutEmails.length,
        treatedRate: hw.treatedRate,
        heldOutRate: hw.heldOutRate,
        liftRangeAbsolute: { low: hw.liftLow, high: hw.liftHigh },
        incrementalRevenueRange: {
          low: hw.incrementalRevenueLow,
          high: hw.incrementalRevenueHigh,
        },
        contaminationRisk: "low",
        caveats: [
          "Range reflects small holdout arm (n=54); interpret edges with caution.",
          "Active pre-Operator recovery flow could reach some held-out customers (26A.5).",
        ],
      },
      liftLow: hw.liftLow,
      liftHigh: hw.liftHigh,
      confidenceLevel: "medium",
      activationLevel: "klaviyo_campaign_draft", // holdout enforceable in-path (26A.1)
      sourceReferences: { campaignId: HISTORICAL_WINBACK_CAMPAIGN_ID },
      createdAt: at(hw.launchDaysAgo + 2),
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
          subject: "Your Brightleaf ritual, restocked",
          preview: "It has been a while — your shelf might be running low.",
          body:
            "Hi {{first_name}}, it looks like your last {{last_product}} is likely running low. " +
            "Here is what is new in the collection since your last visit.",
          offer: null,
        },
        {
          step: 2,
          subject: "Small rituals, kept simple",
          preview: "Why customers keep {{last_product}} on repeat.",
          body:
            "A quick note on how {{last_product}} fits a morning routine, plus answers to the " +
            "three questions we hear most.",
          offer: null,
        },
        {
          step: 3,
          subject: "A little thank-you for coming back",
          preview: "10% off your restock, this week only.",
          body:
            "Welcome back whenever you are ready — here is 10% off your next order with code " +
            "RETURN10. One use, valid 7 days.",
          offer: { type: "discount_percent", value: 10, code: "RETURN10" },
        },
      ],
      sequence: { steps: 3, spacingDays: [0, 3, 7], exitOnPurchase: true },
      activationTarget: "klaviyo_campaign_draft",
      currentVersion: 1,
      edits: [],
      status: "activated",
      createdAt: at(hw.launchDaysAgo + 1.5),
    },
  });

  await db.approval.create({
    data: {
      accountId: account.id,
      actionId: action.id,
      draftId: draft.id,
      approver: "founder@brightleaf-demo.example",
      status: "approved",
      timestamp: at(hw.launchDaysAgo + 1),
    },
  });

  for (const w of windows) {
    await db.measurementWindow.create({
      data: {
        accountId: account.id,
        actionId: action.id,
        start: launched,
        end: at(hw.launchDaysAgo - w.days),
        mode: "holdout",
        readType: w.readType,
        assumptions: {
          attribution: "purchase by holdout arm within window, customer-level",
          joinKey: "lowercase email exact match (26B.12)",
          lookbackDays: 180,
        },
      },
    });
  }

  // --- context ledger history (PRD 18 / 20.2) ---
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
      reasoningSummary: `Mock ${integ.source} sync completed (demo mode).`,
    });
  }

  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo + 2),
    eventType: "opportunity_found",
    opportunityId: opportunity.id,
    skillInvoked: "recipe:lapsed_winback",
    constitutionVersion: 1,
    confidence: "medium",
    reasoningSummary: `${hw.eligibleEmails.length} lapsed customers past 1.5x personal median cadence; modeled estimate $${estimateLow}-$${estimateHigh}.`,
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo + 1.5),
    eventType: "opportunity_drafted",
    opportunityId: opportunity.id,
    actionId: action.id,
    skillInvoked: "drafting:winback_sequence",
    constitutionVersion: 1,
    reasoningSummary: "3-email win-back sequence drafted; 10% offer within 15% Operating Rules ceiling.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo + 1),
    eventType: "approval",
    userId: "founder@brightleaf-demo.example",
    opportunityId: opportunity.id,
    actionId: action.id,
    constitutionVersion: 1,
    approvalStatus: "approved",
    reasoningSummary: "Founder approved campaign draft after copy review.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo + 0.05),
    eventType: "holdout_assignment",
    actionId: action.id,
    constitutionVersion: 1,
    measurementMode: "holdout",
    reasoningSummary: `10% randomized customer-level holdout: ${hw.heldOutEmails.length} of ${hw.eligibleEmails.length} held out; exclusion enforced on lowercase-email join key (26B.12).`,
  });
  await ledger({
    accountId: account.id,
    timestamp: launched,
    eventType: "activation_success",
    actionId: action.id,
    constitutionVersion: 1,
    destination: "klaviyo",
    activationLevel: "klaviyo_campaign_draft",
    actionTaken: "Win-back campaign launched to treated arm (486 customers).",
    rollbackPath: "Pause campaign in Klaviyo; suppression list restore not required.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo - 7),
    eventType: "measurement_readback",
    actionId: action.id,
    measurementMode: "holdout",
    measuredOutcome: { window: "early(7d)", note: "directionally positive; range not yet reportable" },
    reasoningSummary: "Early read at 7 days recorded; waiting for primary window.",
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo - 21),
    eventType: "measurement_readback",
    actionId: action.id,
    measurementMode: "holdout",
    confidence: "medium",
    measuredOutcome: {
      window: "primary(21d)",
      treatedRate: hw.treatedRate,
      heldOutRate: hw.heldOutRate,
      liftRangeAbsolute: { low: hw.liftLow, high: hw.liftHigh },
    },
    reasoningSummary: `Primary read: treated ${(hw.treatedRate * 100).toFixed(1)}% vs holdout ${(hw.heldOutRate * 100).toFixed(1)}% purchase rate; lift reported as a range.`,
  });
  await ledger({
    accountId: account.id,
    timestamp: at(hw.launchDaysAgo - 21),
    eventType: "performance_summary",
    actionId: action.id,
    measurementMode: "holdout",
    confidence: "medium",
    reasoningSummary:
      "Holdout-verified: win-back campaign lifted purchase rate by an estimated 0.8-7.4pp; " +
      `incremental revenue $${hw.incrementalRevenueLow}-$${hw.incrementalRevenueHigh} (range, never a point).`,
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
    holdoutMemberships: membershipData.length,
    ledgerEntries: ledgerCount,
    recipeConfigs: RECIPE_IDS.length,
    historicalActionId: action.id,
    aov,
    cohortCounts,
  };
}
