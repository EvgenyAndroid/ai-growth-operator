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
  ProofRail,
  SectionHeading,
  StatusDot,
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

/** Destination (channel) shown first on each queue row (brief §7). */
const DESTINATION_LABELS: Record<string, string> = {
  klaviyo_recovery_flow: "Klaviyo",
  klaviyo_winback_flow: "Klaviyo",
  meta_audience_sync: "Meta Ads",
};

function QueueRow({ item, pending }: { item: QueueItem; pending: boolean }) {
  const { action, card } = item;
  // Status rail (color + text status badges below — never color-only):
  // awaiting review = amber gradient, activated = emerald gradient, else slate.
  const rail = pending
    ? "bg-gradient-to-b from-amber-400 via-warning to-amber-600"
    : action.status === "launched"
      ? "bg-gradient-to-b from-emerald-400 via-success to-emerald-600"
      : "bg-slate-300";
  // Proof-rail position (brief v4 cockpit consistency): honest stage only —
  // "Measured" is never marked reached from this queue.
  const railStep =
    action.status === "launched" || action.status === "approved" ? 2 : 1;
  return (
    <Card
      as="li"
      className={
        "relative flex flex-wrap items-center justify-between gap-3 overflow-hidden py-4 " +
        "transition-[box-shadow] duration-150 ease-out hover:shadow-card-hover " +
        "hover:ring-1 hover:ring-accent/15" +
        (pending ? "" : " bg-surface-soft/40")
      }
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${rail}`} />
      <div className="min-w-0">
        <p className="font-semibold tracking-tight text-ink">{card.title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          <span className="font-medium text-ink-secondary">
            {DESTINATION_LABELS[action.type] ?? action.type}
          </span>{" "}
          · {RECIPE_SHORT_NAMES[card.recipeId]} ·{" "}
          {action.audienceSize !== null
            ? `${action.audienceSize.toLocaleString()} recipients`
            : "audience —"}{" "}
          · Operating Rules v{action.constitutionVersion}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            <span className="text-xs text-ink-soft">
              launched {fmtDateTime(action.launchedAt)}
            </span>
          ) : null}
        </div>
        {/* Tiny proof rail — where this action sits in the loop (brief v4). */}
        <ProofRail className="mt-2" active={railStep} />
      </div>
      <Link
        href={`/approvals/${action.actionId}?opp=${card.id}`}
        className={
          pending
            ? "inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:translate-y-px active:shadow-none"
            : "inline-flex items-center rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary shadow-xs transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
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
    <main className="mx-auto w-full max-w-4xl space-y-5">
      <nav className="text-sm text-ink-muted">
        <Link
          href="/feed"
          className="underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← Back to feed
        </Link>
      </nav>
      <SectionHeading
        title="Approval Center"
        subtitle="Every customer-facing send, audience sync, or suppression change needs your explicit approval here."
      />
      <DraftNotActivationBanner />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
          Pending your review ({pending.length})
          {pending.length > 0 ? <StatusDot tone="warning" pulse /> : null}
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
              className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-primary-hover active:shadow-none"
            >
              Go to feed
            </Link>
          </EmptyState>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
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
