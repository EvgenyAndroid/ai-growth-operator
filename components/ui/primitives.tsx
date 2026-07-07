/**
 * components/ui/primitives.tsx — shared UI primitives for all slices.
 *
 * Token-driven premium-neutral style (see docs/design-brief.md). No external
 * UI libraries. These components take no function props by default, so they
 * render in both Server and Client Components; interactive Button usage
 * belongs inside client components.
 *
 * Badge variants encode the trust rules: the three measurement labels
 * (PRD 4.6) and the three confidence levels (PRD 11) render distinctly, and
 * "directional" must never look as strong as "holdout-verified".
 */

import * as React from "react";
import type {
  Confidence,
  MeasurementMode,
  ActivationLevel,
} from "@/lib/contracts";
import {
  MEASUREMENT_LABEL_COPY,
  ACTIVATION_LEVELS,
} from "@/lib/contracts";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cx(
        "rounded-card border border-border bg-surface shadow-card",
        "p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Badge — confidence + measurement-label + status pill variants
// ---------------------------------------------------------------------------

type BadgeTone =
  | "neutral"
  | "positive"
  | "caution"
  | "info"
  | "danger"
  | "directional";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-neutral-soft text-slate-600",
  positive: "border-emerald-200 bg-success-soft text-emerald-800",
  caution: "border-amber-200 bg-warning-soft text-amber-800",
  info: "border-blue-200 bg-info-soft text-blue-800",
  danger: "border-red-200 bg-danger-soft text-red-800",
  // Deliberately quieter than "positive": violet/slate, no strong border.
  directional: "border-violet-200/70 bg-directional-soft text-violet-700",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-xs font-medium leading-5 whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Small status dot rendered inside pills; decorative only. */
function PillDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("h-1.5 w-1.5 shrink-0 rounded-full", className)}
    />
  );
}

const CONFIDENCE_TONE: Record<Confidence, BadgeTone> = {
  high: "positive",
  medium: "info",
  low: "caution",
};

const CONFIDENCE_COPY: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/** PRD 11.3 — confidence must appear on card, detail, approval, summary, ledger. */
export function ConfidenceBadge({
  level,
  className,
}: {
  level: Confidence;
  className?: string;
}) {
  return (
    <Badge tone={CONFIDENCE_TONE[level]} className={className}>
      {CONFIDENCE_COPY[level]}
    </Badge>
  );
}

const MEASUREMENT_TONE: Record<MeasurementMode, BadgeTone> = {
  holdout: "positive",
  before_after_no_control: "caution",
  directional: "directional",
};

/** Dot color per measurement mode; directional gets none so it reads softer. */
const MEASUREMENT_DOT: Record<MeasurementMode, string | null> = {
  holdout: "bg-success",
  before_after_no_control: "bg-warning",
  directional: null,
};

/**
 * PRD 4.6 — exactly three measurement labels. This badge is the ONLY approved
 * way to render one; free-text measurement labels are a trust-rule violation.
 * Visual hierarchy: holdout-verified (green, dotted) > before/after (amber,
 * dotted) > directional (muted violet, no dot) — directional must never look
 * as strong as holdout-verified.
 */
export function MeasurementBadge({
  mode,
  className,
}: {
  mode: MeasurementMode;
  className?: string;
}) {
  const dot = MEASUREMENT_DOT[mode];
  return (
    <Badge tone={MEASUREMENT_TONE[mode]} className={className}>
      {dot ? <PillDot className={dot} /> : null}
      {MEASUREMENT_LABEL_COPY[mode]}
    </Badge>
  );
}

/** Shows which Klaviyo fallback level / Meta sync an action used (PRD 10.2). */
export function ActivationBadge({
  level,
  className,
}: {
  level: ActivationLevel;
  className?: string;
}) {
  return (
    <Badge tone="info" className={className}>
      {ACTIVATION_LEVELS[level]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-primary text-white shadow-sm " +
    "hover:bg-primary-hover active:bg-primary-hover active:shadow-none",
  secondary:
    "border border-border-strong bg-surface text-ink shadow-sm " +
    "hover:bg-surface-soft active:bg-primary-soft active:shadow-none",
  ghost:
    "border border-transparent bg-transparent text-ink-secondary " +
    "hover:bg-neutral-soft hover:text-ink active:bg-primary-soft",
  danger:
    "border border-red-200 bg-surface text-red-700 shadow-sm " +
    "hover:bg-red-50 hover:border-red-300 active:bg-danger-soft active:shadow-none",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium select-none",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        BUTTON_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// SectionHeading
// ---------------------------------------------------------------------------

export function SectionHeading({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm leading-snug text-ink-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatRow — label/value line used in explanation contracts, readouts, ledger
// ---------------------------------------------------------------------------

export function StatRow({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-4 py-1.5",
        "border-b border-dotted border-border last:border-b-0",
        className
      )}
    >
      <dt className="text-sm text-ink-muted" title={hint}>
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-ink tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** Wrap StatRows in a definition list. */
export function StatList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dl className={cx("m-0", className)}>{children}</dl>;
}

// ---------------------------------------------------------------------------
// EmptyState — also used for 26A.10 "no opportunity found" explanations
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-lg border border-dashed border-border-strong bg-surface-soft/60",
        "px-6 py-10 text-center",
        className
      )}
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — loading placeholder (pulse is guarded by motion-safe)
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "rounded-md bg-slate-200/80 motion-safe:animate-pulse",
        className
      )}
    />
  );
}
