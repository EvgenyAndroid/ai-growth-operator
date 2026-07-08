/**
 * app/(dashboard)/feed/_shared/explanation.tsx — shared render blocks for the
 * ExplanationContract (PRD 4.4), MeasurementPlan (PRD 14, 26A.2), estimates
 * (PRD 16.4 — always ranges), and the 26A.4 "draft is not activation" banner.
 *
 * Server-safe (no hooks, no handlers); also usable inside client components.
 */

import * as React from "react";
import type {
  ExplanationContract,
  MeasurementPlan,
  EstimateRange,
  MeasurementMode,
} from "@/lib/contracts";
import {
  Badge,
  MeasurementBadge,
  StatList,
  StatRow,
} from "@/components/ui/primitives";
import { fmtDateTime, fmtRange, READ_TYPE_LABELS } from "./format";

// ---------------------------------------------------------------------------
// Estimate — range or directional label, never a point (PRD 16.4)
// ---------------------------------------------------------------------------

export function EstimateValue({
  estimate,
  measurementMode,
  large,
}: {
  estimate: EstimateRange | null;
  measurementMode: MeasurementMode;
  large?: boolean;
}) {
  if (estimate) {
    return (
      <span
        className={
          large
            ? "text-[1.75rem] font-semibold leading-tight tracking-tight text-ink tabular-nums"
            : "font-semibold text-ink tabular-nums"
        }
      >
        {fmtRange(estimate.low, estimate.high)}
        <span className="ml-2 align-middle text-xs font-normal tracking-normal text-ink-soft">
          {estimate.label === "merchant_historical"
            ? "based on your history"
            : "modeled estimate"}
        </span>
      </span>
    );
  }
  // No defensible dollar value — directional label instead (PRD 16.3 step 4).
  return (
    <span
      className={
        large
          ? "text-xl font-semibold tracking-tight text-ink-secondary"
          : "font-medium text-ink-secondary"
      }
    >
      {measurementMode === "directional"
        ? "Directional — no dollar estimate"
        : "No dollar estimate (no baseline)"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data freshness list
// ---------------------------------------------------------------------------

export function FreshnessList({
  freshness,
}: {
  freshness: ExplanationContract["dataFreshness"];
}) {
  return (
    <ul className="space-y-1">
      {/* Key includes the index: in demo mode several integrations all report
          source "demo", so source alone is not unique. */}
      {freshness.map((f, i) => (
        <li key={`${f.source}:${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-muted">
          <span className="font-medium capitalize text-ink">{f.source}</span>
          <span>synced {fmtDateTime(f.lastSyncAt)}</span>
          <span className="text-ink-soft">(threshold {f.thresholdHours}h)</span>
          {f.isStale ? (
            <Badge tone="danger">stale</Badge>
          ) : (
            <Badge tone="positive">fresh</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Measurement plan — holdout plan or measurement label (PRD 7.4, 26A.2)
// ---------------------------------------------------------------------------

export function MeasurementPlanBlock({ plan }: { plan: MeasurementPlan }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MeasurementBadge mode={plan.mode} />
        <span className="text-sm text-ink-muted">{plan.summary}</span>
      </div>

      {plan.holdout ? (
        <StatList className="rounded-md border border-border bg-surface-soft/70 px-3">
          <StatRow label="Eligible audience" value={plan.holdout.eligibleAudienceSize.toLocaleString()} />
          <StatRow label="Holdout" value={`${plan.holdout.holdoutPercent}% (${plan.holdout.holdoutSize.toLocaleString()} customers)`} />
          <StatRow label="Assignment" value="Randomized, customer-level" />
          <StatRow label="Exclusion window" value={plan.holdout.exclusionWindow} />
          <StatRow
            label="Enforceable in activation path"
            value={plan.holdout.enforceable ? "Yes" : "No — claim downgrades (26A.1)"}
          />
        </StatList>
      ) : null}

      <div className="text-sm text-ink-muted">
        <span className="font-medium text-ink">Measurement windows: </span>
        {plan.windows
          .map((w) => `${READ_TYPE_LABELS[w.readType] ?? w.readType} at ${w.days} days`)
          .join(" · ")}
      </div>

      {plan.caveats.length > 0 ? (
        <ul className="space-y-1">
          {plan.caveats.map((c) => (
            <li key={c} className="flex gap-2 text-sm leading-relaxed text-amber-800">
              <span aria-hidden className="select-none font-semibold">!</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full explanation contract (PRD 4.4 — all eight fields or nothing)
// ---------------------------------------------------------------------------

function LabeledBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </h4>
      <div className="mt-1 text-sm leading-relaxed text-ink-secondary">{children}</div>
    </div>
  );
}

export function ExplanationBlock({
  explanation,
}: {
  explanation: ExplanationContract;
}) {
  return (
    <div className="grid gap-4">
      <LabeledBlock label="What was found">{explanation.found}</LabeledBlock>
      <LabeledBlock label="Why it matters">{explanation.whyItMatters}</LabeledBlock>
      <LabeledBlock label="Data used">
        <ul className="list-disc space-y-0.5 pl-5">
          {explanation.dataUsed.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </LabeledBlock>
      <LabeledBlock label="Data freshness">
        <FreshnessList freshness={explanation.dataFreshness} />
      </LabeledBlock>
      <LabeledBlock label="Assumptions">
        {explanation.assumptions.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5">
            {explanation.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : (
          "None."
        )}
      </LabeledBlock>
      <LabeledBlock label="Risk">{explanation.risk}</LabeledBlock>
      <LabeledBlock label="Approval needed">{explanation.approvalNeeded}</LabeledBlock>
      <LabeledBlock label="Measurement plan">
        <MeasurementPlanBlock plan={explanation.measurementPlan} />
      </LabeledBlock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 26A.4 — draft is not activation. Visually explicit, reused on every
// draft-adjacent surface.
// ---------------------------------------------------------------------------

export function DraftNotActivationBanner({
  compact,
}: {
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Badge tone="caution" title="Creating a draft is not activation (PRD 26A.4).">
        Draft only — nothing sends
      </Badge>
    );
  }
  return (
    <div
      role="note"
      className="relative overflow-hidden rounded-md border border-amber-200 bg-warning-soft/60 px-4 py-3 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gradient-to-b before:from-amber-400 before:to-amber-300/40"
    >
      <p className="text-sm font-semibold text-amber-900">
        Draft is not activation.
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
        Nothing is sent, synced, suppressed, or spent until you explicitly
        approve. Approval routes through governance (consent, suppression,
        Operating Rules, claim checks, freshness) before any activation.
      </p>
    </div>
  );
}
