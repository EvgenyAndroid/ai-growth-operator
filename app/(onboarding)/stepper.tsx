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

export function OnboardingStepper() {
  const pathname = usePathname();
  const activeIndex = STEPS.findIndex((step) => step.match(pathname));

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <li key={step.label} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="h-px w-4 bg-stone-300" />
            ) : null}
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={
                state === "active"
                  ? "rounded-full bg-stone-900 px-2.5 py-0.5 text-xs font-semibold text-stone-50"
                  : state === "done"
                    ? "rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600"
                    : "rounded-full border border-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-400"
              }
            >
              {index + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
