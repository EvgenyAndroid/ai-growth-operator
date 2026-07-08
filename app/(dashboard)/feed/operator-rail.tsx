/**
 * app/(dashboard)/feed/operator-rail.tsx — PRESENTATIONAL "Operator status"
 * right rail for the Opportunity Feed (brief v4: the feed is the visual hero
 * and goes two-column on desktop). Render-only: everything shown here is
 * derived from the FeedView the page already fetched — this component does
 * no data fetching of its own and takes no function props (server-safe).
 */

import type * as React from "react";
import Link from "next/link";
import type { FeedView, OpportunityCardView } from "@/lib/server";
import {
  MeasurementLegend,
  PremiumCallout,
  ProofRail,
  StatusDot,
} from "@/components/ui/primitives";
import { fmtDateTime } from "./_shared/format";

interface SourceRow {
  source: string;
  lastSyncAt: string;
  isStale: boolean;
}

/**
 * Collapse the per-card freshness entries (real Integration data already on
 * the page) into one row per source, keeping the most recent sync.
 */
function deriveSources(cards: OpportunityCardView[]): SourceRow[] {
  const bySource = new Map<string, SourceRow>();
  for (const card of cards) {
    for (const f of card.explanation.dataFreshness) {
      const prev = bySource.get(f.source);
      if (!prev || f.lastSyncAt > prev.lastSyncAt) {
        bySource.set(f.source, {
          source: f.source,
          lastSyncAt: f.lastSyncAt,
          isStale: f.isStale,
        });
      }
    }
  }
  return [...bySource.values()].sort((a, b) =>
    a.source.localeCompare(b.source),
  );
}

/** Hairline-separated rail section with a small uppercase label. */
function RailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200/70 pt-3 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export function OperatorStatusRail({
  feed,
  className,
}: {
  feed: FeedView;
  className?: string;
}) {
  const sources = deriveSources([...feed.opportunities, ...feed.dismissed]);
  const top = feed.opportunities[0] ?? null;
  const nextManual = feed.noOpportunity[0]?.nearestNextAction ?? null;
  // Directional Meta present anywhere on this feed (card or excluded item).
  const hasDirectionalMeta =
    feed.opportunities.some((c) => c.measurementMode === "directional") ||
    feed.foundMoney.excluded.some(
      (x) => x.recipeId === "meta_seed_suppression",
    );

  return (
    <aside aria-label="Operator status" className={className}>
      <div className="proof-card space-y-3.5 rounded-card p-4">
        {/* Scan status */}
        <section>
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <StatusDot tone="proof" pulse />
            Operator status
          </h2>
          <p className="mt-1.5 text-sm font-medium text-ink">Scan complete</p>
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
            Last run {fmtDateTime(feed.generatedAt)}
            {feed.demoMode ? " · demo dataset" : null}
          </p>
          <ProofRail className="mt-2" active={0} />
        </section>

        {/* Source freshness — derived from data already on the page */}
        {sources.length > 0 ? (
          <RailSection label="Source freshness">
            <ul className="space-y-1.5">
              {sources.map((s) => (
                <li
                  key={s.source}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                >
                  <StatusDot tone={s.isStale ? "warning" : "money"} />
                  <span className="font-medium capitalize text-ink-secondary">
                    {s.source}
                  </span>
                  <span
                    className={
                      s.isStale
                        ? "font-medium text-amber-800"
                        : "text-emerald-700"
                    }
                  >
                    {s.isStale ? "stale" : "fresh"}
                  </span>
                  <span className="text-ink-soft">
                    synced {fmtDateTime(s.lastSyncAt)}
                  </span>
                </li>
              ))}
            </ul>
          </RailSection>
        ) : null}

        {/* Meta trust note — directional is platform-reported, never money */}
        {hasDirectionalMeta ? (
          <RailSection label="Meta reporting">
            <PremiumCallout tone="neutral">
              Meta stays directional in v0 — platform-reported, non-causal
              numbers that are never counted in Found money.
            </PremiumCallout>
          </RailSection>
        ) : null}

        {/* Proof mode */}
        <RailSection label="Measurement key">
          <MeasurementLegend />
          <p className="mt-2 text-[11px] leading-4 text-ink-soft">
            Holdout-verified where controlled. Directional where not.
          </p>
        </RailSection>

        {/* Next best action pointer */}
        <RailSection label="Next best action">
          {top ? (
            <PremiumCallout tone="proof">
              <span className="font-medium text-ink">{top.title}</span>
              <Link
                href={`/opportunities/${top.id}`}
                className="mt-1 block font-medium text-accent underline-offset-2 transition-colors duration-150 hover:text-accent-hover hover:underline"
              >
                Review &amp; draft →
              </Link>
            </PremiumCallout>
          ) : nextManual ? (
            <PremiumCallout tone="neutral">{nextManual}</PremiumCallout>
          ) : (
            <PremiumCallout tone="neutral">
              Nothing pending — the next scheduled scan will refresh this feed.
            </PremiumCallout>
          )}
        </RailSection>
      </div>
    </aside>
  );
}
