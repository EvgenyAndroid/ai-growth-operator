/**
 * app/(dashboard)/opportunities/[id]/page.tsx — Opportunity Detail (PRD 7.3,
 * screen 8).
 *
 * Shows the full PRD 7.3 list: source signal, recipe version, audience size,
 * inclusion rules, exclusion rules, estimate formula, estimate confidence,
 * data freshness, proposed action, proposed channel, measurement plan,
 * Operating Rules version, risks, unsupported-claim warnings, and the CTA to
 * draft the action (draft is not activation, 26A.4).
 */

import type * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOperatingRules,
  getOpportunityDetail,
  type OpportunityDetailView,
} from "@/lib/server";
import {
  ActivationBadge,
  Badge,
  Card,
  ConfidenceBadge,
  SectionHeading,
  StatList,
  StatRow,
} from "@/components/ui/primitives";
import { getDemoAccountId } from "../../feed/_shared/account";
import {
  EstimateValue,
  FreshnessList,
  MeasurementPlanBlock,
  DraftNotActivationBanner,
} from "../../feed/_shared/explanation";
import {
  fmtDateTime,
  RECIPE_ESTIMATE_FORMULAS,
  RECIPE_INCLUSION_RULES,
} from "../../feed/_shared/format";
import { DraftCta } from "./draft-cta";

export const dynamic = "force-dynamic";

const CHANNEL_BY_ACTION: Record<string, string> = {
  klaviyo_recovery_flow: "Klaviyo email",
  klaviyo_winback_flow: "Klaviyo email",
  meta_audience_sync: "Meta Ads (audience sync only — no budget changes in v0)",
};

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

