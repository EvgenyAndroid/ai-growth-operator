/**
 * app/(onboarding)/readiness/page.tsx — Screen 6: Data Readiness (PRD 7.1,
 * 8.4-8.5, 26B.15). Per-source sync status and freshness against thresholds,
 * what each source unlocks, and the handoff into the Opportunity Feed.
 * Vertical-aware (trust rule #10): required sources are the vertical's
 * required-tier connectors (Shopify+Klaviyo for DTC, Square POS+Mailchimp for
 * LOCAL), and LOCAL adds the POS coverage disclosure (trust rule #9).
 */

import Link from "next/link";
import {
  Badge,
  Card,
  StatList,
  StatRow,
  StatusDot,
} from "@/components/ui/primitives";
import { createDemoAccount, getConnectionStatus } from "@/lib/server";

// Freshness must reflect the live DB — never prerender at build time.
export const dynamic = "force-dynamic";
import { ResyncButton } from "../resync-button";
import { orderConnectionsForVertical } from "../source-copy";
import type { ConnectionStatusView } from "@/lib/server";

function freshnessValue(status: ConnectionStatusView): string {
  if (status.hoursSinceSync === null) return "never synced";
  return `${status.hoursSinceSync}h ago (threshold ${status.freshnessThresholdHours}h)`;
}

