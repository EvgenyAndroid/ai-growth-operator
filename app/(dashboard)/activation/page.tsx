/**
 * Screen 13 — Activation Status (PRD 13.4: "UI shows activation level used").
 *
 * Lists every activation attempt/success/failure from the Context Ledger,
 * shows which ladder level ran, that Alpha activation is simulated
 * (PRD 25.1), the holdout assignment where one exists, and the per-action
 * audit trail. Also documents the Klaviyo fallback ladder itself, including
 * the 26B.17 Level-1 reality and the 26A.1 measurement downgrade rule.
 */

import * as React from "react";
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
  StatusDot,
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

// ---------------------------------------------------------------------------
// Activation progress timeline (design brief v2 §8) — a stepper over the
// EXISTING lifecycle facts only: every action listed here was drafted and
// routed through the governance chokepoint before activation (26A.4), the
// holdout node reflects whether a holdout_assignment ledger entry exists, and
// the final node reflects the recorded activation outcome. No invented states.
// ---------------------------------------------------------------------------

type StepState = "done" | "skipped" | "failed" | "pending";

const STEP_DOT: Record<StepState, string> = {
  done: "bg-success ring-4 ring-emerald-100 shadow-[0_0_8px_rgb(16_185_129/0.45)]",
  skipped: "border border-border-strong bg-surface ring-4 ring-surface-soft",
  failed: "bg-danger ring-4 ring-red-100 shadow-[0_0_8px_rgb(220_38_38/0.35)]",
  pending:
    "bg-warning ring-4 ring-amber-100 shadow-[0_0_8px_rgb(217_119_6/0.35)]",
};

const STEP_LABEL: Record<StepState, string> = {
  done: "text-ink",
  skipped: "text-ink-soft",
  failed: "text-red-700",
  pending: "text-amber-800",
};

/** Connecting line out of a step — completed segments read as progress. */
const STEP_LINE: Record<StepState, string> = {
  done: "bg-gradient-to-r from-emerald-300/80 via-emerald-200/60 to-border",
  skipped: "bg-border",
  failed: "bg-gradient-to-r from-red-300/70 to-border",
  pending: "bg-gradient-to-r from-amber-300/70 to-border",
};

