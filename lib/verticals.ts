/**
 * lib/verticals.ts — vertical pack registry. OWNED BY FOUNDATION.
 *
 * Vertical selection routes EVERYTHING: which recipes run, which constitution
 * template seeds Operating Rules, which connectors appear, and which feed copy
 * renders. Modules look verticals up here; they never hardcode vertical checks.
 *
 * The DTC entry preserves current alpha behavior exactly (the three PRD 1.7
 * recipes, the shopify_dtc constitution template, the four mocked connectors,
 * and the current feed strings). The LOCAL entry is the café/bakery pack:
 * Square-like POS + Mailchimp-like email + Google Business Profile, driving
 * in-store purchases (demo-mode only, PRD 25.1).
 */

import {
  DTC_RECIPE_IDS,
  LOCAL_RECIPE_IDS,
  VERTICALS,
  type IdentifiedCoverage,
  type IntegrationSource,
  type RecipeId,
  type Vertical,
} from "./contracts";

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

/** Vertical-specific feed copy. DTC values mirror the current UI strings. */
export interface FeedCopyVariants {
  /** H1 on the opportunity feed. */
  feedTitle: string;
  /** Uppercase label on the found-money header (PRD 16.2). */
  foundMoneyLabel: string;
  /** Empty state when every recipe ran and nothing is active. */
  emptyFeedTitle: string;
  emptyFeedDescription: string;
  /** 26A.10 no-opportunity section heading + subheading. */
  noOpportunityTitle: string;
  noOpportunitySubtitle: string;
}

export interface VerticalDefinition {
  vertical: Vertical;
  displayName: string;
  /** Recipes this vertical runs. Meta seed/suppression is shared across both. */
  recipeIds: readonly RecipeId[];
  /** Constitution.templateVertical value seeded for new accounts. */
  constitutionTemplate: string;
  /** Integration rows provisioned in demo mode (GBP is an Integration row). */
  connectorSet: readonly IntegrationSource[];
  feedCopy: FeedCopyVariants;
  /**
   * LOCAL trust rule (#9): when true, every card and readout for this vertical
   * must carry an IdentifiedCoverage disclosure (identified-transaction share).
   */
  requiresCoverageDisclosure: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const VERTICAL_REGISTRY: Record<Vertical, VerticalDefinition> = {
  shopify_dtc: {
    vertical: "shopify_dtc",
    displayName: "Shopify DTC",
    recipeIds: DTC_RECIPE_IDS,
    constitutionTemplate: "shopify_dtc",
    // Matches the current demo dataset exactly (lib/demo/generator.ts).
    connectorSet: ["shopify", "klaviyo", "meta", "ga4"],
    feedCopy: {
      // Current strings from app/(dashboard)/feed/page.tsx — do not change.
      feedTitle: "Opportunity Feed",
      foundMoneyLabel: "Found money",
      emptyFeedTitle: "No active opportunities",
      emptyFeedDescription:
        "Every recipe ran and nothing is currently active. Check the dismissed section below or re-sync your data sources.",
      noOpportunityTitle:
        "Nothing qualified here — and here is exactly what was checked",
      noOpportunitySubtitle:
        "The Operator explains empty results instead of hiding them.",
    },
    requiresCoverageDisclosure: false,
  },
  local_service: {
    vertical: "local_service",
    displayName: "Local café / bakery",
    recipeIds: LOCAL_RECIPE_IDS,
    constitutionTemplate: "local_service",
    // Square-like POS, Mailchimp-like email, Google Business Profile, plus the
    // shared Meta seed/suppression destination.
    connectorSet: ["square", "mailchimp", "gbp", "meta"],
    feedCopy: {
      feedTitle: "Opportunity Feed",
      foundMoneyLabel: "Found money (identified customers)",
      emptyFeedTitle: "No active opportunities",
      emptyFeedDescription:
        "Every recipe ran against your identified (loyalty-matched) customers and nothing is currently active. Check the dismissed section below or re-sync your POS and email data.",
      noOpportunityTitle:
        "Nothing qualified here — and here is exactly what was checked",
      noOpportunitySubtitle:
        "The Operator explains empty results instead of hiding them. Local checks cover identified (loyalty-matched) customers only.",
    },
    requiresCoverageDisclosure: true,
  },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function isVertical(value: string): value is Vertical {
  return (VERTICALS as readonly string[]).includes(value);
}

/**
 * Resolve an Account.vertical string to its pack. Unknown values throw —
 * routing silently to the wrong vertical would violate the trust rules.
 */
export function getVerticalDefinition(vertical: string): VerticalDefinition {
  if (!isVertical(vertical)) {
    throw new Error(
      `Unknown vertical "${vertical}" — expected one of: ${VERTICALS.join(", ")}`,
    );
  }
  return VERTICAL_REGISTRY[vertical];
}

/** Recipes a given vertical runs (vertical selection routes everything). */
export function recipeIdsForVertical(vertical: string): readonly RecipeId[] {
  return getVerticalDefinition(vertical).recipeIds;
}

// ---------------------------------------------------------------------------
// LOCAL POS coverage disclosure (trust rule #9)
// ---------------------------------------------------------------------------

/**
 * Build the IdentifiedCoverage disclosure for a local recipe result/readout.
 * `identifiedShare` is the fraction (0..1) of POS transactions matched to an
 * identified (loyalty) customer over the recipe's lookback window.
 */
export function buildIdentifiedCoverage(
  identifiedShare: number,
): IdentifiedCoverage {
  if (
    !Number.isFinite(identifiedShare) ||
    identifiedShare < 0 ||
    identifiedShare > 1
  ) {
    throw new Error(
      `identifiedShare must be in [0, 1]; got ${String(identifiedShare)}`,
    );
  }
  const pct = Math.round(identifiedShare * 100);
  return {
    identifiedShare,
    note: `Covers identified (loyalty-matched) customers only — ${pct}% of POS transactions are identified. Unidentified walk-in sales are not included in this estimate.`,
  };
}
