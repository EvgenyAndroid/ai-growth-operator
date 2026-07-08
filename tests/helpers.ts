/**
 * tests/helpers.ts — deterministic factories for the P9 node:test suite.
 *
 * Pure in-memory builders for the Prisma model shapes the recipe functions
 * consume (recipes are pure: (RecipeInput, RecipeDataSnapshot) -> RecipeResult,
 * so no database is needed to test them). Everything is anchored to a FIXED
 * reference clock (AS_OF) — no Date.now(), no randomness, no live services.
 *
 * Not a test file itself (no .test. in the name), so the runner skips it.
 */

import type { DataFreshness, RecipeConfigShape, RecipeId, RecipeInput } from "../lib/contracts";
import { RECIPE_CONFIG_DEFAULTS } from "../lib/contracts";
import type { Customer, Event, Product } from "../lib/contracts/models";
import type { RecipeDataSnapshot } from "../lib/recipes/types";

export const TEST_ACCOUNT_ID = "ctestaccount0000000000000";

/** Fixed reference clock — every timestamp in the suite derives from this. */
export const AS_OF = new Date("2026-01-30T12:00:00.000Z");

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export function daysAgo(days: number, from: Date = AS_OF): Date {
  return new Date(from.getTime() - days * MS_PER_DAY);
}

export function hoursAgo(hours: number, from: Date = AS_OF): Date {
  return new Date(from.getTime() - hours * MS_PER_HOUR);
}

// ---------------------------------------------------------------------------
// Model factories — full Prisma shapes with safe defaults, override what matters
// ---------------------------------------------------------------------------

export function makeCustomer(
  overrides: Partial<Customer> & { id: string },
): Customer {
  const base: Customer = {
    id: overrides.id,
    accountId: TEST_ACCOUNT_ID,
    sourceCustomerIds: { shopify: `shp_${overrides.id}` },
    emailHash: `hash_${overrides.id}`,
    emailLower: `${overrides.id}@example.com`,
    consentEmail: true,
    consentProvenance: "signup",
    consentAds: false,
    consentAdsProvenance: null,
    lifecycleStage: "active",
    firstPurchaseDate: null,
    lastPurchaseDate: null,
    totalOrders: 0,
    totalRevenue: 0,
    purchaseIntervalStats: null,
    refundRate: 0,
    suppressionStatus: "none",
    sourceReferences: null,
    createdAt: AS_OF,
    updatedAt: AS_OF,
  };
  return { ...base, ...overrides };
}

let eventSeq = 0;

export function makeEvent(
  overrides: Partial<Event> & { eventType: string; eventTimestamp: Date },
): Event {
  eventSeq += 1;
  const base: Event = {
    id: `evt_${String(eventSeq).padStart(6, "0")}`,
    accountId: TEST_ACCOUNT_ID,
    customerId: null,
    productId: null,
    eventType: overrides.eventType,
    eventTimestamp: overrides.eventTimestamp,
    source: "shopify",
    campaignId: null,
    value: null,
    metadata: null,
  };
  return { ...base, ...overrides };
}

export function makeProduct(
  overrides: Partial<Product> & { id: string },
): Product {
  const base: Product = {
    id: overrides.id,
    accountId: TEST_ACCOUNT_ID,
    sourceProductId: `src_${overrides.id}`,
    name: `Product ${overrides.id}`,
    category: null,
    price: 40,
    availability: "available",
    productUrl: null,
    structuredAttributes: null,
    repeatPurchaseFlag: false,
    replenishmentWindowDays: null,
    seasonalFlag: false,
    repeatability: "unknown",
    repeatabilityOverride: null,
    createdAt: AS_OF,
    updatedAt: AS_OF,
  };
  return { ...base, ...overrides };
}

/** All-fresh freshness entries (freshness gates are exercised separately). */
export function freshFreshness(): DataFreshness[] {
  return [
    {
      source: "shopify",
      lastSyncAt: AS_OF.toISOString(),
      thresholdHours: 24,
      isStale: false,
    },
    {
      source: "klaviyo",
      lastSyncAt: AS_OF.toISOString(),
      thresholdHours: 24,
      isStale: false,
    },
  ];
}

export function makeSnapshot(
  overrides: Partial<RecipeDataSnapshot> = {},
): RecipeDataSnapshot {
  return {
    accountId: TEST_ACCOUNT_ID,
    customers: [],
    products: [],
    events: [],
    existingFlows: [],
    flowMembershipSource: "flow_membership",
    heldOutCustomerIdsByActionType: {},
    manualExclusionCustomerIds: [],
    freshness: freshFreshness(),
    ...overrides,
  };
}

export function makeRecipeInput<R extends RecipeId>(
  recipeId: R,
  configOverrides: Partial<RecipeConfigShape[R]> = {},
): RecipeInput<R> {
  return {
    accountId: TEST_ACCOUNT_ID,
    recipeId,
    config: { ...RECIPE_CONFIG_DEFAULTS[recipeId], ...configOverrides },
    dataAsOf: AS_OF.toISOString(),
    constitutionVersion: 1,
  };
}
