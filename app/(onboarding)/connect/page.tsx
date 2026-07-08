/**
 * app/(onboarding)/connect/page.tsx — Screen 5: Connect Data Sources
 * (PRD 7.1, 8.1-8.3). Demo connector cards, routed by the account's vertical
 * (trust rule #10): Shopify DTC shows Shopify + Klaviyo + Meta + GA4 + Stripe
 * exactly as before; LOCAL shows Square POS + Mailchimp + Google Business
 * Profile ("Recommended — local discovery") + Meta. All connectors are mocked
 * in the alpha (PRD 25.1).
 */

import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { createDemoAccount, getConnectionStatus } from "@/lib/server";

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

/** Small status dot rendered inside connection pills; decorative only. */
function StatusDot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${className}`}
    />
  );
}

function StatusBadge({ status }: { status: ConnectionStatusView | null }) {
  if (!status) return <Badge tone="neutral">Not connected</Badge>;
  if (status.isStale)
    return (
      <Badge tone="caution">
        <StatusDot className="bg-warning shadow-[0_0_0_3px_rgb(217_119_6/0.14)]" />
        Connected — stale
      </Badge>
    );
  return (
    <Badge tone="positive">
      <StatusDot className="bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]" />
      Connected
    </Badge>
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
    <Card as="section" interactive className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{copy.name}</h2>
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
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface-soft px-3 py-1.5 text-sm font-medium text-ink-soft"
          >
            Connect (unavailable in demo)
          </button>
        )}
      </div>
    </Card>
  );
}

export default async function ConnectDataSourcesPage() {
  const account = await createDemoAccount();
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
          className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover active:bg-primary-hover active:shadow-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Check data readiness
        </Link>
      </div>
    </div>
  );
}
