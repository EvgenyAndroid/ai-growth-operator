/**
 * Screen 13 — Activation Status (PRD 13.4: "UI shows activation level used").
 *
 * Lists every activation attempt/success/failure from the Context Ledger,
 * shows which ladder level ran, that Alpha activation is simulated
 * (PRD 25.1), the holdout assignment where one exists, and the per-action
 * audit trail. Also documents the Klaviyo fallback ladder itself, including
 * the 26B.17 Level-1 reality and the 26A.1 measurement downgrade rule.
 */

import Link from "next/link";
import {
  createDemoAccount,
  getActionAudit,
  getLedger,
} from "@/lib/server";
import type { LedgerEntryView } from "@/lib/server/types";
import { ACTIVATION_LEVELS, type ActivationLevel } from "@/lib/contracts";
import {
  ActivationBadge,
  Badge,
  Card,
  EmptyState,
  MeasurementBadge,
  SectionHeading,
} from "@/components/ui/primitives";
import { LedgerTable, PageShell } from "../performance/shared-ui";
import { fmtDateTime, SimulatedBadge } from "../performance/readout-card";
import type { MeasurementMode } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activation Status — AI Growth Operator" };

function isActivationLevel(value: string | null): value is ActivationLevel {
  return value !== null && value in ACTIVATION_LEVELS;
}

function isMeasurementMode(value: string | null): value is MeasurementMode {
  return (
    value === "holdout" ||
    value === "before_after_no_control" ||
    value === "directional"
  );
}

interface ActionActivation {
  actionId: string;
  latest: LedgerEntryView;
  outcome: "launched" | "failed" | "attempted";
  holdout: LedgerEntryView | null;
}

function groupActivations(
  activationEntries: LedgerEntryView[],
  holdoutEntries: LedgerEntryView[],
): ActionActivation[] {
  const holdoutByAction = new Map<string, LedgerEntryView>();
  for (const entry of holdoutEntries) {
    if (entry.actionId && !holdoutByAction.has(entry.actionId)) {
      holdoutByAction.set(entry.actionId, entry);
    }
  }
  const byAction = new Map<string, ActionActivation>();
  // Entries arrive newest-first; keep the first (latest) entry per action.
  for (const entry of activationEntries) {
    if (!entry.actionId || byAction.has(entry.actionId)) continue;
    const outcome =
      entry.eventType === "activation_success"
        ? "launched"
        : entry.eventType === "activation_failure"
          ? "failed"
          : "attempted";
    byAction.set(entry.actionId, {
      actionId: entry.actionId,
      latest: entry,
      outcome,
      holdout: holdoutByAction.get(entry.actionId) ?? null,
    });
  }
  return [...byAction.values()];
}

