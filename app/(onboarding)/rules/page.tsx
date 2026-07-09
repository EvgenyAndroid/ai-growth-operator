/**
 * app/(onboarding)/rules/page.tsx — Screen 3: Operating Rules Picker
 * (PRD 7.1, 12.2). Vertical-routed (trust rule #10): Shopify DTC accounts see
 * the DTC template plus the beauty / wellness banned-claims variant exactly
 * as before; LOCAL accounts see the Local café / bakery template card.
 *
 * Alpha note: the variant choice is presentation-level. lib/server's
 * saveOperatingRules carries the seeded template's tone guide and banned
 * claims forward; the variant card documents the stricter claim list that
 * governance enforces for regulated categories (PRD 12.6).
 */

import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { ensureDemoAccount, getOperatingRules } from "@/lib/server";

// Reads the live Operating Rules version — never prerender at build time.
export const dynamic = "force-dynamic";

/** PRD 12.6 — extra unsupported-claim flags in the beauty/wellness variant. */
const BEAUTY_WELLNESS_EXTRA_CLAIMS = [
  "prevents",
  "dermatologist-approved",
  "no side effects",
  "scientifically proven",
  "doctor recommended",
];

const LINK_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:bg-primary-hover active:shadow-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function RuleNumbers({
  rules,
}: {
  rules: Awaited<ReturnType<typeof getOperatingRules>>;
}) {
  return (
    <dl className="mt-4 space-y-1 rounded-lg border border-border bg-surface-soft/50 p-3 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Monthly budget cap</dt>
        <dd className="font-medium text-ink tabular-nums">
          ${rules.monthlyBudgetCap.toLocaleString("en-US")}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Maximum discount</dt>
        <dd className="font-medium text-ink tabular-nums">
          {rules.maxDiscountPercent}%
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Daily send cap</dt>
        <dd className="font-medium text-ink tabular-nums">
          {rules.dailySendCap.toLocaleString("en-US")} emails
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Banned claims</dt>
        <dd className="font-medium text-ink tabular-nums">
          {rules.bannedClaims.length} flagged terms
        </dd>
      </div>
    </dl>
  );
}

export default async function OperatingRulesPickerPage() {
  const account = await ensureDemoAccount();
  const rules = await getOperatingRules(account.accountId);
  const isLocal = account.vertical === "local_service";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          Pick your Operating Rules template
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
          Operating Rules are the guardrails every action is checked against
          before anything launches: budgets, discounts, send caps, tone, and
          banned claims. You edit the three key numbers on the next screen.
        </p>
      </div>

      {isLocal ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card as="section" interactive className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                Local café / bakery
              </h2>
              <Badge tone="info">Local pack template</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Sensible defaults for a local food business: modest budget and
              discount ceilings, a small daily send cap sized to a loyalty
              list, a neighborly tone guide, and the standard
              unsupported-claim checks.
            </p>
            <RuleNumbers rules={rules} />
            <div className="mt-auto pt-5">
              <Link
                href="/rules/editor?template=local_service"
                className={`${LINK_BUTTON_CLASSES} w-full`}
              >
                Use Local café / bakery defaults
              </Link>
            </div>
          </Card>

          <Card
            as="section"
            variant="flat"
            className="flex flex-col bg-surface-soft/60"
          >
            <h2 className="text-base font-semibold text-ink">
              How local numbers are counted
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Estimates cover identified (loyalty-matched) customers only —
              every opportunity card and readout states the
              identified-transaction share, and unidentified walk-in sales are
              never counted. Local audiences run smaller than 500, so results
              are measured before/after with no control group, clearly
              labeled — never presented as verified lift.
            </p>
          </Card>
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        <Card as="section" interactive className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              Shopify DTC
            </h2>
            <Badge tone="info">v0 template</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Sensible defaults for a DTC store: discount ceiling, daily send
            cap, suppression defaults, a friendly-direct tone guide, and the
            standard unsupported-claim checks.
          </p>
          <RuleNumbers rules={rules} />
          <div className="mt-auto pt-5">
            <Link
              href="/rules/editor?template=shopify_dtc"
              className={`${LINK_BUTTON_CLASSES} w-full`}
            >
              Use Shopify DTC defaults
            </Link>
          </div>
        </Card>

        <Card as="section" interactive className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              Beauty / wellness variant
            </h2>
            <Badge tone="caution">Stricter claims</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            The same Shopify DTC defaults with a stricter banned-claims list
            for regulated categories. Health-outcome claims are blocked and
            some are non-overrideable.
          </p>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Additional flagged claims
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {BEAUTY_WELLNESS_EXTRA_CLAIMS.map((claim) => (
                <li key={claim}>
                  <Badge tone="danger">&ldquo;{claim}&rdquo;</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-ink-soft">
              &ldquo;Cures&rdquo;, &ldquo;treats disease&rdquo;, and
              unverified &ldquo;FDA-approved&rdquo; block activation and
              cannot be overridden (PRD 12.6).
            </p>
          </div>
          <div className="mt-auto pt-5">
            <Link
              href="/rules/editor?template=beauty_wellness"
              className={`${LINK_BUTTON_CLASSES} w-full`}
            >
              Use beauty / wellness variant
            </Link>
          </div>
        </Card>
      </div>
      )}

      <p className="text-xs leading-5 text-ink-soft">
        Internally these are versioned — every edit creates a new Operating
        Rules version, and every action records the version it was checked
        against. Current version: v{rules.version} ({rules.templateVertical}).
      </p>
    </div>
  );
}
