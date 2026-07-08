/**
 * components/ui/primitives.tsx — shared UI primitives for all slices.
 *
 * Token-driven premium style (docs/design-brief-v3.md, superseding v2 where
 * they conflict). No external UI libraries. These components take no
 * function props by default, so they render in both Server and Client
 * Components; interactive Button usage belongs inside client components.
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
// Card — elevation variants (brief v2 §Tokens + §4; premium tier per v3)
//
//   flat    — bordered surface, no shadow (dense lists, nested panels)
//   raised  — default; resting card with the layered card shadow
//   glass   — translucent surface + blur, for chrome-adjacent panels
//   hero    — gradient hairline border + md elevation; `glow` adds the
//             accent bloom (found-money card, sign-in card)
//   premium — brief v3 .card-premium: blue->emerald gradient border-box +
//             deep soft elevation; reserve for the screenshot-hero objects
// ---------------------------------------------------------------------------

type CardVariant = "flat" | "raised" | "glass" | "hero" | "premium";

const CARD_VARIANT_CLASSES: Record<CardVariant, string> = {
  flat: "border border-border bg-surface",
  raised: "border border-border bg-surface",
  glass: "border border-white/60 bg-surface-glass backdrop-blur-md",
  hero: "gradient-border bg-surface",
  premium: "card-premium",
};

/** Resting shadow per variant when no glow is requested. */
const CARD_SHADOW_CLASSES: Record<CardVariant, string | null> = {
  flat: null,
  raised: "shadow-card",
  glass: "shadow-card",
  hero: "shadow-md",
  premium: null, // elevation is baked into .card-premium
};