const LADDER_ROWS: Array<{
  level: string;
  name: string;
  status: string;
  note: string;
}> = [
  {
    level: "Level 1",
    name: "Klaviyo flow draft",
    status: "Unavailable in Alpha",
    note: "Flow-draft creation is not available in the public Klaviyo API at build time (26B.17); the ladder records the attempt and falls through.",
  },
  {
    level: "Level 2",
    name: "Klaviyo campaign draft",
    status: "Launch reality",
    note: "Campaign draft with audience, copy, offer, suppression rules, and recommended timing (PRD 13.1). Holdout exclusion is enforceable at this level.",
  },
  {
    level: "Level 3",
    name: "Exportable brief",
    status: "Fallback",
    note: "First-class deliverable (PRD 13.3). Holdout exclusion cannot be enforced here, so any holdout claim downgrades to before/after, no control group (26A.1).",
  },
  {
    level: "Level 4",
    name: "Manual setup instructions",
    status: "Fallback",
    note: "Step-by-step Klaviyo setup with copy blocks and a testing checklist. Same 26A.1 measurement downgrade applies.",
  },
  {
    level: "Meta",
    name: "Meta audience sync",
    status: "On approval",
    note: "Seed + suppression audiences sync on approval (PRD 13.2). Measurement is always directional — never lift language (PRD 15).",
  },
];

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const account = await createDemoAccount();

  const [activationPage, holdoutPage] = await Promise.all([
    getLedger({
      accountId: account.accountId,
      eventTypes: ["activation_attempt", "activation_success", "activation_failure"],
      limit: 200,
    }),
    getLedger({
      accountId: account.accountId,
      eventTypes: ["holdout_assignment"],
      limit: 200,
    }),
  ]);
  const activations = groupActivations(activationPage.entries, holdoutPage.entries);

  const selectedActionId =
    typeof sp.action === "string" &&
    activations.some((activation) => activation.actionId === sp.action)
      ? sp.action
      : null;
  const audit = selectedActionId
    ? await getActionAudit({ accountId: account.accountId, actionId: selectedActionId })
    : null;

  return (
    <PageShell
      active="activation"
      title="Activation Status"
      subtitle="Which ladder level each approved action ran at. All Alpha activations are simulated against mocked connectors — nothing is sent or synced externally (PRD 25.1)."
      accountName={account.accountName}
      demoMode={account.demoMode}
    >
      <section>
        <SectionHeading
          title="Activated actions"
          subtitle="Draft is not activation — actions appear here only after explicit approval routed through governance (26A.4)."
        />
        {activations.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="Nothing has been activated yet"
            description="Approve a drafted action from the feed to see it here. Approval runs the governance chokepoint, assigns a holdout where eligible, and then walks the simulated activation ladder."
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {activations.map((activation) => (
              <Card key={activation.actionId} as="li">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      activation.outcome === "launched"
                        ? "positive"
                        : activation.outcome === "failed"
                          ? "danger"
                          : "caution"
                    }
                  >
                    {activation.outcome === "launched"
                      ? "Launched"
                      : activation.outcome === "failed"
                        ? "Activation failed"
                        : "Attempted"}
                  </Badge>
                  {isActivationLevel(activation.latest.activationLevel) ? (
                    <ActivationBadge level={activation.latest.activationLevel} />
                  ) : null}
                  <SimulatedBadge />
                  {isMeasurementMode(activation.latest.measurementMode) ? (
                    <MeasurementBadge mode={activation.latest.measurementMode} />
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-stone-700">
                  {activation.latest.reasoningSummary ??
                    activation.latest.actionTaken ??
                    "No summary recorded."}
                </p>
                {activation.holdout ? (
                  <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    <strong>Holdout assigned:</strong>{" "}
                    {activation.holdout.reasoningSummary ??
                      "Randomized customer-level holdout assigned at launch."}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-stone-500">
                  Action <span className="font-mono">{activation.actionId}</span>
                  {activation.latest.destination
                    ? ` · destination: ${activation.latest.destination}`
                    : ""}
                  {activation.latest.constitutionVersion !== null
                    ? ` · Operating Rules v${activation.latest.constitutionVersion}`
                    : ""}
                  {` · ${fmtDateTime(activation.latest.timestamp)}`}
                </p>
                <p className="mt-2 text-xs">
                  <Link
                    className="underline"
                    href={`/activation?action=${activation.actionId}`}
                  >
                    Audit trail
                  </Link>
                  {activation.outcome === "launched" ? (
                    <>
                      {" · "}
                      <Link
                        className="underline"
                        href={`/performance?action=${activation.actionId}`}
                      >
                        Performance summary
                      </Link>
                    </>
                  ) : null}
                </p>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {selectedActionId && audit ? (
        <section>
          <SectionHeading
            title="Audit trail"
            subtitle={
              <>
                Every ledger entry for action{" "}
                <span className="font-mono">{selectedActionId}</span> (PRD 18.4).
              </>
            }
          />
          <div className="mt-3">
            <LedgerTable entries={audit} emptyLabel="No ledger entries for this action." />
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          title="The activation ladder"
          subtitle="Klaviyo fallback levels plus Meta sync (PRD 13). The level actually used is recorded on every activation ledger entry."
        />
        <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
                <th className="px-3 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Activation</th>
                <th className="px-3 py-2 font-semibold">Alpha status</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LADDER_ROWS.map((row) => (
                <tr key={row.level} className="border-b border-stone-100 align-top last:border-b-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-stone-900">
                    {row.level}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-700">{row.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-700">{row.status}</td>
                  <td className="px-3 py-2 text-stone-600">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Measurement rule: holdout-verified claims are only available when the
          activation path can enforce holdout exclusion. Exportable brief and
          manual setup instructions cannot, so those launches downgrade to
          &ldquo;Before/after, no control group&rdquo; (26A.1).
        </p>
      </section>
    </PageShell>
  );
}
