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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
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
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
      <nav className="flex gap-3 text-sm text-stone-500">
        <Link href="/approvals" className="underline underline-offset-2 hover:text-stone-800">
          ← Approval Center
        </Link>
        <Link
          href={`/opportunities/${card.id}`}
          className="underline underline-offset-2 hover:text-stone-800"
        >
          Opportunity detail
        </Link>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Campaign Draft Review
          </h1>
          <Badge tone={action.status === "launched" ? "positive" : "caution"}>
            {action.status === "launched" ? "activated" : `status: ${action.status}`}
          </Badge>
        </div>
        <p className="text-sm text-stone-500">
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
        <p className="text-sm text-stone-700">
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
            <p className="mb-2 text-sm text-stone-700">
              <span className="font-medium">{detail.suppressionAudience.name}: </span>
              {detail.suppressionAudience.size.toLocaleString()} customers
              suppressed.
            </p>
          ) : null}
          {detail.exclusionsApplied.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-stone-700">
              {detail.exclusionsApplied.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">No exclusions recorded.</p>
          )}
        </Section>
      </div>

      <Section title="Draft copy, sequence, timing & offer logic">
        <ol className="space-y-3">
          {draft.copy.map((step) => (
            <li
              key={step.step}
              className="rounded-md border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <Badge tone="neutral">step {step.step}</Badge>
                <span>{step.channel === "email" ? "Email" : "Meta audience"}</span>
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
              {step.subject ? (
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {step.subject}
                </p>
              ) : null}
              {step.previewText ? (
                <p className="text-xs text-stone-500">{step.previewText}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-stone-500">
          Template-generated copy (no LLM in alpha). Offers never exceed the
          Operating Rules discount ceiling of {rules.maxDiscountPercent}%.
        </p>
      </Section>

      <Section title="Holdout plan / measurement label">
        <MeasurementPlanBlock plan={plan} />
      </Section>

      <Section title="Claim warnings">
        {claimHits.length > 0 ? (
          <ul className="space-y-1">
            {claimHits.map((h) => (
              <li key={`${h.step}:${h.claim}`} className="text-sm text-rose-700">
                Step {h.step} contains banned claim “{h.claim}” — edit the copy
                or it will be blocked at approval (PRD 12.6).
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">
            No banned claims detected in this draft (checked against Operating
            Rules v{rules.version}). Governance re-checks all copy at approval
            — non-overrideable claims block activation outright.
          </p>
        )}
        {isMeta ? (
          <p className="mt-2 text-sm text-amber-800">
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