function TimelineStep({
  state,
  label,
  detail,
  last,
}: {
  state: StepState;
  label: string;
  detail?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="flex min-w-0 flex-1 items-start gap-2">
      <span className="flex flex-col items-center self-stretch">
        <span
          aria-hidden="true"
          className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", STEP_DOT[state])}
        />
      </span>
      <span className="min-w-0">
        <span
          className={cx(
            "block text-[11px] font-semibold tracking-wide uppercase",
            STEP_LABEL[state]
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
            {detail}
          </span>
        ) : null}
      </span>
      {!last ? (
        <span
          aria-hidden="true"
          className={cx(
            "mx-1 mt-2 hidden h-px min-w-4 flex-1 sm:block",
            STEP_LINE[state]
          )}
        />
      ) : null}
    </li>
  );
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function ActivationTimeline({ activation }: { activation: ActionActivation }) {
  const { latest, holdout, outcome } = activation;
  const pushedState: StepState =
    outcome === "launched" ? "done" : outcome === "failed" ? "failed" : "pending";
  return (
    <div className="mt-3">
      {/* Launch-sequence micro-label (brief v4 activation area). The dot is
          decorative; the outcome is always named in the Badge above. */}
      <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
        <StatusDot tone={outcome === "launched" ? "money" : "warning"} />
        Launch sequence
      </p>
      {/* Blueprint grid texture: the timeline reads as cockpit telemetry. */}
      <ol className="mt-1.5 flex flex-col gap-2 rounded-lg border border-border bg-surface-soft/50 grid-texture px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] sm:flex-row sm:items-start sm:gap-0">
      <TimelineStep state="done" label="Draft prepared" detail="Approved by you" />
      <TimelineStep
        state="done"
        label="Governance checked"
        detail={
          latest.constitutionVersion !== null
            ? `Operating Rules v${latest.constitutionVersion}`
            : "Chokepoint passed"
        }
      />
      <TimelineStep
        state={holdout ? "done" : "skipped"}
        label={holdout ? "Holdout assigned" : "No holdout"}
        detail={holdout ? "Randomized at launch" : "None assigned at launch"}
      />
      <TimelineStep
        state={pushedState}
        label={
          outcome === "launched"
            ? "Pushed"
            : outcome === "failed"
              ? "Push failed"
              : "Push attempted"
        }
        detail={
          isActivationLevel(latest.activationLevel) ? (
            <ActivationBadge level={latest.activationLevel} className="mt-0.5" />
          ) : undefined
        }
        last
      />
      </ol>
    </div>
  );
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
              <Card
                key={activation.actionId}
                as="li"
                interactive
                className={cx(
                  "border-l-2",
                  activation.outcome === "launched"
                    ? "border-l-success"
                    : activation.outcome === "failed"
                      ? "border-l-danger"
                      : "border-l-warning"
                )}
              >
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
                  <SimulatedBadge />
                  {isMeasurementMode(activation.latest.measurementMode) ? (
                    <MeasurementBadge mode={activation.latest.measurementMode} />
                  ) : null}
                </div>
                <ActivationTimeline activation={activation} />
                <p className="mt-2 text-sm text-ink-secondary">
                  {activation.latest.reasoningSummary ??
                    activation.latest.actionTaken ??
                    "No summary recorded."}
                </p>
                {activation.holdout ? (
                  <p className="mt-2 rounded-md border border-blue-200 border-l-2 border-l-info bg-info-soft/60 px-3 py-2 text-sm text-blue-900 shadow-[inset_0_1px_6px_rgb(37_99_235/0.06)]">
                    <strong>Holdout assigned:</strong>{" "}
                    {activation.holdout.reasoningSummary ??
                      "Randomized customer-level holdout assigned at launch."}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-ink-soft">
                  Action <span className="break-all font-mono">{activation.actionId}</span>
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
                    className="font-medium text-accent underline underline-offset-2 transition-colors duration-150 hover:text-accent-hover"
                    href={`/activation?action=${activation.actionId}`}
                  >
                    Audit trail
                  </Link>
                  {activation.outcome === "launched" ? (
                    <>
                      {" · "}
                      <Link
                        className="font-medium text-accent underline underline-offset-2 transition-colors duration-150 hover:text-accent-hover"
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
                <span className="break-all font-mono">{selectedActionId}</span> (PRD 18.4).
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
        <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface shadow-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-soft/70 text-xs tracking-wide text-ink-soft uppercase">
                <th className="px-3 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Activation</th>
                <th className="px-3 py-2 font-semibold">Alpha status</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {LADDER_ROWS.map((row) => (
                <tr
                  key={row.level}
                  className={cx(
                    "border-b border-border align-top transition-colors duration-150 last:border-b-0",
                    // Controlled-delivery treatment: the launch-reality level
                    // reads live (emerald rail), the unavailable level reads
                    // parked, and Meta keeps the directional (violet) hue —
                    // never as strong as the verified path.
                    row.status === "Launch reality"
                      ? "bg-success-soft/30"
                      : row.status === "Unavailable in Alpha"
                        ? "bg-surface-soft/40"
                        : "hover:bg-surface-soft/50"
                  )}
                >
                  <td
                    className={cx(
                      "border-l-2 px-3 py-2 whitespace-nowrap",
                      row.status === "Launch reality"
                        ? "border-l-success"
                        : row.level === "Meta"
                          ? "border-l-violet-200"
                          : "border-l-transparent"
                    )}
                  >
                    <span
                      className={cx(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium",
                        row.status === "Launch reality"
                          ? "border-emerald-200 bg-success-soft/70 text-emerald-800"
                          : "border-border bg-surface text-ink-secondary"
                      )}
                    >
                      {row.level}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-ink">
                    {row.name}
                  </td>
                  <td
                    className={cx(
                      "px-3 py-2 whitespace-nowrap",
                      row.status === "Launch reality"
                        ? "font-medium text-emerald-700"
                        : row.status === "Unavailable in Alpha"
                          ? "text-ink-soft"
                          : "text-ink-secondary"
                    )}
                  >
                    {row.status}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Measurement rule: holdout-verified claims are only available when the
          activation path can enforce holdout exclusion. Exportable brief and
          manual setup instructions cannot, so those launches downgrade to
          &ldquo;Before/after, no control group&rdquo; (26A.1).
        </p>
      </section>
    </PageShell>
  );
}
