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
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-4xl gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            MVP v0 alpha
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            AI Growth Operator
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-stone-600">
            An operator, not a dashboard. It finds revenue opportunities in
            your Shopify and Klaviyo data, drafts the action, waits for your
            approval, then measures what actually happened.
          </p>
          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-stone-500">
            {["Find money", "Draft", "Approve", "Activate", "Measure", "Learn"].map(
              (step, i) => (
                <li key={step} className="flex items-center gap-2">
                  {i > 0 ? <span aria-hidden className="text-stone-300">&rarr;</span> : null}
                  <span>{step}</span>
                </li>
              ),
            )}
          </ol>
          <p className="mt-5 max-w-md text-sm leading-6 text-stone-500">
            Measured lift, not vendor math — and when we cannot prove it, we
            say so. Every estimate is a range, every claim carries a
            measurement label, and nothing sends without your approval.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-stone-900">Sign in</h2>
            <Badge tone="caution">Alpha — auth stubbed</Badge>
          </div>
          <div className="mt-4 space-y-3" aria-disabled>
            <label className="block text-sm text-stone-500">
              Work email
              <input
                type="email"
                disabled
                placeholder="you@store.com"
                className="mt-1 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400"
              />
            </label>
            <label className="block text-sm text-stone-500">
              Password
              <input
                type="password"
                disabled
                placeholder="Not available in the alpha"
                className="mt-1 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400"
              />
            </label>
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            the alpha runs on simulated data
            <span className="h-px flex-1 bg-stone-200" />
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
          <p className="mt-3 text-xs leading-5 text-stone-400">
            The demo workspace is sample data for a fictional Shopify DTC
            store. No real customer data appears anywhere, and no emails or
            audience syncs are actually sent (PRD demo-mode rules).
          </p>
        </Card>
      </div>
    </div>
  );
}
