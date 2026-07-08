/**
 * app/(dashboard)/approvals/[actionId]/page.tsx — Campaign Draft Review
 * (PRD 7.4, screen 11).
 *
 * Shows everything PRD 7.4 requires: objective, audience, channel, draft
 * copy, sequence, timing, offer logic, suppression rules, holdout plan or
 * measurement label, Operating Rules version, claim warnings, and
 * approve / edit / reject (with the reason list). Draft-is-not-activation is
 * visually explicit; activation happens only through approveAction's
 * governance chokepoint.
 */

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOperatingRules,
  getOpportunityDetail,
  listOpportunities,
  type ActionSummaryView,
  type DraftView,
  type OpportunityDetailView,
} from "@/lib/server";
import {
  ActivationBadge,
  Badge,
  Card,
  ConfidenceBadge,
  MeasurementBadge,
  StatList,
  StatRow,
} from "@/components/ui/primitives";
import { getDemoAccountId } from "../../feed/_shared/account";
import {
  DraftNotActivationBanner,
  MeasurementPlanBlock,
} from "../../feed/_shared/explanation";
import { fmtDateTime, RECIPE_SHORT_NAMES } from "../../feed/_shared/format";
import { ReviewActions } from "./review-client";

export const dynamic = "force-dynamic";

const CHANNEL_BY_ACTION: Record<string, string> = {
  klaviyo_recovery_flow: "Klaviyo email",
  klaviyo_winback_flow: "Klaviyo email",
  meta_audience_sync: "Meta Ads audience sync (no budget changes in v0)",
};

/** Locate the opportunity that owns this action (searchParam fast path, scan fallback). */
async function resolveDetail(
  accountId: string,
  actionId: string,
  oppHint: string | undefined,
): Promise<{ detail: OpportunityDetailView; action: ActionSummaryView } | null> {
  const tryOne = async (opportunityId: string) => {
    try {
      const detail = await getOpportunityDetail({ accountId, opportunityId });
      const action = detail.actions.find((a) => a.actionId === actionId);
      return action ? { detail, action } : null;
    } catch {
      return null;
    }
  };
  if (oppHint) {
    const hit = await tryOne(oppHint);
    if (hit) return hit;
  }
  const feed = await listOpportunities(accountId);
  for (const card of [...feed.opportunities, ...feed.dismissed]) {
    const hit = await tryOne(card.id);
    if (hit) return hit;
  }
  return null;
}

/** PRD 12.6 / 7.4 — surface banned-claim hits in the draft copy for review. */
function scanClaims(
  copy: DraftView["copy"],
  bannedClaims: string[],
): Array<{ step: number; claim: string }> {
  const hits: Array<{ step: number; claim: string }> = [];
  for (const step of copy) {
    const text = `${step.subject ?? ""} ${step.previewText ?? ""} ${step.body}`.toLowerCase();
    for (const claim of bannedClaims) {
      if (claim && text.includes(claim.toLowerCase())) {
        hits.push({ step: step.step, claim });
      }
    }
  }
  return hits;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
        <span
          aria-hidden="true"
          className="h-3 w-0.5 shrink-0 rounded-full bg-accent/60"
        />
        {title}
      </h2>
      <div className="mt-2.5">{children}</div>
    </Card>
  );
}

