/**
 * lib/recipes/found-money.ts — found-money header calculator (PRD 16.2).
 *
 * The header may ONLY sum abandoned-checkout recovery and lapsed win-back
 * opportunities with Medium or High confidence and a real (non-directional,
 * non-unavailable) estimate range. Meta/directional/Low/no-baseline items are
 * excluded — with an inspectable reason for each. Eligibility is decided by
 * the shared isFoundMoneyEligible() gate; there is no second code path.
 */

import {
  isFoundMoneyEligible,
  type Confidence,
  type EstimateRange,
  type RecipeId,
} from "../contracts";
import { estimateLabelForResult } from "./lifecycle";

/** Minimal opportunity view the calculator needs (works for RecipeResult or DB rows). */
export interface FoundMoneyItem {
  recipeId: RecipeId;
  confidence: Confidence;
  estimate: EstimateRange | null;
  /** Whether the opportunity is dismissed/expired — dismissed cards never count. */
  active?: boolean;
}

export interface FoundMoneyHeader {
  /** True only when at least one eligible opportunity exists — otherwise render no header. */
  show: boolean;
  totalLow: number;
  totalHigh: number;
  currency: "USD";
  includedRecipeIds: RecipeId[];
  excluded: Array<{ recipeId: RecipeId; reason: string }>;
  /**
   * 26B.11 framing — estimates are net of existing automation, and the header
   * copy must say so. Null when show === false.
   */
  headline: string | null;
}

export function computeFoundMoneyHeader(items: FoundMoneyItem[]): FoundMoneyHeader {
  let totalLow = 0;
  let totalHigh = 0;
  const included: RecipeId[] = [];
  const excluded: Array<{ recipeId: RecipeId; reason: string }> = [];

  for (const item of items) {
    if (item.active === false) {
      excluded.push({ recipeId: item.recipeId, reason: "opportunity is not active" });
      continue;
    }
    if (!item.estimate) {
      excluded.push({
        recipeId: item.recipeId,
        reason:
          item.recipeId === "meta_seed_suppression"
            ? "Meta opportunity is directional-only and never carries a dollar estimate (PRD 16.2)"
            : "no defensible dollar estimate (no baseline)",
      });
      continue;
    }
    const eligible = isFoundMoneyEligible({
      recipeId: item.recipeId,
      confidence: item.confidence,
      estimateLabel: item.estimate.label,
    });
    if (!eligible) {
      const reason =
        item.recipeId === "meta_seed_suppression"
          ? "Meta directional opportunities are never included (PRD 16.2)"
          : item.confidence === "low"
            ? "Low-confidence estimates do not inflate the found-money header (PRD 16.2)"
            : `estimate label "${item.estimate.label}" is not defensible for the header`;
      excluded.push({ recipeId: item.recipeId, reason });
      continue;
    }
    totalLow += item.estimate.low;
    totalHigh += item.estimate.high;
    included.push(item.recipeId);
  }

  const show = included.length > 0;
  return {
    show,
    totalLow: show ? Math.round(totalLow) : 0,
    totalHigh: show ? Math.round(totalHigh) : 0,
    currency: "USD",
    includedRecipeIds: included,
    excluded,
    headline: show
      ? `$${Math.round(totalLow).toLocaleString("en-US")}-$${Math.round(totalHigh).toLocaleString("en-US")} in estimated recoverable revenue — beyond what your current flows already recover`
      : null,
  };
}

/** Convenience: build a FoundMoneyItem straight from a RecipeResult. */
export function foundMoneyItemFromResult(result: {
  recipeId: RecipeId;
  confidence: Confidence;
  estimate: EstimateRange | null;
}): FoundMoneyItem {
  return {
    recipeId: result.recipeId,
    confidence: result.confidence,
    estimate: result.estimate,
    active: true,
  };
}

/** Convenience: build a FoundMoneyItem from a persisted Opportunity row. */
export function foundMoneyItemFromOpportunity(row: {
  recipeId: string;
  confidence: string;
  estimatedValueLow: number | null;
  estimatedValueHigh: number | null;
  estimateLabel: string;
  status: string;
}): FoundMoneyItem {
  const estimate: EstimateRange | null =
    row.estimatedValueLow !== null &&
    row.estimatedValueHigh !== null &&
    (row.estimateLabel === "merchant_historical" || row.estimateLabel === "modeled")
      ? {
          low: row.estimatedValueLow,
          high: row.estimatedValueHigh,
          label: row.estimateLabel,
        }
      : null;
  return {
    recipeId: row.recipeId as RecipeId,
    confidence: row.confidence as Confidence,
    estimate,
    active: row.status !== "dismissed",
  };
}

// Re-exported so header consumers and recipes share one estimate-label rule.
export { estimateLabelForResult };