export function Card({
  children,
  className,
  as: Tag = "div",
  variant = "raised",
  glow = false,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  /** Elevation tier — see brief v2. Defaults to the resting raised card. */
  variant?: CardVariant;
  /** Accent glow under the card; reserve for hero objects. */
  glow?: boolean;
  /** Hover lift (shadow deepens); for cards that link somewhere. */
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cx(
        "rounded-card p-5",
        CARD_VARIANT_CLASSES[variant],
        glow
          ? variant === "premium"
            ? "glow-verified"
            : "shadow-glow"
          : CARD_SHADOW_CLASSES[variant],
        interactive &&
          "transition-[box-shadow,translate] duration-150 ease-out " +
            "hover:-translate-y-0.5 hover:shadow-card-hover",
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

/**
 * Per-tone chrome incl. shadow treatment (brief v3 area 5): emerald "proven"
 * pills carry an inner glow, amber carries a caution ring, directional stays
 * washed/flat so it never reads as strong as verified.
 */
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "border-slate-200 bg-neutral-soft text-slate-600 " +
    "shadow-[0_1px_1px_rgb(15_23_42/0.04)]",
  positive:
    "border-emerald-300/70 bg-success-soft text-emerald-800 pill-holdout",
  caution: "border-amber-300/70 bg-warning-soft text-amber-800 pill-caution",
  info:
    "border-blue-200 bg-info-soft text-blue-800 " +
    "shadow-[0_1px_1px_rgb(15_23_42/0.04)]",
  danger:
    "border-red-200 bg-danger-soft text-red-800 " +
    "shadow-[0_1px_1px_rgb(15_23_42/0.04)]",
  // Deliberately quieter than "positive": washed muted plum (never bright
  // purple), washed border, no dot (brief v4 measurement system).
  directional:
    "border-violet-200/50 bg-violet-50/70 text-violet-900/70 " +
    "pill-directional",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-xs font-medium leading-5 whitespace-nowrap",
        "transition-[box-shadow,background-color] duration-150 ease-out",
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
  holdout: "bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]",
  before_after_no_control: "bg-warning shadow-[0_0_0_3px_rgb(217_119_6/0.14)]",
  directional: null,
};

/**
 * PRD 4.6 — exactly three measurement labels. This badge is the ONLY approved
 * way to render one; free-text measurement labels are a trust-rule violation.
 * Visual hierarchy (brief v4): holdout-verified is the STRONGEST (green,
 * dotted, semibold) > before/after (amber, dotted, cautionary) > directional
 * (washed muted plum, no dot, regular weight) — directional must never look
 * as strong as holdout-verified. Labels differ textually, never color-alone.
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
    <Badge
      tone={MEASUREMENT_TONE[mode]}
      className={cx(mode === "holdout" && "font-semibold", className)}
    >
      {dot ? <PillDot className={dot} /> : null}
      {MEASUREMENT_LABEL_COPY[mode]}
    </Badge>
  );
}

/**
 * MeasurementLegend — plain-language key for the three measurement labels
 * (brief v4 measurement system). For the feed right rail / performance page.
 */
const MEASUREMENT_LEGEND_COPY: Record<MeasurementMode, string> = {
  holdout: "Controlled proof — measured against a real holdout.",
  before_after_no_control: "No control group — read with caution.",
  directional: "Platform-reported, non-causal.",
};

export function MeasurementLegend({ className }: { className?: string }) {
  const modes: MeasurementMode[] = [
    "holdout",
    "before_after_no_control",
    "directional",
  ];
  return (
    <ul className={cx("m-0 flex list-none flex-col gap-2.5 p-0", className)}>
      {modes.map((mode) => (
        <li key={mode} className="flex flex-col items-start gap-1">
          <MeasurementBadge mode={mode} />
          <span className="pl-0.5 text-[11px] leading-4 text-ink-muted">
            {MEASUREMENT_LEGEND_COPY[mode]}
          </span>
        </li>
      ))}
    </ul>
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
// Button — primary / secondary / tertiary(ghost) / danger, with pressed states
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  // Deep console navy with a hairline top sheen; presses in (tactile:
  // sinks a hair, sheen flips to an inner shade — brief v3 area 5).
  primary:
    "border border-transparent bg-primary text-white " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] " +
    "hover:bg-primary-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_2px_6px_rgb(2_6_23/0.4)] " +
    "active:bg-primary-hover active:translate-y-px active:scale-[0.99] " +
    "active:shadow-[inset_0_2px_4px_rgb(2_6_23/0.45)]",
  secondary:
    "border border-border-strong bg-surface text-ink shadow-xs " +
    "hover:bg-surface-soft hover:border-slate-300 " +
    "active:bg-primary-soft active:translate-y-px active:scale-[0.99] " +
    "active:shadow-[inset_0_1px_3px_rgb(15_23_42/0.12)]",
  // Tertiary: quiet text action.
  ghost:
    "border border-transparent bg-transparent text-ink-secondary " +
    "hover:bg-neutral-soft hover:text-ink " +
    "active:bg-primary-soft active:scale-[0.99]",
  danger:
    "border border-red-200 bg-surface text-red-700 shadow-xs " +
    "hover:bg-red-50 hover:border-red-300 " +
    "active:bg-danger-soft active:translate-y-px active:scale-[0.99] " +
    "active:shadow-[inset_0_1px_3px_rgb(153_27_27/0.15)]",
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
        "transition-[background-color,border-color,box-shadow,translate,scale] duration-150 ease-out",
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
// ChoiceChip — selectable reason/filter pill (used by the dismiss + reject
// reason pickers). Native button props only, so it stays a shared primitive;
// interactive usage (onClick) belongs inside client components, like Button.
// ---------------------------------------------------------------------------

export function ChoiceChip({
  selected = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Renders the pressed/selected state and sets aria-pressed. */
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected
          ? "border-primary bg-primary text-white"
          : "border-border-strong bg-surface text-ink-secondary hover:bg-surface-soft hover:text-ink",
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
        <h2 className="text-lg font-semibold tracking-tight text-ink-800">
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
// Skeleton — loading placeholder (shimmer; killed by the global
// reduced-motion switch in globals.css)
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("skeleton-shimmer rounded-md", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Brief v4 primitives — "revenue cockpit with proof rails". Small and
// dedup-oriented; presentational only, safe in Server Components.
// ---------------------------------------------------------------------------

type StatusDotTone = "money" | "proof" | "warning" | "directional" | "neutral";

/**
 * Per-tone dot chrome. Money/proof carry a soft status glow; directional is
 * deliberately dimmer than money (trust hierarchy); warning stays calm.
 */
const STATUS_DOT_CLASSES: Record<StatusDotTone, string> = {
  money:
    "bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15),0_0_10px_var(--glow-money)]",
  proof:
    "bg-info shadow-[0_0_0_3px_rgb(37_99_235/0.14),0_0_10px_var(--glow-proof)]",
  warning: "bg-warning shadow-[0_0_0_3px_rgb(217_119_6/0.14)]",
  directional: "bg-violet-400/70 shadow-[0_0_0_3px_rgb(124_58_237/0.10)]",
  neutral: "bg-slate-400 shadow-[0_0_0_3px_rgb(100_116_139/0.12)]",
};

/**
 * StatusDot — tiny status indicator. Decorative (aria-hidden): ALWAYS pair
 * it with a text label; status is never conveyed by color alone. `pulse`
 * adds the soft live-sync pulse (killed by the reduced-motion switch).
 */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: StatusDotTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        STATUS_DOT_CLASSES[tone],
        pulse && "connector-dot-live",
        className
      )}
    />
  );
}

type MetricTileTone = "neutral" | "money" | "proof" | "directional";

const METRIC_TILE_TONES: Record<MetricTileTone, string> = {
  neutral: "border-border bg-surface",
  money: "border-emerald-200/70 bg-emerald-50/60",
  proof: "border-blue-200/70 bg-blue-50/50",
  // Washed on purpose — a directional tile must read quieter than money.
  directional: "border-violet-200/50 bg-violet-50/40",
};

/**
 * MetricTile — compact stat tile (label over a bold tabular value) for the
 * found-money hero, performance readouts and status rails.
 */
export function MetricTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: MetricTileTone;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border px-3 py-2.5",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(15_23_42/0.05)]",
        METRIC_TILE_TONES[tone],
        className
      )}
    >
      <div className="truncate text-[11px] font-medium tracking-[0.08em] text-ink-muted uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg leading-6 font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] leading-4 text-ink-soft">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ProofRail — tiny horizontal pipeline (default Found → Drafted → Approved →
 * Measured). Purely presentational; steps at or before `active` read as
 * reached (also weight-differentiated, not color-alone). Omit `active` to
 * show the whole rail as reached.
 */
