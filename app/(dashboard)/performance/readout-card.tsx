/**
 * app/(dashboard)/performance/readout-card.tsx — client-safe presentational
 * pieces shared by the Performance screen, the PRD 20.4 example readouts, and
 * Operator Chat (a client component).
 *
 * IMPORTANT: this file must stay importable from client components, so it
 * imports ONLY types from lib/ (no runtime import of lib/contracts, which
 * re-exports the generated Prisma client). Display copy for the three
 * measurement labels is fixed by PRD 4.6 and duplicated here verbatim from
 * MEASUREMENT_LABEL_COPY in lib/contracts.ts.
 */

import * as React from "react";
import type {
  Confidence,
  ContractContaminationRisk,
  DataFreshness,
  ExplanationContract,
  MeasurementMode,
  MeasurementReadout,
} from "@/lib/contracts";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Formatting helpers (deterministic — safe for server + client render)
// ---------------------------------------------------------------------------

/** ISO timestamp → "2026-06-15 09:30 UTC". Deterministic, no locale. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** ISO timestamp → "2026-06-15". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function fmtMoney(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}`;
}

/** Lift is a rate difference; render as percentage points, signed. */
export function fmtLiftPoints(value: number): string {
  const points = value * 100;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)} pp`;
}

export function fmtMetricLabel(key: string): string {
  return key.replace(/_/g, " ");
}

export function fmtMetricValue(key: string, value: number | string): string {
  if (typeof value === "string") {
    // ISO timestamps read badly raw.
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDateTime(value);
    return value;
  }
  if (/revenue|refund|spend/.test(key)) return fmtMoney(value);
  if (/rate/.test(key) && Math.abs(value) <= 1) return `${(value * 100).toFixed(2)}%`;
  return value.toLocaleString("en-US");
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

// ---------------------------------------------------------------------------
// Badges (styling mirrors components/ui/primitives.tsx, without its runtime
// import chain so these render inside client components)
// ---------------------------------------------------------------------------

/** PRD 4.6 — the only three measurement labels, display copy fixed. */
const MODE_COPY: Record<MeasurementMode, string> = {
  holdout: "Holdout-verified",
  before_after_no_control: "Before/after, no control group",
  directional: "Directional",
};

/**
 * Measurement pill hierarchy (design brief): holdout-verified (green, dotted)
 * > before/after (amber, dotted) > directional (muted violet, NO dot) —
 * directional must never look as strong as holdout-verified.
 */
const MODE_CLASSES: Record<MeasurementMode, string> = {
  holdout: "bg-success-soft text-emerald-800 border-emerald-200",
  before_after_no_control: "bg-warning-soft text-amber-800 border-amber-200",
  directional: "bg-directional-soft text-violet-700 border-violet-200/70",
};

const MODE_DOT: Record<MeasurementMode, string | null> = {
  holdout: "bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]",
  before_after_no_control: "bg-warning shadow-[0_0_0_3px_rgb(217_119_6/0.14)]",
  directional: null,
};

export function ModeBadge({
  mode,
  large,
  className,
}: {
  mode: MeasurementMode;
  large?: boolean;
  className?: string;
}) {
  const dot = MODE_DOT[mode];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs leading-5",
        MODE_CLASSES[mode],
        className
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dot)}
        />
      ) : null}
      {MODE_COPY[mode]}
    </span>
  );
}

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  high: "bg-success-soft text-emerald-800 border-emerald-200",
  medium: "bg-info-soft text-blue-800 border-blue-200",
  low: "bg-warning-soft text-amber-800 border-amber-200",
};

const CONFIDENCE_COPY: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function ConfBadge({
  level,
  className,
}: {
  level: Confidence;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5 whitespace-nowrap",
        CONFIDENCE_CLASSES[level],
        className
      )}
    >
      {CONFIDENCE_COPY[level]}
    </span>
  );
}

export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-border bg-neutral-soft px-2 py-0.5 text-xs font-medium leading-5 text-ink-muted whitespace-nowrap",
        className
      )}
      title="Alpha runs against mocked connectors — no external send or sync occurs (PRD 25.1)."
    >
      Simulated
    </span>
  );
}

// ---------------------------------------------------------------------------
// Meta directional disclaimer — PRD 15.3, exact required copy
// ---------------------------------------------------------------------------

/** PRD 15.3 — every Meta report must show exactly this sentence. */
export const META_DIRECTIONAL_DISCLAIMER =
  "Directional reporting only. This is not holdout-verified lift.";

export function MetaDirectionalDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cx(
        "rounded-md border border-violet-200/70 bg-directional-soft/70 px-3 py-2 text-sm font-semibold text-violet-900",
        className
      )}
    >
      {META_DIRECTIONAL_DISCLAIMER}
    </p>
  );
}

export function ContaminationNotice({
  risk,
  className,
}: {
  risk: ContractContaminationRisk;
  className?: string;
}) {
  if (risk !== "flagged") return null;
  return (
    <p
      className={cx(
        "rounded-md border border-red-200 bg-danger-soft/60 px-3 py-2 text-sm text-red-800",
        className
      )}
    >
      <strong>Holdout contamination risk: flagged.</strong> Held-out customers
      may also be reached by other active flows or campaigns — see the caveats
      below. Confidence has been lowered accordingly (PRD 14.4 / 26A.5).
    </p>
  );
}

// ---------------------------------------------------------------------------
// Metrics + caveats
// ---------------------------------------------------------------------------

export function MetricsTable({
  metrics,
  className,
}: {
  metrics: Record<string, number | string>;
  className?: string;
}) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return null;
  return (
    <dl className={cx("m-0", className)}>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex items-baseline justify-between gap-4 border-b border-dotted border-border py-1.5 last:border-b-0"
        >
          <dt className="text-sm text-ink-muted capitalize">{fmtMetricLabel(key)}</dt>
          <dd className="text-right text-sm font-medium text-ink tabular-nums">
            {fmtMetricValue(key, value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CaveatList({
  caveats,
  className,
}: {
  caveats: string[];
  className?: string;
}) {
  if (caveats.length === 0) return null;
  return (
    <ul className={cx("space-y-1", className)}>
      {caveats.map((caveat, index) => (
        <li
          key={index}
          className="rounded-md border border-amber-200/80 bg-warning-soft/70 px-2.5 py-1.5 text-xs leading-5 text-amber-900"
        >
          {caveat}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// ReadoutCard — one MeasurementReadout, trust rules enforced in markup:
//   * exactly ONE measurement label, prominent (PRD 7.5)
//   * window always stated (26A.2)
//   * lift range rendered ONLY for holdout mode (never Meta — PRD 15.4)
//   * directional mode always carries the exact PRD 15.3 disclaimer
//   * contamination disclosure when flagged (PRD 14.4)
// ---------------------------------------------------------------------------

/**
 * Per-mode card treatment — the authority hierarchy is visible at card level
 * (design brief v2 §9): holdout-verified is the most authoritative (emerald
 * rail + faint verified glow), before/after sits mid (amber rail), and
 * directional stays the most muted of the three (washed violet, flat).
 */
export const READOUT_ACCENT: Record<MeasurementMode, string> = {
  holdout:
    "border-t-2 border-t-success " +
    "shadow-[0_1px_2px_rgb(15_23_42/0.06),0_2px_8px_rgb(15_23_42/0.05),0_12px_32px_-10px_rgb(5_150_105/0.25)]",
  before_after_no_control: "border-t-2 border-t-warning",
  directional: "border-t-2 border-t-violet-200/80",
};

export function ReadoutCard({
  readout,
  title,
  className,
}: {
  readout: MeasurementReadout;
  title?: string;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-card border border-border bg-surface p-5",
        // Holdout carries its own verified-glow shadow; others rest on card.
        readout.mode === "holdout"
          ? null
          : "shadow-card transition-shadow duration-150 hover:shadow-card-hover",
        READOUT_ACCENT[readout.mode],
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ModeBadge mode={readout.mode} large />
        <ConfBadge level={readout.confidence} />
        <SimulatedBadge />
      </div>
      {title ? (
        <h3 className="mt-3 text-base font-semibold tracking-tight text-ink">{title}</h3>
      ) : null}
      <p className="mt-1 text-xs text-ink-soft">
        Measurement window: {readout.window.readType} read,{" "}
        {fmtDate(readout.window.start)} → {fmtDate(readout.window.end)}
      </p>

      {readout.mode === "directional" ? (
        <MetaDirectionalDisclaimer className="mt-3" />
      ) : null}
      <ContaminationNotice risk={readout.contaminationRisk} className="mt-3" />

      <p className="mt-3 text-sm text-ink-secondary">{readout.summary}</p>

      {readout.mode === "holdout" && readout.lift ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-success-soft/70 px-3 py-2 text-sm text-emerald-900">
          Measured lift range: <strong>{fmtLiftPoints(readout.lift.low)}</strong>{" "}
          to <strong>{fmtLiftPoints(readout.lift.high)}</strong> in purchase
          rate versus the held-out group (range, not a point estimate — PRD 16.4).
        </p>
      ) : null}
      {readout.mode === "holdout" && !readout.lift ? (
        <p className="mt-3 rounded-md border border-border bg-surface-soft px-3 py-2 text-sm text-ink-secondary">
          Lift not proven on this read — the confidence band includes zero or a
          measurement arm was empty. We say so rather than claiming impact.
        </p>
      ) : null}

      <MetricsTable metrics={readout.metrics} className="mt-4" />
      <CaveatList caveats={readout.caveats} className="mt-4" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// ExplanationPanel — PRD 4.4 / 17.3: the full explanation contract. Every
// recommendation surface (chat answers, opportunity references) renders this.
// ---------------------------------------------------------------------------

function FreshnessLine({ freshness }: { freshness: DataFreshness }) {
  return (
    <li className="text-sm text-ink-secondary">
      <span className="font-medium">{freshness.source}</span> — last synced{" "}
      {fmtDateTime(freshness.lastSyncAt)} (threshold {freshness.thresholdHours}h)
      {freshness.isStale ? (
        <span className="ml-1 rounded border border-red-200 bg-danger-soft/70 px-1.5 text-xs font-medium text-red-700">
          stale
        </span>
      ) : (
        <span className="ml-1 rounded border border-emerald-200 bg-success-soft/70 px-1.5 text-xs font-medium text-emerald-700">
          fresh
        </span>
      )}
    </li>
  );
}

function ContractSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </h4>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ExplanationPanel({
  explanation,
  className,
}: {
  explanation: ExplanationContract;
  className?: string;
}) {
  const plan = explanation.measurementPlan;
  return (
    <div
      className={cx(
        "space-y-4 rounded-lg border border-border bg-surface-soft/60 p-4",
        className
      )}
    >
      <ContractSection label="What was found">
        <p className="text-sm text-ink-secondary">{explanation.found}</p>
      </ContractSection>
      <ContractSection label="Why it matters">
        <p className="text-sm text-ink-secondary">{explanation.whyItMatters}</p>
      </ContractSection>
      <ContractSection label="Data used">
        <ul className="list-disc pl-5 text-sm text-ink-secondary">
          {explanation.dataUsed.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </ContractSection>
      <ContractSection label="Data freshness">
        <ul className="space-y-0.5">
          {explanation.dataFreshness.map((freshness, index) => (
            <FreshnessLine key={index} freshness={freshness} />
          ))}
        </ul>
      </ContractSection>
      <ContractSection label="Assumptions">
        {explanation.assumptions.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-ink-secondary">
            {explanation.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">None recorded.</p>
        )}
      </ContractSection>
      <ContractSection label="Risk">
        <p className="text-sm text-ink-secondary">{explanation.risk}</p>
      </ContractSection>
      <ContractSection label="Approval needed">
        <p className="text-sm text-ink-secondary">{explanation.approvalNeeded}</p>
      </ContractSection>
      <ContractSection label="Measurement plan">
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge mode={plan.mode} />
        </div>
        <p className="mt-1.5 text-sm text-ink-secondary">{plan.summary}</p>
        <p className="mt-1 text-xs text-ink-soft">
          Windows:{" "}
          {plan.windows
            .map((window) => `${window.readType} read at ${window.days} days`)
            .join("; ")}
        </p>
        {plan.mode === "directional" ? (
          <MetaDirectionalDisclaimer className="mt-2" />
        ) : null}
        <CaveatList caveats={plan.caveats} className="mt-2" />
      </ContractSection>
    </div>
  );
}