export default async function DraftReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ actionId: string }>;
  searchParams: Promise<{ opp?: string }>;
}) {
  const [{ actionId }, { opp }] = await Promise.all([params, searchParams]);
  const accountId = await getDemoAccountId();

  const resolved = await resolveDetail(accountId, actionId, opp);
  if (!resolved) notFound();
  const { detail, action } = resolved;
  const { card } = detail;
  const rules = await getOperatingRules(accountId);

  const draft =
    detail.drafts
      .filter((d) => d.actionId === actionId)
      .sort((a, b) => b.currentVersion - a.currentVersion)[0] ?? null;
  if (!draft) notFound();

  const isMeta = action.type === "meta_audience_sync";
  const claimHits = scanClaims(draft.copy, rules.bannedClaims);
  const decidable = action.status !== "launched" && action.status !== "rejected";
  const plan = card.explanation.measurementPlan;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <nav className="flex gap-3 text-sm text-ink-muted">
        <Link
          href="/approvals"
          className="underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← Approval Center
        </Link>
        <Link
          href={`/opportunities/${card.id}`}
          className="underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
        >
          Opportunity detail
        </Link>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight text-ink">
            Campaign Draft Review
          </h1>
          <Badge tone={action.status === "launched" ? "positive" : "caution"}>
            {action.status === "launched" ? "activated" : `status: ${action.status}`}
          </Badge>
        </div>
        <p className="text-sm text-ink-muted">
          {RECIPE_SHORT_NAMES[card.recipeId]} · draft v{draft.currentVersion} ·
          created {fmtDateTime(draft.createdAt)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ConfidenceBadge level={card.confidence} />
          <MeasurementBadge mode={action.measurementMode} />
          {action.activationLevel ? (
            <ActivationBadge level={action.activationLevel} />
          ) : null}
        </div>
      </header>

      {action.status !== "launched" ? <DraftNotActivationBanner /> : null}

      <Section title="Objective">
        <p className="text-sm leading-relaxed text-ink-secondary">
          {card.title} — {card.explanation.whyItMatters}
        </p>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Audience & channel">
          <StatList>
            <StatRow label="Audience" value={detail.audience?.name ?? "—"} />
            <StatRow
              label="Size"
              value={
                action.audienceSize !== null
                  ? action.audienceSize.toLocaleString()
                  : detail.audience?.size.toLocaleString() ?? "—"
              }
            />
            <StatRow
              label="Channel"
              value={CHANNEL_BY_ACTION[action.type] ?? action.type}
            />
            <StatRow
              label="Operating Rules version"
              value={`v${action.constitutionVersion}${
                rules.version !== action.constitutionVersion
                  ? ` (current is v${rules.version})`
                  : ""
              }`}
            />
          </StatList>
        </Section>

        <Section title="Suppression rules">
          {detail.suppressionAudience ? (
            <p className="mb-2 text-sm leading-relaxed text-ink-secondary">
              <span className="font-medium text-ink">{detail.suppressionAudience.name}: </span>
              {detail.suppressionAudience.size.toLocaleString()} customers
              suppressed.
            </p>
          ) : null}
          {detail.exclusionsApplied.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-soft">
              {detail.exclusionsApplied.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No exclusions recorded.</p>
          )}
        </Section>
      </div>

      <Section title="Draft copy, sequence, timing & offer logic">
        <ol className="space-y-3">
          {draft.copy.map((step) => (
            <li
              key={step.step}
              className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs"
            >
              {/* Meta strip: step, channel, timing, offer logic */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-soft/60 px-4 py-2 text-xs text-ink-soft">
                <Badge tone="neutral">step {step.step}</Badge>
                <span className="font-medium text-ink-secondary">
                  {step.channel === "email" ? "Email" : "Meta audience"}
                </span>
                {typeof step.sendDelayHours === "number" ? (
                  <span>· sends {step.sendDelayHours}h after the previous step</span>
                ) : null}
                {typeof step.offerPercent === "number" ? (
                  <Badge tone="caution">
                    offer: {step.offerPercent}% (ceiling {rules.maxDiscountPercent}%)
                  </Badge>
                ) : (
                  <Badge tone="neutral">no discount in this step</Badge>
                )}
              </div>
              {/* Email-preview body */}
              <div className="px-4 py-3">
                {step.subject ? (
                  <p className="text-sm font-semibold tracking-tight text-ink">
                    {step.subject}
                  </p>
                ) : null}
                {step.previewText ? (
                  <p className="mt-0.5 text-xs text-ink-soft">{step.previewText}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-xs leading-5 text-ink-soft">
          Template-generated copy (no LLM in alpha). Offers never exceed the
          Operating Rules discount ceiling of {rules.maxDiscountPercent}%.
        </p>
      </Section>

      <Section title="Holdout plan / measurement label">
        <MeasurementPlanBlock plan={plan} />
      </Section>

      <Section title="Claim warnings">
        {claimHits.length > 0 ? (
          <ul className="space-y-1.5">
            {claimHits.map((h) => (
              <li
                key={`${h.step}:${h.claim}`}
                className="rounded-md border border-red-200 bg-danger-soft/50 px-3 py-2 text-sm leading-relaxed text-red-800"
              >
                Step {h.step} contains banned claim “{h.claim}” — edit the copy
                or it will be blocked at approval (PRD 12.6).
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink-muted">
            No banned claims detected in this draft (checked against Operating
            Rules v{rules.version}). Governance re-checks all copy at approval
            — non-overrideable claims block activation outright.
          </p>
        )}
        {isMeta ? (
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Meta drafts never use lift, incrementality, recovered-revenue,
            causal ROAS, or holdout language — reporting stays directional
            (PRD 15.4).
          </p>
        ) : null}
      </Section>

      <ReviewActions
        accountId={accountId}
        actionId={action.actionId}
        draftId={draft.draftId}
        copy={draft.copy}
        isMeta={isMeta}
        decidable={decidable}
        maxDiscountPercent={rules.maxDiscountPercent}
      />
    </main>
  );
}
