/**
 * app/(dashboard)/feed/page.tsx — Opportunity Feed (PRD 7.2, screen 7).
 *
 * Feed-first, not dashboard-first (PRD 4.1): found-money header (PRD 16.2,
 * eligible items only, net-of-existing-automation framing per 26B.11), a
 * maximum of 5 active cards, dismissed-in-cooldown section, and the 26A.10
 * "what was checked" empty state per recipe that found nothing.
 *
 * Vertical-aware (trust rule #10): copy comes from the vertical registry
 * (the DTC strings mirror the pre-vertical UI exactly), and LOCAL accounts
 * render the POS coverage disclosure under the found-money header and on
 * every card (trust rule #9).
 */

import Link from "next/link";
import type { FeedView } from "@/lib/server";
import { listOpportunities } from "@/lib/server";
import { getVerticalDefinition } from "@/lib/server/vertical";
import { Badge, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { getDemoAccountId } from "./_shared/account";
import { fmtDateTime, fmtRange, RECIPE_SHORT_NAMES } from "./_shared/format";
import { OpportunityCard } from "./opportunity-card";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_CARDS = 5; // PRD 7.2 — maximum of ~5 active cards

function FoundMoneyHeader({
  header,
  label,
  coverage,
}: {
  header: FeedView["foundMoney"];
  label: string;
  coverage: FeedView["coverage"];
}) {
  // PRD 16.2 — render the header ONLY when at least one eligible
  // (recovery/win-back, Medium/High confidence, real range) item exists.
  if (!header.show) return null;
  return (
    <section
      aria-label="Found money"
      className="relative overflow-hidden rounded-card border border-border bg-surface px-6 py-5 shadow-card"
    >
      {/* Refined accent treatment: thin success keyline, no loud fills. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-success"
      />
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
        />
        {label}
      </p>
      <p className="mt-2 text-[2rem] font-bold leading-none tracking-tight text-ink tabular-nums">
        {fmtRange(header.totalLow, header.totalHigh)}
      </p>
      {header.headline ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          {header.headline}
        </p>
      ) : null}
      {coverage ? (
        // LOCAL trust rule #9 — POS coverage disclosure on the header.
        <p className="mt-1 text-sm font-medium text-ink-secondary">
          Estimates cover identified loyalty customers —{" "}
          {Math.round(coverage.identifiedShare * 100)}% of transactions.
        </p>
      ) : null}
      {header.excluded.length > 0 ? (
        <details className="mt-3 border-t border-border pt-2.5">
          <summary className="cursor-pointer text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
            Not counted in this total ({header.excluded.length})
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs leading-5 text-ink-muted">
            {header.excluded.map((x) => (
              <li key={`${x.recipeId}:${x.reason}`}>
                {RECIPE_SHORT_NAMES[x.recipeId]}: {x.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function NoOpportunityCards({
  items,
  title,
  subtitle,
}: {
  items: FeedView["noOpportunity"];
  title: string;
  subtitle: string;
}) {
  // 26A.10 — explain what was checked, why nothing qualified, the nearest
  // next action, and what connection/data would unlock more.
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeading title={title} subtitle={subtitle} />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <EmptyState
            key={item.recipeId}
            title={RECIPE_SHORT_NAMES[item.recipeId]}
            className="text-left [&>h3]:text-left"
          >
            <div className="space-y-2 text-left text-sm leading-relaxed text-ink-secondary">
              <div>
                <span className="font-medium text-ink">Checked: </span>
                {item.checked
                  .map((c) => `${c.count.toLocaleString()} ${c.what}`)
                  .join(" · ")}
              </div>
              <div>
                <span className="font-medium text-ink">
                  Why nothing qualified:{" "}
                </span>
                {item.whyNotQualified}
              </div>
              <div>
                <span className="font-medium text-ink">
                  Next best manual action:{" "}
                </span>
                {item.nearestNextAction}
              </div>
              <div>
                <span className="font-medium text-ink">
                  What would unlock more:{" "}
                </span>
                {item.unlocks}
              </div>
            </div>
          </EmptyState>
        ))}
      </div>
    </section>
  );
}

export default async function FeedPage() {
  const accountId = await getDemoAccountId();
  const feed = await listOpportunities(accountId);
  const active = feed.opportunities.slice(0, MAX_ACTIVE_CARDS);
  // Vertical registry copy — the DTC entry mirrors the pre-vertical strings.
  const copy = getVerticalDefinition(feed.vertical).feedCopy;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink">
            {copy.feedTitle}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Generated {fmtDateTime(feed.generatedAt)}
            {feed.demoMode ? " · demo dataset" : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {feed.demoMode ? <Badge tone="info">Demo mode</Badge> : null}
          <Link
            href="/opportunities/audiences"
            className="inline-flex items-center whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary shadow-sm transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
          >
            Audience Builder
          </Link>
          <Link
            href="/approvals"
            className="inline-flex items-center whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary shadow-sm transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
          >
            Approval Center
          </Link>
        </div>
      </header>

      <FoundMoneyHeader
        header={feed.foundMoney}
        label={copy.foundMoneyLabel}
        coverage={feed.coverage}
      />

      {active.length > 0 ? (
        <section className="space-y-4" aria-label="Active opportunities">
          {active.map((card, i) => (
            <OpportunityCard
              key={card.id}
              accountId={accountId}
              card={card}
              priority={i === 0}
            />
          ))}
        </section>
      ) : feed.noOpportunity.length === 0 ? (
        <EmptyState
          title={copy.emptyFeedTitle}
          description={copy.emptyFeedDescription}
        />
      ) : null}

      <NoOpportunityCards
        items={feed.noOpportunity}
        title={copy.noOpportunityTitle}
        subtitle={copy.noOpportunitySubtitle}
      />

      {feed.dismissed.length > 0 ? (
        <section className="space-y-2">
          <SectionHeading
            title="Dismissed — in cooldown"
            subtitle="Re-detection is paused for these until their cooldown ends."
          />
          <ul className="space-y-2">
            {feed.dismissed.map((card) => (
              <li
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-soft/60 px-4 py-2.5 text-sm text-ink-muted"
              >
                <span>
                  <span className="font-medium text-ink-secondary">{card.title}</span>
                  {card.dismissedReason ? ` — “${card.dismissedReason}”` : null}
                </span>
                <span className="text-xs text-ink-soft tabular-nums">
                  cooldown until{" "}
                  {card.cooldownUntil ? fmtDateTime(card.cooldownUntil) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
