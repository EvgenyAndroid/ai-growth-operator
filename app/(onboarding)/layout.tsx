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
      <header className="border-b border-stone-200 bg-white px-6 py-3">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-stone-900"
          >
            AI Growth Operator
          </Link>
          <OnboardingStepper />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
