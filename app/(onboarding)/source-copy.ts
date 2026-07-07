/**
 * app/(onboarding)/source-copy.ts — display copy for connector cards on the
 * Connect Data Sources and Data Readiness screens (PRD 8.1-8.3).
 */

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
