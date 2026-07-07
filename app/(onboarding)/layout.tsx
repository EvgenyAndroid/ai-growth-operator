/**
 * app/(onboarding)/layout.tsx — shared frame for onboarding screens 2-6:
 * product mark + step progress, centered single-column track (PRD 6.1).
 */

import Link from "next/link";
import { OnboardingStepper } from "./stepper";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-ink"
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            AI Growth Operator
          </Link>
          <OnboardingStepper />
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