function ExistingWork({ detail }: { detail: OpportunityDetailView }) {
  if (detail.drafts.length === 0 && detail.actions.length === 0) return null;
  return (
    <Section title="Drafts & actions on this opportunity">
      <ul className="space-y-2">
        {detail.actions.map((a) => (
          <li
            key={a.actionId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-soft/60"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{a.type}</span>
              <Badge tone={a.status === "launched" ? "positive" : "neutral"}>
                {a.status}
              </Badge>
              {a.approvalStatus ? (
                <Badge tone={a.approvalStatus === "pending" ? "caution" : "neutral"}>
                  approval: {a.approvalStatus}
                </Badge>
              ) : null}
              {a.activationLevel ? <ActivationBadge level={a.activationLevel} /> : null}
            </span>
            <Link
              href={`/approvals/${a.actionId}?opp=${detail.card.id}`}
              className="text-sm font-medium text-accent underline-offset-2 transition-colors duration-150 hover:text-accent-hover hover:underline"
            >
              Open draft review
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = await getDemoAccountId();

  let detail: OpportunityDetailView;
  try {
    detail = await getOpportunityDetail({ accountId, opportunityId: id });
  } catch {
    notFound();
  }
  const rules = await getOperatingRules(accountId);
  const { card } = detail;
  const explanation = card.explanation;
  const channel =
    card.recommendedAction !== null
      ? CHANNEL_BY_ACTION[card.recommendedAction] ?? card.recommendedAction
      : "—";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4">
      <nav className="text-sm text-ink-muted">
        <Link
          href="/feed"
          className="underline-offset-2 transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← Back to feed
        </Link>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight text-ink">
            {card.title}
          </h1>
          <ConfidenceBadge level={card.confidence} />
        </div>
        <p className="text-sm text-ink-muted">
          Recipe {card.recipeId} v{card.recipeVersion} · Data as of{" "}
          {fmtDateTime(card.dataAsOf)} · Status: {card.status}
        </p>
        <EstimateValue
          estimate={card.estimate}
          measurementMode={card.measurementMode}
          large
        />
      </header>

      <DraftNotActivationBanner />

      <Section title="Source signal">
        <p className="text-sm leading-relaxed text-ink-secondary">{explanation.found}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{explanation.whyItMatters}</p>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Audience & inclusion rules">
          <StatList>
            <StatRow label="Audience" value={detail.audience?.name ?? "—"} />
            <StatRow
              label="Audience size"
              value={detail.audience ? detail.audience.size.toLocaleString() : "—"}
            />
            <StatRow
              label="Eligible channels"
              value={detail.audience?.eligibleChannels.join(", ") ?? "—"}
            />
            {detail.suppressionAudience ? (
              <StatRow
                label={`Suppression: ${detail.suppressionAudience.name}`}
                value={detail.suppressionAudience.size.toLocaleString()}
              />
            ) : null}
          </StatList>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Inclusion rules
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-soft">
            {RECIPE_INCLUSION_RULES[card.recipeId].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>

        <Section title="Exclusion rules applied">
          {detail.exclusionsApplied.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-soft">
              {detail.exclusionsApplied.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No exclusions applied.</p>
          )}
        </Section>
      </div>

      <Section title="Estimate formula & confidence">
        <div className="rounded-md border border-border bg-surface-soft/70 px-3.5 py-2.5">
          <p className="text-sm leading-relaxed text-ink-secondary">
            <span className="font-medium text-ink">Formula: </span>
            {RECIPE_ESTIMATE_FORMULAS[card.recipeId]}
          </p>
        </div>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
          Assumptions (modeled rates are labeled and editable — 26A.6)
        </h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-soft">
          {explanation.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
          Confidence inputs (PRD 11.4 — inspectable)
        </h3>
        <StatList className="mt-1">
          {Object.entries(detail.confidenceInputs).map(([k, v]) => (
            <StatRow key={k} label={k} value={v} />
          ))}
        </StatList>
      </Section>

      <Section title="Data used & freshness">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-secondary marker:text-ink-soft">
          {explanation.dataUsed.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border pt-3">
          <FreshnessList freshness={explanation.dataFreshness} />
        </div>
      </Section>

      <Section title="Proposed action & channel">
        <StatList>
          <StatRow label="Proposed action" value={card.recommendedAction ?? "—"} />
          <StatRow label="Proposed channel" value={channel} />
          <StatRow
            label="Operating Rules version"
            value={`v${rules.version} (effective ${fmtDateTime(rules.effectiveFrom)})`}
          />
        </StatList>
      </Section>

      <Section title="Measurement plan">
        <MeasurementPlanBlock plan={explanation.measurementPlan} />
      </Section>

      <Section title="Risks">
        <p className="text-sm leading-relaxed text-ink-secondary">{explanation.risk}</p>
      </Section>

      <Section title="Unsupported claim warnings">
        <p className="text-sm leading-relaxed text-ink-secondary">
          Draft copy is checked against the banned-claims list at the
          governance chokepoint before any activation (PRD 12.6); findings
          appear on the Campaign Draft Review screen. Claims banned under
          Operating Rules v{rules.version}:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rules.bannedClaims.map((c) => (
            <Badge key={c} tone="danger">
              {c}
            </Badge>
          ))}
        </div>
        {card.recipeId === "meta_seed_suppression" ? (
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Meta reporting is directional-only in v0: lift, incrementality,
            recovered revenue, causal ROAS, and holdout language are never
            used for Meta (PRD 15.4).
          </p>
        ) : null}
      </Section>

      <Card
        as="section"
        variant="premium"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Ready to draft?
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Approval needed: {explanation.approvalNeeded}
          </p>
        </div>
        <DraftCta accountId={accountId} opportunityId={card.id} />
      </Card>

      <ExistingWork detail={detail} />

      {detail.auditTrail.length > 0 ? (
        <section className="space-y-2">
          <SectionHeading
            title="Audit trail"
            subtitle="Every recommendation, draft, approval, and activation is ledgered (PRD 18)."
          />
          <ul className="space-y-1.5">
            {detail.auditTrail.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-ink-muted shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle shadow-[0_0_0_3px_rgb(37_99_235/0.12)]"
                />
                <span className="font-medium text-ink">{e.eventType}</span>
                {" · "}
                {fmtDateTime(e.timestamp)}
                {e.constitutionVersion !== null
                  ? ` · Operating Rules v${e.constitutionVersion}`
                  : null}
                {e.reasoningSummary ? (
                  <p className="mt-0.5 leading-relaxed text-ink-muted">{e.reasoningSummary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
