/**
 * app/page.tsx — Screen 1: Login / Signup stub (PRD 7.1).
 *
 * There is no real auth in the alpha (PRD 25.1): the only way in is the demo
 * workspace, clearly labeled as such (PRD 20.3). The sign-in form is a
 * disabled stub so the eventual surface is visible without pretending to work.
 *
 * Brief v3 area 1 "login = launch-quality product narrative" (supersedes v2
 * §1): orbit atmosphere (applied by the shell), designed loop pills with
 * connectors + light dimensionality, a mini Opportunity-Feed preview card so
 * the left side sells the product, an elevated premium sign-in card, and the
 * trust callout with an accent rail + soft glow. Copy is byte-identical to
 * round 1 except the new preview-card copy (additive only).
 */

// Prerendered pages get s-maxage=1y at the edge and Workers deploys do not
// purge the zone cache — render dynamically so deploys are visible immediately.
export const dynamic = "force-dynamic";

import { Badge, Card, MeasurementBadge } from "@/components/ui/primitives";
import { enterDemoWorkspace, resetDemoWorkspace } from "./(onboarding)/actions";
import { SubmitButton } from "./(onboarding)/submit-button";

/** Dependency-free product mark — mirrors the app-shell cockpit mark. */
function ProductMark() {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#1e40af] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_rgb(2_6_23/0.45)]"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
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

const LOOP_STEPS = [
  "Find money",
  "Draft",
  "Approve",
  "Activate",
  "Measure",
  "Learn",
];

export default function LandingPage() {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
      {/* Layered accent glow that dissolves into the canvas — premium, not loud. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(820px_320px_at_42%_-80px,var(--color-accent-glow),transparent_72%),radial-gradient(640px_280px_at_78%_-60px,rgb(15_23_42/0.05),transparent_70%)] opacity-80"
      />
      <div className="grid w-full max-w-5xl gap-10 md:grid-cols-[1.25fr_1fr] md:items-center">
        <div>
          {/* Wordmark row */}
          <div className="flex items-center gap-3">
            <ProductMark />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-soft uppercase">
              MVP v0 alpha
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 md:text-[2.75rem]">
            AI Growth Operator
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-ink-secondary">
            An operator, not a dashboard. It finds revenue opportunities in
            your Shopify and Klaviyo data, drafts the action, waits for your
            approval, then measures what actually happened.
          </p>
          <ol className="mt-7 flex flex-wrap items-center gap-x-1 gap-y-2">
            {LOOP_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-1">
                {i > 0 ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 10 10"
                    className="h-2 w-2 shrink-0 text-ink-soft/70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.5 1.5 7 5 3.5 8.5" />
                  </svg>
                ) : null}
                {/* Same paddings/text size as round 1 — the six chips must
                    keep fitting ONE row at desktop (~436px used of ~546px);
                    dimensionality comes from gradients + hover lift only. */}
                <span
                  className={
                    i === 0
                      ? "whitespace-nowrap rounded-full border border-accent/40 bg-gradient-to-b from-accent-soft/80 to-accent-soft/45 px-2 py-0.5 text-xs font-semibold text-accent-hover shadow-[0_1px_1px_rgb(15_23_42/0.05),0_2px_8px_-2px_var(--color-accent-glow)] transition-[box-shadow,translate,border-color] duration-150 ease-out hover:-translate-y-px hover:border-accent/60 hover:shadow-[0_1px_1px_rgb(15_23_42/0.05),0_4px_12px_-2px_var(--color-accent-glow)]"
                      : "whitespace-nowrap rounded-full border border-border bg-gradient-to-b from-surface to-surface-soft/70 px-2 py-0.5 text-xs font-medium text-ink-secondary shadow-[0_1px_1px_rgb(15_23_42/0.05)] transition-[box-shadow,translate,border-color] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-[0_2px_6px_rgb(15_23_42/0.08)]"
                  }
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {/* Mini Opportunity-Feed preview — the product narrative object:
              what a verified opportunity looks like once the loop has run.
              Emerald top rail + glow are the holdout-verified treatment. */}
          <div className="glow-verified relative mt-7 max-w-md overflow-hidden rounded-card border border-emerald-200/70 bg-surface p-4">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-500/80 via-emerald-400/45 to-transparent"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-soft uppercase">
                Opportunity feed — preview
              </span>
              <MeasurementBadge mode="holdout" />
            </div>
            <p className="mt-2 text-sm font-semibold tracking-tight text-ink-800">
              Recover abandoned checkouts
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900 tabular-nums">
              $2,100–$4,200
              <span className="ml-1.5 align-baseline text-xs font-medium tracking-normal text-ink-soft">
                est. / month
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-5 text-ink-muted">
              Net of what your current flows already catch — measured against a
              held-out control group after you approve.
            </p>
          </div>
          {/* Trust callout — accent rail, quiet gradient tint, soft glow. */}
          <div className="relative mt-4 max-w-md overflow-hidden rounded-card border border-accent/25 bg-gradient-to-br from-accent-soft/30 via-surface to-surface p-4 pl-5 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_28px_-10px_var(--color-accent-glow)]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-accent to-accent/25"
            />
            <p className="text-sm leading-6 text-ink-secondary">
              Measured lift, not vendor math — and when we cannot prove it, we
              say so. Every estimate is a range, every claim carries a
              measurement label, and nothing sends without your approval.
            </p>
          </div>
        </div>

        {/* Sign-in card — premium tier: blue->emerald gradient border-box +
            deep soft elevation (.card-premium, brief v3). */}
        <Card variant="premium" className="p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink-800">
              Sign in
            </h2>
            <Badge tone="caution">Alpha — auth stubbed</Badge>
          </div>
          <div className="mt-4 space-y-3" aria-disabled>
            <label className="block text-sm text-ink-muted">
              Work email
              <input
                type="email"
                disabled
                placeholder="you@store.com"
                className="mt-1 w-full rounded-md border border-border bg-surface-soft/70 px-3 py-2 text-sm text-ink-soft shadow-[inset_0_1px_2px_rgb(15_23_42/0.03)] placeholder:text-ink-soft"
              />
            </label>
            <label className="block text-sm text-ink-muted">
              Password
              <input
                type="password"
                disabled
                placeholder="Not available in the alpha"
                className="mt-1 w-full rounded-md border border-border bg-surface-soft/70 px-3 py-2 text-sm text-ink-soft shadow-[inset_0_1px_2px_rgb(15_23_42/0.03)] placeholder:text-ink-soft"
              />
            </label>
          </div>
          <div className="my-5 flex items-center gap-3 text-[11px] font-medium tracking-wide text-ink-soft uppercase">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border-strong to-border-strong" />
            the alpha runs on simulated data
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border-strong to-border-strong" />
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
