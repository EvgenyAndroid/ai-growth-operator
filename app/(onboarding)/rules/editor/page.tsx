/**
 * app/(onboarding)/rules/editor/page.tsx — Screen 4: Operating Rules Editor
 * (PRD 7.1, 12.3). THE THREE NUMBERS are the whole screen: monthly budget
 * cap, maximum discount, daily send cap. Everything else in the template is
 * shown read-only; saving creates a new Operating Rules version.
 */

import { Badge, Card, StatList, StatRow } from "@/components/ui/primitives";
import { createDemoAccount, getOperatingRules } from "@/lib/server";
import { RulesEditorForm } from "./rules-editor-form";

// Prefills from the live Operating Rules version — never prerender.
export const dynamic = "force-dynamic";

export default async function OperatingRulesEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const account = await createDemoAccount();
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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Set your three numbers
          </h1>
          <Badge tone="info">{templateName}</Badge>
        </div>
        <p className="mt-1 text-sm text-stone-500">
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

      <Card as="section" className="bg-stone-50">
        <h2 className="text-sm font-semibold text-stone-900">
          Worth knowing for the demo
        </h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          {isLocal
            ? "Local demo audiences are deliberately smaller than 500 identified customers, so holdouts never apply — results are measured before/after with no control group, clearly labeled. If your daily send cap is below a launch audience, governance will block the launch and tell you why."
            : "The demo store’s abandoned-checkout recovery audience is about 600 eligible customers. If your daily send cap is below the launch audience, governance will block the launch and tell you why — set it lower on purpose if you want to watch the guardrail work."}
        </p>
      </Card>

      <Card as="section">
        <h2 className="text-sm font-semibold text-stone-900">
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
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {rules.bannedClaims.map((claim) => (
              <li key={claim}>
                <Badge tone="danger">&ldquo;{claim}&rdquo;</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-stone-400">
          Saving creates Operating Rules v{rules.version + 1}; every draft,
          approval, and launch records the version it was checked against.
        </p>
      </Card>
    </div>
  );
}
