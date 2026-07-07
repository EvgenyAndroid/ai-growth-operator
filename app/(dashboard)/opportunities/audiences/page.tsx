/**
 * app/(dashboard)/opportunities/audiences/page.tsx — Audience Builder
 * (PRD 7.1 screen 10). Alpha scope: READ-ONLY display of the rules and live
 * sizes of the three recipe-defined audiences. No custom audience creation
 * in v0 (PRD 5.2).
 */

import Link from "next/link";
import {
  getOpportunityDetail,
  listOpportunities,
  type OpportunityDetailView,
} from "@/lib/server";
import {
  Badge,
  Card,
  EmptyState,
  SectionHeading,
  StatList,
  StatRow,
} from "@/components/ui/primitives";
import { getDemoAccountId } from "../../feed/_shared/account";
import {
  fmtDateTime,
  RECIPE_INCLUSION_RULES,
  RECIPE_SHORT_NAMES,
} from "../../feed/_shared/format";

export const dynamic = "force-dynamic";

function AudienceCard({ detail }: { detail: OpportunityDetailView }) {
  const { card } = detail;
  return (
    <Card as="article" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">
          {RECIPE_SHORT_NAMES[card.recipeId]}
        </h2>
        <Badge tone="neutral">read-only in alpha</Badge>
      </div>

      <StatList>
        <StatRow label="Audience" value={detail.audience?.name ?? "—"} />
        <StatRow
          label="Size (after consent, suppression, exclusions)"
          value={detail.audience ? detail.audience.size.toLocaleString() : "—"}
        />
        <StatRow
          label="Eligible channels"
          value={detail.audience?.eligibleChannels.join(", ") ?? "—"}
        />
        {detail.suppressionAudience ? (
          <StatRow
            label={`Suppression audience: ${detail.suppressionAudience.name}`}
            value={detail.suppressionAudience.size.toLocaleString()}
          />
        ) : null}
        <StatRow label="Data as of" value={fmtDateTime(card.dataAsOf)} />
      </StatList>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Inclusion rules
        </h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
          {RECIPE_INCLUSION_RULES[card.recipeId].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Exclusions applied
        </h3>
        {detail.exclusionsApplied.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-stone-700">
            {detail.exclusionsApplied.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-stone-600">None.</p>
        )}
      </div>

      <div className="border-t border-stone-100 pt-2">
        <Link
          href={`/opportunities/${card.id}`}
          className="text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
        >
          View opportunity detail →
        </Link>
      </div>
    </Card>
  );
}

export default async function AudienceBuilderPage() {
  const accountId = await getDemoAccountId();
  const feed = await listOpportunities(accountId);
  const cards = [...feed.opportunities, ...feed.dismissed];
  const details = await Promise.all(
    cards.map((card) =>
      getOpportunityDetail({ accountId, opportunityId: card.id }),
    ),
  );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      <nav className="text-sm text-stone-500">
        <Link href="/feed" className="underline underline-offset-2 hover:text-stone-800">
          ← Back to feed
        </Link>
      </nav>
      <SectionHeading
        title="Audience Builder"
        subtitle="Alpha is read-only: the three v0 recipes define these audiences deterministically. Sizes reflect consent, suppression, and exclusion filtering."
      />
      {details.length > 0 ? (
        <div className="space-y-4">
          {details.map((d) => (
            <AudienceCard key={d.card.id} detail={d} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No recipe audiences yet"
          description="No recipe currently finds a qualifying audience. Check the feed for what was checked and why nothing qualified."
        />
      )}
    </main>
  );
}
