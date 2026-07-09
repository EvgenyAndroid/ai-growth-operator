/**
 * app/(onboarding)/rules/editor/page.tsx — Screen 4: Operating Rules Editor
 * (PRD 7.1, 12.3). THE THREE NUMBERS are the whole screen: monthly budget
 * cap, maximum discount, daily send cap. Everything else in the template is
 * shown read-only; saving creates a new Operating Rules version.
 */

import { Badge, Card, StatList, StatRow } from "@/components/ui/primitives";
import { ensureDemoAccount, getOperatingRules } from "@/lib/server";
import { RulesEditorForm } from "./rules-editor-form";

// Prefills from the live Operating Rules version — never prerender.
export const dynamic = "force-dynamic";

export default async function OperatingRulesEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const account = await ensureDemoAccount();
  const rules = await getOperatingRules(account.accountId);
  const isLocal = account.vertical === "local_service";
  const templateName = isLocal
    ? "Local café / bakery"
    : template === "beauty_wellness"
      ? "Shopify DTC — beauty / wellness variant"
      : "Shopify DTC";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            Set your three numbers
          </h1>
          <Badge tone="info">{templateName}</Badge>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
          These three numbers are required before anything can launch
          (PRD 12.3). The governance runtime enforces them on every action —
          there is no code path around them.
        </p>
      </div>

      <RulesEditorForm
        accountId={account.accountId}
        defaults={{
          monthlyBudgetCap: rules.monthlyBudgetCap,
          maxDiscountPercent: rules.maxDiscountPercent,
          dailySendCap: rules.dailySendCap,
        }}
      />

      <Card as="section" variant="flat" className="bg-surface-soft/60">
        <h2 className="text-sm font-semibold text-ink">
          Worth knowing for the demo
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          {isLocal
            ? "Local demo audiences are deliberately smaller than 500 identified customers, so holdouts never apply — results are measured before/after with no control group, clearly labeled. If your daily send cap is below a launch audience, governance will block the launch and tell you why."
            : "The demo store’s abandoned-checkout recovery audience is about 600 eligible customers. If your daily send cap is below the launch audience, governance will block the launch and tell you why — set it lower on purpose if you want to watch the guardrail work."}
        </p>
      </Card>

      <Card as="section">
        <h2 className="text-sm font-semibold text-ink">
          The rest of the template (read-only in the alpha)
        </h2>
        <StatList className="mt-2">
          <StatRow
            label="Tone guide"
            value={rules.toneGuide ?? "Template default"}
          />
          <StatRow
            label="Margin floor"
            value={
              rules.marginFloorPercent !== null
                ? `${rules.marginFloorPercent}%`
                : "Not set"
            }
          />
          <StatRow
            label="Banned claims"
            value={`${rules.bannedClaims.length} flagged terms`}
            hint={rules.bannedClaims.join(", ")}
          />
          <StatRow
            label="Current Operating Rules version"
            value={`v${rules.version}`}
          />
        </StatList>
        {rules.bannedClaims.length > 0 ? (
          <>
            <p className="mt-4 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Flagged claims
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {rules.bannedClaims.map((claim) => (
                <li key={claim}>
                  <Badge tone="danger">&ldquo;{claim}&rdquo;</Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {/* Version callout (brief v3 area 8) — saving creates a new version. */}
        <div className="relative mt-4 overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-accent-soft/35 via-surface to-surface p-3 pl-4">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-accent to-accent/25"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">v{rules.version} current</Badge>
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="h-3 w-3 shrink-0 text-ink-soft"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 6h8M7 3l3 3-3 3" />
            </svg>
            <Badge tone="info">v{rules.version + 1} on save</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-secondary">
            Saving creates Operating Rules v{rules.version + 1}; every draft,
            approval, and launch records the version it was checked against.
          </p>
        </div>
      </Card>
    </div>
  );
}
