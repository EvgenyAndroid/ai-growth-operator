/**
 * components/ui/primitives.tsx — shared UI primitives for all slices.
 *
 * Clean, paper-ish neutral style. No external UI libraries. These components
 * take no function props by default, so they render in both Server and Client
 * Components; interactive Button usage belongs inside client components.
 *
 * Badge variants encode the trust rules: the three measurement labels
 * (PRD 4.6) and the three confidence levels (PRD 11) render distinctly.
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
        "rounded-lg border border-stone-200 bg-white shadow-sm",
        "p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Badge — confidence + measurement-label variants
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "positive" | "caution" | "info" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700 border-stone-200",
  positive: "bg-emerald-50 text-emerald-800 border-emerald-200",
  caution: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  danger: "bg-rose-50 text-rose-800 border-rose-200",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-xs font-medium leading-5 whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
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
  directional: "neutral",
};

/**
 * PRD 4.6 — exactly three measurement labels. This badge is the ONLY approved
 * way to render one; free-text measurement labels are a trust-rule violation.
 */
export function MeasurementBadge({
  mode,
  className,
}: {
  mode: MeasurementMode;
  className?: string;
}) {
  return (
    <Badge tone={MEASUREMENT_TONE[mode]} className={className}>
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
    "bg-stone-900 text-stone-50 hover:bg-stone-700 border border-transparent",
  secondary:
    "bg-white text-stone-900 hover:bg-stone-50 border border-stone-300",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-100 border border-transparent",
  danger:
    "bg-white text-rose-700 hover:bg-rose-50 border border-rose-300",
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
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900",
        "disabled:opacity-50 disabled:pointer-events-none",
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>
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
        "border-b border-dotted border-stone-200 last:border-b-0",
        className
      )}
    >
      <dt className="text-sm text-stone-500" title={hint}>
        {label}
      </dt>
      <dd className="text-sm font-medium text-stone-900 text-right">
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
        "rounded-lg border border-dashed border-stone-300 bg-stone-50",
        "px-6 py-10 text-center",
        className
      )}
    >
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
