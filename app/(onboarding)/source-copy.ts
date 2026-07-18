/**
 * app/(onboarding)/source-copy.ts — display copy for connector cards on the
 * Connect Data Sources and Data Readiness screens (PRD 8.1-8.3).
 */

// Type-only import from the shared contracts layer (erased at build; the
// runtime import-direction rule ui -> lib/server is preserved).
import type { Vertical } from "@/lib/contracts";
import type { ConnectionStatusView } from "@/lib/server";

export type SourceId = ConnectionStatusView["source"];

export interface SourceCopy {
  id: SourceId;
  name: string;
  /** Requirement tier per PRD 8.1-8.3. */
  tier: "required" | "connectable" | "recommended" | "optional";
  tierLabel: string;
  description: string;
  /** What connecting this source unlocks (Data Readiness screen). */
  unlocks: string[];
  note?: string;
}

export const SOURCE_ORDER: SourceId[] = [
  "shopify",
  "klaviyo",
  "meta",
  "ga4",
  "stripe",
];

/**
 * Connector-card order per vertical (mirrors lib/verticals connectorSet plus
 * the DTC-only optional Stripe card). DTC is the pre-vertical SOURCE_ORDER
 * unchanged; LOCAL shows Square-like POS + Mailchimp-like email + GBP + the
 * shared Meta destination.
 */
export const SOURCE_ORDER_BY_VERTICAL: Record<Vertical, SourceId[]> = {
  shopify_dtc: SOURCE_ORDER,
  local_service: ["square", "mailchimp", "gbp", "meta"],
};

export const SOURCE_COPY: Record<SourceId, SourceCopy> = {
  shopify: {
    id: "shopify",
    name: "Shopify",
    tier: "required",
    tierLabel: "Required",
    description:
      "Customers, orders, refunds, products, and checkouts — the demand signal.",
    unlocks: [
      "Abandoned checkout detection (recipe 1)",
      "Purchase cadence for lapsed win-back (recipe 2)",
      "Revenue history behind every estimate range",
    ],
  },
  klaviyo: {
    id: "klaviyo",
    name: "Klaviyo",
    tier: "required",
    tierLabel: "Required",
    description:
      "Profiles, consent, suppression, flows, and campaigns — the safe-send layer.",
    unlocks: [
      "Holdout-verified lift on flows reaching 500+ eligible customers",
      "Consent + suppression checks on every audience",
      "Existing-flow exclusions so estimates are net of what you already recover",
      "Email activation ladder (campaign draft, exportable brief)",
    ],
  },
  meta: {
    id: "meta",
    name: "Meta Ads",
    tier: "connectable",
    tierLabel: "Connectable",
    description:
      "Custom audiences, match status, and sync status for acquisition quality.",
    unlocks: [
      "High-LTV seed audiences (recipe 3)",
      "Recent-purchaser suppression audiences",
      "Directional downstream reporting — never lift claims",
    ],
  },
  ga4: {
    id: "ga4",
    name: "GA4",
    tier: "recommended",
    tierLabel: "Recommended — not required",
    description:
      "Site behavior and referral context for richer performance interpretation.",
    unlocks: [
      "Enhanced performance interpretation",
      "Referral and site-behavior context",
    ],
    note: "GA4 absence never blocks your first opportunity (PRD 8.2).",
  },
  stripe: {
    id: "stripe",
    name: "Stripe (read-only)",
    tier: "optional",
    tierLabel: "Optional",
    description:
      "Failed payments, billing state, and refund reconciliation context.",
    unlocks: [
      "Failed-payment context",
      "Refund reconciliation where available",
    ],
    note: "Not included in the alpha demo dataset.",
  },
  // LOCAL vertical pack (demo-mode). Not in SOURCE_ORDER, so the DTC
  // onboarding screens are unchanged; ordered via SOURCE_ORDER_BY_VERTICAL.
  square: {
    id: "square",
    name: "Square POS",
    tier: "required",
    tierLabel: "Required",
    description:
      "In-store orders, tickets, and loyalty matches — the demand signal for local.",
    unlocks: [
      "Visit cadence for lapsed-regular win-back",
      "Large-order detection for catering upsell",
      "Holdout-verified lift when identified audiences reach 500",
      "Identified-transaction share behind every local estimate",
    ],
    note: "Estimates cover identified (loyalty-matched) customers only.",
  },
  mailchimp: {
    id: "mailchimp",
    name: "Mailchimp",
    tier: "required",
    tierLabel: "Required",
    description:
      "Audiences, consent, and campaigns — the safe-send layer for local email.",
    unlocks: [
      "Consent + suppression checks on every audience",
      "Email activation ladder (campaign draft, exportable brief)",
    ],
  },
  gbp: {
    id: "gbp",
    name: "Google Business Profile",
    tier: "recommended",
    tierLabel: "Recommended — local discovery",
    description:
      "Listing views, reviews, and local search context for interpretation.",
    unlocks: [
      "Local demand and review context",
      "Richer performance interpretation",
    ],
    note: "GBP absence never blocks your first opportunity.",
  },
};

/** Order connections for display; sources missing from the DB come back null. */
export function orderConnections(
  connections: ConnectionStatusView[],
): Array<{ copy: SourceCopy; status: ConnectionStatusView | null }> {
  return SOURCE_ORDER.map((id) => ({
    copy: SOURCE_COPY[id],
    status: connections.find((c) => c.source === id) ?? null,
  }));
}

/**
 * Vertical-aware ordering (trust rule #10 — vertical selection routes the
 * connect + readiness screens). "shopify_dtc" is byte-identical to
 * orderConnections().
 */
export function orderConnectionsForVertical(
  vertical: Vertical,
  connections: ConnectionStatusView[],
): Array<{ copy: SourceCopy; status: ConnectionStatusView | null }> {
  return SOURCE_ORDER_BY_VERTICAL[vertical].map((id) => ({
    copy: SOURCE_COPY[id],
    status: connections.find((c) => c.source === id) ?? null,
  }));
}
