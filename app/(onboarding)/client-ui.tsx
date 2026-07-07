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
  primary:
    "bg-stone-900 text-stone-50 hover:bg-stone-700 border border-transparent",
  secondary:
    "bg-white text-stone-900 hover:bg-stone-50 border border-stone-300",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-100 border border-transparent",
  danger: "bg-white text-rose-700 hover:bg-rose-50 border border-rose-300",
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
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900",
        "disabled:opacity-50 disabled:pointer-events-none",
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
  | "danger";

const TONE_CLASSES: Record<ClientBadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700 border-stone-200",
  positive: "bg-emerald-50 text-emerald-800 border-emerald-200",
  caution: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  danger: "bg-rose-50 text-rose-800 border-rose-200",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-xs font-medium leading-5 whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Card (mirror of primitives.tsx Card) -----------------------------------

export function ClientCard({
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
        className,
      )}
    >
      {children}
    </Tag>
  );
}
