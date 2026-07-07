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
      <span className={large ? "text-2xl font-semibold tracking-tight text-stone-900" : "font-semibold text-stone-900"}>
        {fmtRange(estimate.low, estimate.high)}
        <span className="ml-2 align-middle text-xs font-normal text-stone-500">
          {estimate.label === "merchant_historical"
            ? "based on your history"
            : "modeled estimate"}
        </span>
      </span>
    );
  }
  // No defensible dollar value — directional label instead (PRD 16.3 step 4).
  return (
    <span className={large ? "text-xl font-semibold text-stone-700" : "font-medium text-stone-700"}>
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
      {freshness.map((f) => (
        <li key={f.source} className="flex items-center gap-2 text-sm text-stone-600">
          <span className="font-medium capitalize text-stone-800">{f.source}</span>
          <span>synced {fmtDateTime(f.lastSyncAt)}</span>
          <span className="text-stone-400">(threshold {f.thresholdHours}h)</span>
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
        <span className="text-sm text-stone-600">{plan.summary}</span>
      </div>

      {plan.holdout ? (
        <StatList className="rounded-md border border-stone-200 bg-stone-50 px-3">
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

      <div className="text-sm text-stone-600">
        <span className="font-medium text-stone-800">Measurement windows: </span>
        {plan.windows
          .map((w) => `${READ_TYPE_LABELS[w.readType] ?? w.readType} at ${w.days} days`)
          .join(" · ")}
      </div>

      {plan.caveats.length > 0 ? (
        <ul className="space-y-1">
          {plan.caveats.map((c) => (
            <li key={c} className="flex gap-2 text-sm text-amber-800">
              <span aria-hidden className="select-none">!</span>
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </h4>
      <div className="mt-1 text-sm text-stone-700">{children}</div>
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
      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <p className="text-sm font-semibold text-amber-900">
        Draft is not activation.
      </p>
      <p className="mt-0.5 text-sm text-amber-800">
        Nothing is sent, synced, suppressed, or spent until you explicitly
        approve. Approval routes through governance (consent, suppression,
        Operating Rules, claim checks, freshness) before any activation.
      </p>
    </div>
  );
}
