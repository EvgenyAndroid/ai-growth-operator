/**
 * lib/server/draft-templates.ts — parameterized copy templates (PRD 25.1 Alpha).
 *
 * NO LLM calls. Every draft is a deterministic template filled with merchant
 * parameters (brand name, audience size, offer ceiling). Copy deliberately
 * avoids every PRD 12.6 flagged claim, and Meta copy avoids every
 * META_DISALLOWED_TERMS phrase (checked again at approval time by the
 * governance claims gate — this is belt, governance is suspenders).
 *
 * Offer logic:
 *  - offer steps never exceed the Operating Rules discount ceiling (PRD 12.4)
 *  - when the learned preference offer_stance === "avoid_discounts" (26B.18),
 *    offer steps are replaced with non-discount angles (PRD 6.3 recommends the
 *    non-discount angle first anyway).
 */

import type { Constitution, RecipeId, RecipeResult } from "../contracts";
import type { DraftCopyStep } from "./types";

const DEFAULT_OFFER_PERCENT = 10;

export interface DraftTemplateParams {
  brandName: string;
  constitution: Constitution;
  /** 26B.18 learned preference — true when the merchant avoids discounts. */
  avoidDiscounts: boolean;
}

function offerPercentFor(constitution: Constitution): number {
  return Math.min(DEFAULT_OFFER_PERCENT, Math.floor(constitution.maxDiscountPercent));
}

function recoverySteps(params: DraftTemplateParams): DraftCopyStep[] {
  const { brandName, constitution, avoidDiscounts } = params;
  const offerPercent = offerPercentFor(constitution);
  const steps: DraftCopyStep[] = [
    {
      step: 1,
      channel: "email",
      sendDelayHours: 1,
      subject: "You left something in your cart",
      previewText: `Your ${brandName} picks are still waiting.`,
      body: `Hi {{first_name}},\n\nYou were this close — the items in your cart are still saved for you. Pick up right where you left off.\n\n{{cart_items}}\n\nComplete your order whenever you're ready.\n\n— The ${brandName} team`,
    },
    {
      step: 2,
      channel: "email",
      sendDelayHours: 24,
      subject: "Still thinking it over?",
      previewText: "A quick answer to the questions we hear most.",
      body: `Hi {{first_name}},\n\nStill deciding? Here are answers to the questions customers ask most before ordering: shipping times, returns, and how other customers use {{top_cart_item}}.\n\nYour cart is saved — no rush.\n\n— The ${brandName} team`,
    },
  ];
  if (avoidDiscounts || offerPercent <= 0) {
    steps.push({
      step: 3,
      channel: "email",
      sendDelayHours: 48,
      subject: "Last look at your saved cart",
      previewText: "We'll keep it a little longer.",
      body: `Hi {{first_name}},\n\nThis is the last reminder about your saved cart — after this we'll stop emailing about it. If anything held you back, just reply and we'll help.\n\n— The ${brandName} team`,
    });
  } else {
    steps.push({
      step: 3,
      channel: "email",
      sendDelayHours: 48,
      subject: `${offerPercent}% off to finish your order`,
      previewText: "A small thank-you for coming back.",
      offerPercent,
      body: `Hi {{first_name}},\n\nUse code {{offer_code}} for ${offerPercent}% off the items in your cart. It's valid for 72 hours and applies automatically at checkout.\n\n{{cart_items}}\n\n— The ${brandName} team`,
    });
  }
  return steps;
}

