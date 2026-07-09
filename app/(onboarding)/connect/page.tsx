/**
 * app/(onboarding)/connect/page.tsx — Screen 5: Connect Data Sources
 * (PRD 7.1, 8.1-8.3). Demo connector cards, routed by the account's vertical
 * (trust rule #10): Shopify DTC shows Shopify + Klaviyo + Meta + GA4 + Stripe
 * exactly as before; LOCAL shows Square POS + Mailchimp + Google Business
 * Profile ("Recommended — local discovery") + Meta. All connectors are mocked
 * in the alpha (PRD 25.1).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, StatusDot } from "@/components/ui/primitives";
import { ensureDemoAccount, getConnectionStatus } from "@/lib/server";

// Freshness must reflect the live DB — never prerender at build time.
export const dynamic = "force-dynamic";
import { ResyncButton } from "../resync-button";
import { orderConnectionsForVertical, type SourceCopy } from "../source-copy";
import type { ConnectionStatusView } from "@/lib/server";

const TIER_TONE = {
  required: "info",
  connectable: "neutral",
  recommended: "info",
  optional: "neutral",
} as const;

function StatusBadge({ status }: { status: ConnectionStatusView | null }) {
  if (!status) return <Badge tone="neutral">Not connected</Badge>;
  if (status.isStale)
    return (
      <Badge tone="caution">
        <StatusDot tone="warning" />
        Connected — stale
      </Badge>
    );
  return (
    <Badge tone="positive">
      <StatusDot tone="money" pulse />
      Connected
    </Badge>
  );
}

/**
 * Per-source glyphs (brief v4 "CSS status graphics") — dependency-free
 * inline SVG, 16x16, stroke 1.5, round caps (matches the cockpit icon set).
 */
const SOURCE_GLYPH_PATHS: Record<SourceCopy["id"], ReactNode> = {
  shopify: (
    <>
      <path d="M3.5 5.5h9l-1 8h-7l-1-8Z" />
      <path d="M6 5.5V4.5a2 2 0 0 1 4 0v1" />
    </>
  ),
  klaviyo: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </>
  ),
  meta: (
    <>
      <path d="M3 6.5v3l7 3.5v-10L3 6.5Z" />
      <path d="M12 6a3.5 3.5 0 0 1 0 4" />
    </>
  ),
  ga4: (
    <>
      <path d="M3 13V9" />
      <path d="M8 13V5" />
      <path d="M13 13V3" />
    </>
  ),
  stripe: (
    <>
      <rect x="2" y="4" width="12" height="8.5" rx="1.5" />
      <path d="M2 7h12" />
    </>
  ),
  square: (
    <>
      <path d="M3 6.5h10V13H3V6.5Z" />
      <path d="M2.5 6.5 4 3.5h8l1.5 3" />
    </>
  ),
  mailchimp: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </>
  ),
  gbp: (
    <>
      <path d="M8 13.5S3.5 9.6 3.5 6.5a4.5 4.5 0 0 1 9 0c0 3.1-4.5 7-4.5 7Z" />
      <circle cx="8" cy="6.5" r="1.5" />
    </>
  ),
};

/** Connector glyph tile — emerald-lit when the source is connected. */
function SourceGlyph({
  id,
  connected,
}: {
  id: SourceCopy["id"];
  connected: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        connected
          ? "ring-highlight flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-blue-50/60 text-emerald-700"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-soft/70 text-ink-soft"
      }
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SOURCE_GLYPH_PATHS[id]}
      </svg>
    </span>
  );
}

function ConnectorCard({
  copy,
  status,
  accountId,
}: {
  copy: SourceCopy;
  status: ConnectionStatusView | null;
  accountId: string;
}) {
  return (
    <Card as="section" interactive className="relative flex flex-col overflow-hidden">
      {/* Status rail (brief v4): emerald = connected + fresh, amber = stale,
          none when not connected. Paired with the text badge, never alone. */}
      {status ? (
        <span
          aria-hidden="true"
          className={
            status.isStale
              ? "absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-400/80 via-amber-300/40 to-transparent"
              : "absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500/80 via-emerald-400/40 to-transparent"
          }
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <SourceGlyph id={copy.id} connected={status !== null} />
          <h2 className="text-base font-semibold text-ink">{copy.name}</h2>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={TIER_TONE[copy.tier]}>{copy.tierLabel}</Badge>
          <StatusBadge status={status} />
        </div>
      </div>
      <p className="mt-1 text-sm leading-6 text-ink-secondary">{copy.description}</p>

      {status ? (
        <div className="mt-3 space-y-1 rounded-md border border-border bg-surface-soft/50 px-3 py-2 text-xs text-ink-muted">
          <p>
            Mode:{" "}
            <span className="font-medium text-ink-secondary">
              {status.mode === "mock" ? "mocked connector (alpha)" : status.mode}
            </span>
          </p>
          <p>
            Last sync:{" "}
            <span className="font-medium text-ink-secondary tabular-nums">
              {status.hoursSinceSync !== null
                ? `${status.hoursSinceSync}h ago (demo clock)`
                : "never"}
            </span>{" "}
            &middot; freshness threshold {status.freshnessThresholdHours}h
          </p>
          {status.lastSyncRecordsRead !== null ? (
            <p>
              Last run:{" "}
              <span className="font-medium text-ink-secondary tabular-nums">
                {status.lastSyncStatus ?? "unknown"} &middot;{" "}
                {status.lastSyncRecordsRead.toLocaleString("en-US")} records
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {copy.note ? (
        <p className="mt-3 text-xs leading-5 text-ink-soft">{copy.note}</p>
      ) : null}

      <div className="mt-auto pt-4">
        {status ? (
          <ResyncButton
            accountId={accountId}
            source={status.source}
            path="/connect"
            label={status.isStale ? "Re-sync now" : "Sync now"}
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-soft px-3 py-1.5 text-sm font-medium text-ink-soft shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]"
          >
            {/* Locked, not broken — padlock instead of a dead button. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="h-3 w-3 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
              <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
            </svg>
            Connect (unavailable in demo)
          </button>
        )}
      </div>
    </Card>
  );
}

export default async function ConnectDataSourcesPage() {
  const account = await ensureDemoAccount();
  const connections = await getConnectionStatus(account.accountId);
  const cards = orderConnectionsForVertical(account.vertical, connections);
  const requiredReady = cards
    .filter((card) => card.copy.tier === "required")
    .every((card) => card.status !== null);
  const isLocal = account.vertical === "local_service";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          Connect your data sources
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
          {isLocal
            ? "Square POS + Mailchimp are enough for your first opportunity. In the alpha, connectors are mocked and pre-connected to the demo dataset — no OAuth actually runs."
            : "Shopify + Klaviyo are enough for your first opportunity. In the alpha, connectors are mocked and pre-connected to the demo dataset — no OAuth actually runs."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ copy, status }) => (
          <ConnectorCard
            key={copy.id}
            copy={copy}
            status={status}
            accountId={account.accountId}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs leading-5 text-ink-soft">
          {isLocal
            ? "First value requires only Square POS + Mailchimp; Google Business Profile is recommended for local discovery but never blocks it. Local estimates cover identified (loyalty-matched) customers only."
            : "First value requires only Shopify + Klaviyo; GA4 is recommended but never blocks it (PRD 6.1, 8.2)."}
        </p>
        <Link
          href="/readiness"
          aria-disabled={!requiredReady}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:bg-primary-hover active:shadow-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Check data readiness
        </Link>
      </div>
    </div>
  );
}
