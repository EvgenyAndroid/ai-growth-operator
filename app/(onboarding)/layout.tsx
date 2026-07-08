/**
 * app/(onboarding)/layout.tsx — shared frame for onboarding screens 2-6:
 * product mark + step progress, centered single-column track (PRD 6.1).
 *
 * Brief v2 §2 "guided product setup": glassy sticky header with the cockpit
 * product mark, refined stepper, calm glowing canvas underneath (the shell
 * applies .bg-app-glow).
 */

import Link from "next/link";
import { OnboardingStepper } from "./stepper";

/** Dependency-free product mark — mirrors the app-shell cockpit mark. */
function ProductMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#3b82f6] to-[#1e40af] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_rgb(2_6_23/0.45)]"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 11.5 6.25 7.5l2.5 2.5L13.5 4.5" />
        <path d="M10.5 4.5h3v3" />
      </svg>
    </span>
  );
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border/90 bg-surface/85 px-6 py-3 shadow-[0_4px_16px_-8px_rgb(15_23_42/0.08)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 rounded-md"
          >
            <ProductMark />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-ink-800">
                AI Growth Operator
              </span>
              <span className="block text-[10px] font-medium tracking-[0.14em] text-ink-soft uppercase">
                Guided setup
              </span>
            </span>
          </Link>
          <OnboardingStepper />
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-ink-soft transition-colors duration-150 hover:text-ink-secondary"
          >
            Exit setup
          </Link>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