export default async function DataReadinessPage() {
  const account = await createDemoAccount();
  const connections = await getConnectionStatus(account.accountId);
  const cards = orderConnectionsForVertical(account.vertical, connections);
  const isLocal = account.vertical === "local_service";

  // Required sources come from the vertical's required-tier connectors. For
  // DTC this is exactly the pre-vertical Shopify + Klaviyo check.
  const requiredCards = cards.filter((card) => card.copy.tier === "required");
  const ready =
    requiredCards.length > 0 &&
    requiredCards.every((card) => card.status !== null && !card.status.isStale);
  const requiredNames = requiredCards
    .map((card) => card.copy.name)
    .join(" and ");
  // Readiness dial fraction (brief v4 CSS status graphic): required sources
  // that are synced AND fresh, out of all required sources.
  const freshRequired = requiredCards.filter(
    (card) => card.status !== null && !card.status.isStale,
  ).length;
  const readinessPct =
    requiredCards.length > 0 ? (freshRequired / requiredCards.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          Data readiness
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
          Every opportunity shows a data-as-of timestamp, and launches are
          blocked when required source data is stale (PRD 8.5). Here is where
          each source stands.
        </p>
      </div>

      <Card
        as="section"
        className={
          ready
            ? "relative overflow-hidden border-emerald-200 bg-success-soft/40! shadow-[0_18px_48px_-18px_var(--glow-money)]"
            : "relative overflow-hidden border-amber-200 bg-warning-soft/40! shadow-[0_18px_48px_-18px_var(--glow-warning)]"
        }
      >
        {/* Status rail — paired with the heading text, never color-alone. */}
        <span
          aria-hidden="true"
          className={
            ready
              ? "absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500/80 via-emerald-400/40 to-transparent"
              : "absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-400/80 via-amber-300/40 to-transparent"
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            {/* CSS readiness dial: conic ring of required sources that are
                synced + fresh. Decorative — the heading carries the status. */}
            <span
              aria-hidden="true"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full shadow-[0_1px_2px_rgb(15_23_42/0.08)]"
              style={{
                background: `conic-gradient(${
                  ready ? "var(--color-success)" : "var(--color-warning)"
                } ${readinessPct}%, var(--color-border) 0)`,
              }}
            >
              <span
                className={
                  ready
                    ? "grid h-11 w-11 place-items-center rounded-full bg-surface text-xs font-semibold text-emerald-800 tabular-nums"
                    : "grid h-11 w-11 place-items-center rounded-full bg-surface text-xs font-semibold text-amber-800 tabular-nums"
                }
              >
                {freshRequired}/{requiredCards.length}
              </span>
            </span>
            <div className="min-w-0">
            <h2
              className={
                ready
                  ? "text-base font-semibold text-emerald-900"
                  : "text-base font-semibold text-amber-900"
              }
            >
              {ready
                ? "Ready for your first opportunity"
                : "Almost there — a required source needs a sync"}
            </h2>
            <p
              className={
                ready
                  ? "mt-0.5 text-sm text-emerald-800"
                  : "mt-0.5 text-sm text-amber-800"
              }
            >
              {ready
                ? `${requiredNames} are synced and within freshness thresholds. The Operator can rank opportunities now.`
                : `${requiredNames} must be synced and fresh before the Operator ranks opportunities. Re-sync below.`}
            </p>
            </div>
          </div>
          {ready ? (
            <Link
              href="/feed"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:bg-primary-hover active:shadow-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Go to your Opportunity Feed
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3">
        {cards.map(({ copy, status }) => (
          <Card as="section" key={copy.id} interactive>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink">
                    {copy.name}
                  </h2>
                  {!status ? (
                    <Badge tone="neutral">Not connected</Badge>
                  ) : status.isStale ? (
                    <Badge tone="caution">
                      <StatusDot tone="warning" />
                      Stale — re-sync recommended
                    </Badge>
                  ) : (
                    <Badge tone="positive">
                      <StatusDot tone="money" pulse />
                      Fresh
                    </Badge>
                  )}
                  {copy.tier === "recommended" ? (
                    <Badge tone="info">Recommended — not required</Badge>
                  ) : null}
                  {copy.tier === "optional" ? (
                    <Badge tone="neutral">Optional</Badge>
                  ) : null}
                </div>
                {status ? (
                  <StatList className="mt-2 max-w-md">
                    <StatRow label="Sync status" value={status.lastSyncStatus ?? "unknown"} />
                    <StatRow label="Freshness" value={freshnessValue(status)} />
                    <StatRow
                      label="Records read (last run)"
                      value={
                        status.lastSyncRecordsRead !== null
                          ? status.lastSyncRecordsRead.toLocaleString("en-US")
                          : "—"
                      }
                    />
                  </StatList>
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">{copy.note}</p>
                )}
              </div>
              <div className="ring-highlight w-full rounded-lg border border-border bg-surface-soft/50 p-3 sm:w-64">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  What it unlocks
                </p>
                <ul className="mt-1.5 space-y-1 text-sm leading-6 text-ink-secondary">
                  {copy.unlocks.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="text-ink-soft">
                        &bull;
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                {status ? (
                  <div className="mt-3">
                    <ResyncButton
                      accountId={account.accountId}
                      source={status.source}
                      path="/readiness"
                      label={status.isStale ? "Re-sync now" : "Sync now"}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isLocal ? (
        <Card as="section" variant="flat" className="bg-surface-soft/60">
          <h2 className="text-sm font-semibold text-ink">
            How local numbers are counted
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Local estimates cover identified (loyalty-matched) customers only —
            every opportunity card and readout states the share of POS
            transactions that are identified. Unidentified walk-in sales are
            never included in an estimate.
          </p>
        </Card>
      ) : null}

      <Card as="section" variant="flat" className="bg-surface-soft/60">
        <h2 className="text-sm font-semibold text-ink">
          How the first sync works
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          {isLocal
            ? "The last 90 days of POS tickets, loyalty matches, and email profiles sync first and power your first opportunity; deeper history backfills in the background, and estimates re-verify when the backfill completes."
            : "The last 90 days of orders, checkouts, and profiles sync first and power your first opportunity; deeper history backfills in the background, and estimates re-verify when the backfill completes."}{" "}
          The demo workspace runs on a fixed reference date of{" "}
          {new Date(account.referenceDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          , so freshness is measured on the demo clock.
        </p>
      </Card>

      <div className="flex justify-end">
        <Link
          href="/feed"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:bg-primary-hover active:shadow-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Go to your Opportunity Feed
        </Link>
      </div>
    </div>
  );
}
