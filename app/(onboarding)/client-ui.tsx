"use client";

/**
 * app/(onboarding)/client-ui.tsx — client-safe copies of the Button / Badge /
 * Card visual language from components/ui/primitives.tsx.
 *
 * WHY THIS EXISTS: primitives.tsx value-imports lib/contracts, and contracts
 * value-re-exports `Prisma` from the generated Prisma client, which requires
 * `node:module` — so primitives cannot be bundled into Client Components
 * (Turbopack: "chunking context does not support external modules"). Both
 * files are foundation-owned and frozen, so onboarding client components use
 * these local equivalents. Keep class strings in sync with primitives.tsx.
 */

import * as React from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// --- Button (mirror of primitives.tsx Button) -------------------------------

export type ClientButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_CLASSES: Record<ClientButtonVariant, string> = {
  // Deep console navy with a hairline top sheen; presses flat.
  primary:
    "border border-transparent bg-primary text-white " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] " +
    "hover:bg-primary-hover " +
    "active:bg-primary-hover active:shadow-none active:translate-y-px",
  secondary:
    "border border-border-strong bg-surface text-ink shadow-xs " +
    "hover:bg-surface-soft hover:border-slate-300 " +
    "active:bg-primary-soft active:shadow-none active:translate-y-px",
  // Tertiary: quiet text action.
  ghost:
    "border border-transparent bg-transparent text-ink-secondary " +
    "hover:bg-neutral-soft hover:text-ink active:bg-primary-soft",
  danger:
    "border border-red-200 bg-surface text-red-700 shadow-xs " +
    "hover:bg-red-50 hover:border-red-300 " +
    "active:bg-danger-soft active:shadow-none active:translate-y-px",
};

export function ClientButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ClientButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium select-none",
        "transition-[background-color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        BUTTON_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}

// --- Badge (mirror of primitives.tsx Badge) ---------------------------------

export type ClientBadgeTone =
  | "neutral"
  | "positive"
  | "caution"
  | "info"
  | "danger"
  | "directional";

const TONE_CLASSES: Record<ClientBadgeTone, string> = {
  neutral: "border-slate-200 bg-neutral-soft text-slate-600",
  positive: "border-emerald-300/70 bg-success-soft text-emerald-800",
  caution: "border-amber-300/70 bg-warning-soft text-amber-800",
  info: "border-blue-200 bg-info-soft text-blue-800",
  danger: "border-red-200 bg-danger-soft text-red-800",
  // Deliberately quieter than "positive": violet/slate, washed border, no dot.
  directional: "border-violet-200/60 bg-directional-soft/70 text-violet-700",
};

export function ClientBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: ClientBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-xs font-medium leading-5 whitespace-nowrap",
        "shadow-[0_1px_1px_rgb(15_23_42/0.04)]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Card (mirror of primitives.tsx Card) -----------------------------------

type ClientCardVariant = "flat" | "raised" | "glass" | "hero";

const CARD_VARIANT_CLASSES: Record<ClientCardVariant, string> = {
  flat: "border border-border bg-surface",
  raised: "border border-border bg-surface",
  glass: "border border-white/60 bg-surface-glass backdrop-blur-md",
  hero: "gradient-border bg-surface",
};

const CARD_SHADOW_CLASSES: Record<ClientCardVariant, string | null> = {
  flat: null,
  raised: "shadow-card",
  glass: "shadow-card",
  hero: "shadow-md",
};

export function ClientCard({
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
  variant?: ClientCardVariant;
  glow?: boolean;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cx(
        "rounded-card p-5",
        CARD_VARIANT_CLASSES[variant],
        glow ? "shadow-glow" : CARD_SHADOW_CLASSES[variant],
        interactive &&
          "transition-shadow duration-150 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