function winbackSteps(params: DraftTemplateParams): DraftCopyStep[] {
  const { brandName, constitution, avoidDiscounts } = params;
  const offerPercent = offerPercentFor(constitution);
  const steps: DraftCopyStep[] = [
    // PRD 6.3 — non-discount angle FIRST.
    {
      step: 1,
      channel: "email",
      sendDelayHours: 0,
      subject: "Time for a restock?",
      previewText: `Based on your usual ${brandName} rhythm.`,
      body: `Hi {{first_name}},\n\nBased on when you last ordered {{last_product}}, you might be running low. Here's what you ordered, plus what's new in {{last_category}} since your last visit.\n\n{{reorder_block}}\n\n— The ${brandName} team`,
    },
  ];
  if (!avoidDiscounts && offerPercent > 0) {
    steps.push({
      step: 2,
      channel: "email",
      sendDelayHours: 96,
      subject: `Welcome back — ${offerPercent}% off your next order`,
      previewText: "It's been a while. This one's on us.",
      offerPercent,
      body: `Hi {{first_name}},\n\nIt's been a while since your last order, so here's ${offerPercent}% off your next one with code {{offer_code}}. Valid for 7 days.\n\n{{recommended_products}}\n\n— The ${brandName} team`,
    });
  } else {
    steps.push({
      step: 2,
      channel: "email",
      sendDelayHours: 96,
      subject: "New since your last visit",
      previewText: "A quick tour of what changed.",
      body: `Hi {{first_name}},\n\nA lot has changed since your last order — new arrivals in {{last_category}} and restocks of customer favorites. Take a look when you have a minute.\n\n{{recommended_products}}\n\n— The ${brandName} team`,
    });
  }
  return steps;
}

function metaSyncPlan(
  params: DraftTemplateParams,
  result: RecipeResult,
): DraftCopyStep[] {
  // NOT customer-facing copy — an audience sync plan. Deliberately free of
  // every META_DISALLOWED_TERMS phrase; reporting language is directional only.
  const seedSize = result.audience.size;
  const suppressionSize = result.suppressionAudience?.size ?? 0;
  return [
    {
      step: 1,
      channel: "meta_audience",
      body:
        `Sync plan for ${params.brandName} (simulated in Alpha):\n\n` +
        `1. Create Meta custom audience "${result.audience.name}" from ${seedSize} consented high-value customers (hashed identifiers).\n` +
        `2. Use it as a lookalike seed where supported.\n` +
        `3. Create suppression audience "${result.suppressionAudience?.name ?? "Recent purchasers"}" from ${suppressionSize} recent purchasers and exclude it from prospecting.\n\n` +
        `Reporting will be directional only: audience size, match rate, sync status, and non-causal downstream observations.`,
    },
  ];
}

/** Build the deterministic template copy for a recipe's drafted action. */
export function buildDraftCopy(
  recipeId: RecipeId,
  result: RecipeResult,
  params: DraftTemplateParams,
): DraftCopyStep[] {
  switch (recipeId) {
    case "abandoned_checkout_recovery":
      return recoverySteps(params);
    case "lapsed_winback":
      return winbackSteps(params);
    case "meta_seed_suppression":
      return metaSyncPlan(params, result);
  }
}

/** Timing/branching metadata persisted on Draft.sequence. */
export function buildDraftSequence(copy: DraftCopyStep[]): {
  steps: Array<{ step: number; sendDelayHours: number | null }>;
} {
  return {
    steps: copy.map((step) => ({
      step: step.step,
      sendDelayHours: step.sendDelayHours ?? null,
    })),
  };
}

/** Highest offer percent present in the draft (for the governance discount gate). */
export function maxOfferPercent(copy: DraftCopyStep[]): number | undefined {
  const offers = copy
    .map((step) => step.offerPercent)
    .filter((p): p is number => typeof p === "number");
  return offers.length > 0 ? Math.max(...offers) : undefined;
}

/** Flatten draft copy into the text list the claims gate scans. */
export function copyTexts(copy: DraftCopyStep[]): string[] {
  const texts: string[] = [];
  for (const step of copy) {
    if (step.subject) texts.push(step.subject);
    if (step.previewText) texts.push(step.previewText);
    texts.push(step.body);
  }
  return texts;
}

/** Parse Draft.copy Json back into typed steps (fail-soft on hand-edited rows). */
export function parseDraftCopy(value: unknown): DraftCopyStep[] {
  if (!Array.isArray(value)) return [];
  const steps: DraftCopyStep[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    if (typeof record.body !== "string" || typeof record.step !== "number") continue;
    steps.push({
      step: record.step,
      channel: record.channel === "meta_audience" ? "meta_audience" : "email",
      subject: typeof record.subject === "string" ? record.subject : undefined,
      previewText:
        typeof record.previewText === "string" ? record.previewText : undefined,
      body: record.body,
      offerPercent:
        typeof record.offerPercent === "number" ? record.offerPercent : undefined,
      sendDelayHours:
        typeof record.sendDelayHours === "number" ? record.sendDelayHours : undefined,
    });
  }
  return steps;
}
