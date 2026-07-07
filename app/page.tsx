/**
 * app/page.tsx — Screen 1: Login / Signup stub (PRD 7.1).
 *
 * There is no real auth in the alpha (PRD 25.1): the only way in is the demo
 * workspace, clearly labeled as such (PRD 20.3). The sign-in form is a
 * disabled stub so the eventual surface is visible without pretending to work.
 */

import { Badge, Card } from "@/components/ui/primitives";
import { enterDemoWorkspace, resetDemoWorkspace } from "./(onboarding)/actions";
import { SubmitButton } from "./(onboarding)/submit-button";

export default function LandingPage() {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      {/* Subtle accent wash that dissolves into the canvas — premium, not loud. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(640px_240px_at_50%_-60px,var(--color-accent-soft),transparent)] opacity-70"
      />
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            MVP v0 alpha
          </p>
          <h1 className="mt-2 text-[2.125rem] font-bold leading-tight tracking-tight text-ink">
            AI Growth Operator
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-ink-secondary">
            An operator, not a dashboard. It finds revenue opportunities in
            your Shopify and Klaviyo data, drafts the action, waits for your
            approval, then measures what actually happened.
          </p>
          <ol className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {["Find money", "Draft", "Approve", "Activate", "Measure", "Learn"].map(
              (step, i) => (
                <li key={step} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span aria-hidden className="text-xs text-ink-soft">
                      &rarr;
                    </span>
                  ) : null}
                  <span
                    className={
                      i === 0
                        ? "rounded-full border border-blue-200 bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-blue-800"
                        : "rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-secondary shadow-card"
                    }
                  >
                    {step}
                  </span>
                </li>
              ),
            )}
          </ol>
          <div className="mt-6 max-w-md rounded-card border border-border border-l-2 border-l-accent bg-surface p-4 shadow-card">
            <p className="text-sm leading-6 text-ink-secondary">
              Measured lift, not vendor math — and when we cannot prove it, we
              say so. Every estimate is a range, every claim carries a
              measurement label, and nothing sends without your approval.
            </p>
          </div>
        </div>

        <Card className="p-6 shadow-card-hover">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Sign in</h2>
            <Badge tone="caution">Alpha — auth stubbed</Badge>
          </div>
          <div className="mt-4 space-y-3" aria-disabled>
            <label className="block text-sm text-ink-muted">
              Work email
              <input
                type="email"
                disabled
                placeholder="you@store.com"
                className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm text-ink-soft placeholder:text-ink-soft"
              />
            </label>
            <label className="block text-sm text-ink-muted">
              Password
              <input
                type="password"
                disabled
                placeholder="Not available in the alpha"
                className="mt-1 w-full rounded-md border border-border bg-surface-soft px-3 py-2 text-sm text-ink-soft placeholder:text-ink-soft"
              />
            </label>
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-border" />
            the alpha runs on simulated data
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={enterDemoWorkspace}>
            <SubmitButton pendingLabel="Seeding demo data…" className="w-full">
              Enter demo workspace
            </SubmitButton>
          </form>
          <form action={resetDemoWorkspace} className="mt-2">
            <SubmitButton
              pendingLabel="Resetting demo data…"
              variant="ghost"
              className="w-full"
            >
              Reset demo data and start over
            </SubmitButton>
          </form>
          <p className="mt-3 text-xs leading-5 text-ink-soft">
            The demo workspace is sample data for a fictional Shopify DTC
            store. No real customer data appears anywhere, and no emails or
            audience syncs are actually sent (PRD demo-mode rules).
          </p>
        </Card>
      </div>
    </div>
  );
}
