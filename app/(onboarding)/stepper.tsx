"use client";

/**
 * app/(onboarding)/stepper.tsx — linear progress header for onboarding
 * screens 2-6 (PRD 6.1 / 7.1).
 */

import { usePathname } from "next/navigation";

const STEPS: Array<{ label: string; match: (pathname: string) => boolean }> = [
  { label: "Business setup", match: (p) => p.startsWith("/setup") },
  { label: "Rules template", match: (p) => p === "/rules" },
  { label: "Your three numbers", match: (p) => p.startsWith("/rules/editor") },
  { label: "Connect sources", match: (p) => p.startsWith("/connect") },
  { label: "Data readiness", match: (p) => p.startsWith("/readiness") },
];

/** Small check mark for completed steps; decorative only. */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
    </svg>
  );
}

export function OnboardingStepper() {
  const pathname = usePathname();
  const activeIndex = STEPS.findIndex((step) => step.match(pathname));

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      {STEPS.map((step, index) => {
        const state =
          activeIndex === -1
            ? "upcoming"
            : index < activeIndex
              ? "done"
              : index === activeIndex
                ? "active"
                : "upcoming";
        return (
          <li key={step.label} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span
                aria-hidden
                className={
                  state === "done" || state === "active"
                    ? "hidden h-px w-3 bg-gradient-to-r lg:block from-border-strong to-accent/40"
                    : "hidden h-px w-3 bg-border lg:block"
                }
              />
            ) : null}
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={
                state === "active"
                  ? "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(2_6_23/0.35),0_0_0_3px_var(--color-accent-glow)]"
                  : state === "done"
                    ? "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200/70 bg-success-soft/60 px-2 py-0.5 text-xs font-medium text-emerald-800"
                    : "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface/70 px-2 py-0.5 text-xs font-medium text-ink-soft"
              }
            >
              {state === "done" ? <CheckIcon /> : null}
              {index + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
