/**
 * app/(dashboard)/approvals/page.tsx — Approval Center (PRD 7.1 screen 12).
 *
 * One approval queue (PRD Section 27: one Operator, one feed, one approval
 * queue). Pending drafts await explicit human approval; nothing activates
 * without it (26A.4). Decided items are listed below for context.
 */

import Link from "next/link";
import {
  getOpportunityDetail,
  listOpportunities,
  type ActionSummaryView,
} from "@/lib/server";
import {
  ActivationBadge,
  Badge,
  Card,
  ConfidenceBadge,
  EmptyState,
  MeasurementBadge,
  SectionHeading,
} from "@/components/ui/primitives";
import { getDemoAccountId } from "../feed/_shared/account";
import { DraftNotActivationBanner } from "../feed/_shared/explanation";
import { fmtDateTime, RECIPE_SHORT_NAMES } from "../feed/_shared/format";
import type { OpportunityCardView } from "@/lib/server";

export const dynamic = "force-dynamic";

interface QueueItem {
  action: ActionSummaryView;
  card: OpportunityCardView;
}

function QueueRow({ item, pending }: { item: QueueItem; pending: boolean }) {
  const { action, card } = item;
  return (
    <Card as="li" className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-stone-900">{card.title}</p>
        <p className="mt-0.5 text-sm text-stone-500">
          {RECIPE_SHORT_NAMES[card.recipeId]} · {action.type} ·{" "}
          {action.audienceSize !== null
            ? `${action.audienceSize.toLocaleString()} recipients`
            : "audience —"}{" "}
          · Operating Rules v{action.constitutionVersion}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <ConfidenceBadge level={card.confidence} />
          <MeasurementBadge mode={action.measurementMode} />
          {action.activationLevel ? (
            <ActivationBadge level={action.activationLevel} />
          ) : null}
          <Badge tone={action.status === "launched" ? "positive" : "neutral"}>
            {action.status}
          </Badge>
          {action.approvalStatus ? (
            <Badge tone={action.approvalStatus === "pending" ? "caution" : "neutral"}>
              approval: {action.approvalStatus}
            </Badge>
          ) : null}
          {action.launchedAt ? (
            <span className="text-xs text-stone-500">
              launched {fmtDateTime(action.launchedAt)}
            </span>
          ) : null}
        </div>
      </div>
      <Link
        href={`/approvals/${action.actionId}?opp=${card.id}`}
        className={
          pending
            ? "inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
            : "text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
        }
      >
        {pending ? "Review draft" : "View"}
      </Link>
    </Card>
  );
}

export default async function ApprovalCenterPage() {
  const accountId = await getDemoAccountId();
  const feed = await listOpportunities(accountId);
  const cards = [...feed.opportunities, ...feed.dismissed];
  const details = await Promise.all(
    cards.map((card) =>
      getOpportunityDetail({ accountId, opportunityId: card.id }),
    ),
  );

  const pending: QueueItem[] = [];
  const decided: QueueItem[] = [];
  for (const detail of details) {
    for (const action of detail.actions) {
      const item: QueueItem = { action, card: detail.card };
      if (action.approvalStatus === "pending") pending.push(item);
      else decided.push(item);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      <nav className="text-sm text-stone-500">
        <Link href="/feed" className="underline underline-offset-2 hover:text-stone-800">
          ← Back to feed
        </Link>
      </nav>
      <SectionHeading
        title="Approval Center"
        subtitle="Every customer-facing send, audience sync, or suppression change needs your explicit approval here."
      />
      <DraftNotActivationBanner />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Pending your review ({pending.length})
        </h2>
        {pending.length > 0 ? (
          <ul className="space-y-3">
            {pending.map((item) => (
              <QueueRow key={item.action.actionId} item={item} pending />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nothing waiting for approval"
            description="Draft an action from an opportunity in the feed and it will appear here for review."
          >
            <Link
              href="/feed"
              className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
            >
              Go to feed
            </Link>
          </EmptyState>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Decided ({decided.length})
          </h2>
          <ul className="space-y-3">
            {decided.map((item) => (
              <QueueRow key={item.action.actionId} item={item} pending={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
