/**
 * app/(dashboard)/feed/_shared/format.ts — display formatting + fixed copy
 * shared by the Feed, Opportunity Detail, Audience Builder, and Approval
 * Center slices. Pure functions and constants only (safe in server AND
 * client components).
 */

// Type-only import from the shared contracts layer (erased at build; the
// runtime import-direction rule ui -> lib/server is preserved).
import type { RecipeId } from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Money / dates
// ---------------------------------------------------------------------------

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function fmtMoney(v: number): string {
  return USD.format(Math.round(v));
}

/** PRD 16.4 — estimates render as ranges, never single points. */
export function fmtRange(low: number, high: number): string {
  return `${fmtMoney(low)}–${fmtMoney(high)}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Reason lists
// ---------------------------------------------------------------------------

/**
 * PRD 7.4 — default rejection reasons. Reject (and dismissal, PRD 7.2) must
 * require a reason from this short list plus optional free text.
 */
export const REJECTION_REASONS = [
  "not relevant",
  "too aggressive",
  "wrong audience",
  "wrong offer",
  "not enough value",
  "timing is wrong",
  "copy needs work",
  "do not want discount",
  "other",
] as const;

// ---------------------------------------------------------------------------
// Per-recipe display copy (deterministic, from PRD 10.2 / 10.3 / 10.4)
// ---------------------------------------------------------------------------

/** PRD 7.3 — "estimate formula" must be shown on the detail screen. */
export const RECIPE_ESTIMATE_FORMULAS: Record<RecipeId, string> = {
  abandoned_checkout_recovery:
    "eligible abandoned checkouts × recovery rate × average order value — low bound uses the conservative configured rate, high bound uses the merchant historical rate when available (PRD 10.2, net of existing recovery flows per 26B.11).",
  lapsed_winback:
    "eligible lapsed customers × win-back rate × average order value — low bound uses the conservative configured rate, high bound uses the merchant historical rate when available (PRD 10.3, net of existing win-back flows per 26B.11).",
  meta_seed_suppression:
    "No dollar estimate. Meta audience sync is directional-only in v0 — audience quality metrics only, never lift or recovered-revenue math (PRD 10.4, 15.4).",
};

/**
 * Human-readable inclusion rules per recipe (PRD 7.3 / Audience Builder).
 * The audience DTO exposes name/size/channels; rule text is recipe-defined
 * and deterministic, so it is rendered from the recipe spec here.
 */
export const RECIPE_INCLUSION_RULES: Record<RecipeId, string[]> = {
  abandoned_checkout_recovery: [
    "Started a Shopify checkout within the last 14 days",
    "No purchase since that checkout",
    "Abandoned for at least 4 hours",
    "Email consent or matched Klaviyo profile (lowercase-email join, 26B.12)",
  ],
  lapsed_winback: [
    "Purchase gap exceeds 1.5× the customer's personal median purchase cadence (category fallback when history is thin)",
    "At least one prior purchase",
    "Email consent or matched Klaviyo profile (lowercase-email join, 26B.12)",
    "Product-aware rules applied (repeatability, PRD 10.3)",
  ],
  meta_seed_suppression: [
    "Seed: top 15% of customers by refund-adjusted lifetime value",
    "Seed: ads consent present (consent_ads, 26B.13)",
    "Suppression: purchased within the last 30 days",
  ],
};

export const RECIPE_SHORT_NAMES: Record<RecipeId, string> = {
  abandoned_checkout_recovery: "Abandoned checkout recovery",
  lapsed_winback: "Lapsed customer win-back",
  meta_seed_suppression: "High-LTV Meta seed + purchaser suppression",
};

export const READ_TYPE_LABELS: Record<string, string> = {
  early: "Early read",
  primary: "Primary read",
  long: "Long read",
};