export function ProofRail({
  steps = ["Found", "Drafted", "Approved", "Measured"],
  active,
  className,
}: {
  steps?: string[];
  active?: number;
  className?: string;
}) {
  return (
    <ol
      className={cx(
        "m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0",
        className
      )}
    >
      {steps.map((step, i) => {
        const reached = active === undefined || i <= active;
        return (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cx(
                  "h-px w-3",
                  reached ? "bg-emerald-300" : "bg-border-strong"
                )}
              />
            ) : null}
            <span
              className={cx(
                "inline-flex items-center gap-1 text-[11px] leading-4",
                reached ? "font-medium text-ink-secondary" : "text-ink-soft"
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "h-1 w-1 shrink-0 rounded-full",
                  reached ? "bg-success" : "bg-slate-300"
                )}
              />
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type PremiumCalloutTone = "money" | "proof" | "warning" | "neutral";

const PREMIUM_CALLOUT_TONES: Record<PremiumCalloutTone, string> = {
  money:
    "border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/50 " +
    "shadow-[0_10px_30px_-10px_var(--glow-money)]",
  proof:
    "border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/50 " +
    "shadow-[0_10px_30px_-10px_var(--glow-proof)]",
  warning:
    "border-amber-200/70 bg-amber-50/60 " +
    "shadow-[0_8px_24px_-10px_var(--glow-warning)]",
  neutral: "border-border bg-surface-soft/70",
};

/**
 * PremiumCallout — small toned callout (proof-mode notes, next-best-action,
 * "not counted" disclosures). Quieter than a Card; never a wall of text.
 */
export function PremiumCallout({
  title,
  children,
  tone = "proof",
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  tone?: PremiumCalloutTone;
  className?: string;
}) {
  return (
    <div className={cx("rounded-lg border p-3", PREMIUM_CALLOUT_TONES[tone], className)}>
      {title ? (
        <p className="text-xs font-semibold text-ink-800">{title}</p>
      ) : null}
      <div
        className={cx("text-xs leading-5 text-ink-muted", title ? "mt-1" : null)}
      >
        {children}
      </div>
    </div>
  );
}
