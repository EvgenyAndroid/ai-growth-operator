/**
 * app/(dashboard)/feed/page.tsx — Opportunity Feed (PRD 7.2, screen 7).
 *
 * Feed-first, not dashboard-first (PRD 4.1): found-money header (PRD 16.2,
 * eligible items only, net-of-existing-automation framing per 26B.11), a
 * maximum of 5 active cards, dismissed-in-cooldown section, and the 26A.10
 * "what was checked" empty state per recipe that found nothing.
 */

import Link from "next/link";
import type { FeedView } from "@/lib/server";
import { listOpportunities } from "@/lib/server";
import { Badge, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { getDemoAccountId } from "./_shared/account";
import { fmtDateTime, fmtRange, RECIPE_SHORT_NAMES } from "./_shared/format";
import { OpportunityCard } from "./opportunity-card";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_CARDS = 5; // PRD 7.2 — maximum of ~5 active cards

function FoundMoneyHeader({ header }: { header: FeedView["foundMoney"] }) {
  // PRD 16.2 — render the header ONLY when at least one eligible
  // (recovery/win-back, Medium/High confidence, real range) item exists.
  if (!header.show) return null;
  return (
    <section
      aria-label="Found money"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Found money
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-900">
        {fmtRange(header.totalLow, header.totalHigh)}
      </p>
      {header.headline ? (
        <p className="mt-1 text-sm text-emerald-800">{header.headline}</p>
      ) : null}
      {header.excluded.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-emerald-700">
            Not counted in this total ({header.excluded.length})
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-emerald-800">
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

function NoOpportunityCards({ items }: { items: FeedView["noOpportunity"] }) {
  // 26A.10 — explain what was checked, why nothing qualified, the nearest
  // next action, and what connection/data would unlock more.
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Nothing qualified here — and here is exactly what was checked"
        subtitle="The Operator explains empty results instead of hiding them."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <EmptyState
            key={item.recipeId}
            title={RECIPE_SHORT_NAMES[item.recipeId]}
            className="text-left [&>h3]:text-left"
          >
            <div className="space-y-2 text-left text-sm text-stone-600">
              <div>
                <span className="font-medium text-stone-800">Checked: </span>
                {item.checked
                  .map((c) => `${c.count.toLocaleString()} ${c.what}`)
                  .join(" · ")}
              </div>
              <div>
                <span className="font-medium text-stone-800">
                  Why nothing qualified:{" "}
                </span>
                {item.whyNotQualified}
              </div>
              <div>
                <span className="font-medium text-stone-800">
                  Next best manual action:{" "}
                </span>
                {item.nearestNextAction}
              </div>
              <div>
                <span className="font-medium text-stone-800">
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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Opportunity Feed
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Generated {fmtDateTime(feed.generatedAt)}
            {feed.demoMode ? " · demo dataset" : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {feed.demoMode ? <Badge tone="info">Demo mode</Badge> : null}
          <Link
            href="/opportunities/audiences"
            className="text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
          >
            Audience Builder
          </Link>
          <Link
            href="/approvals"
            className="text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
          >
            Approval Center
          </Link>
        </div>
      </header>

      <FoundMoneyHeader header={feed.foundMoney} />

      {active.length > 0 ? (
        <section className="space-y-4" aria-label="Active opportunities">
          {active.map((card) => (
            <OpportunityCard key={card.id} accountId={accountId} card={card} />
          ))}
        </section>
      ) : feed.noOpportunity.length === 0 ? (
        <EmptyState
          title="No active opportunities"
          description="Every recipe ran and nothing is currently active. Check the dismissed section below or re-sync your data sources."
        />
      ) : null}

      <NoOpportunityCards items={feed.noOpportunity} />

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
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-600"
              >
                <span>
                  <span className="font-medium text-stone-800">{card.title}</span>
                  {card.dismissedReason ? ` — “${card.dismissedReason}”` : null}
                </span>
                <span className="text-xs text-stone-500">
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
