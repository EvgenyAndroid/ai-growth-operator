/**
 * Screen 14 — Performance Summary (PRD 7.5, 26A.2).
 *
 * Default view answers the seven questions, shows exactly ONE measurement
 * label prominently, states the measurement window, renders lift only as a
 * range (holdout mode only), discloses contamination when flagged, and pins
 * the exact PRD 15.3 disclaimer on every directional (Meta) report.
 */

import Link from "next/link";
import { createDemoAccount, getLedger, getPerformance, getPerformanceExamples } from "@/lib/server";
import type { LedgerEntryView, PerformanceView } from "@/lib/server/types";
import type { ContractReadType, MeasurementReadout } from "@/lib/contracts";
import { Card, SectionHeading } from "@/components/ui/primitives";
import { LedgerTable, PageShell } from "./shared-ui";
import {
  CaveatList,
  ConfBadge,
  ContaminationNotice,
  fmtDate,
  fmtLiftPoints,
  fmtMoney,
  MetaDirectionalDisclaimer,
  MetricsTable,
  ModeBadge,
  ReadoutCard,
  shortId,
  SimulatedBadge,
} from "./readout-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Performance Summary — AI Growth Operator" };

const READ_TYPES: ContractReadType[] = ["early", "primary", "long"];

function isReadType(value: string | undefined): value is ContractReadType {
  return value !== undefined && (READ_TYPES as string[]).includes(value);
}

/** Latest activation_success ledger entry per launched action. */
function launchedActions(entries: LedgerEntryView[]): LedgerEntryView[] {
  const byAction = new Map<string, LedgerEntryView>();
  for (const entry of entries) {
    if (entry.actionId && !byAction.has(entry.actionId)) {
      byAction.set(entry.actionId, entry);
    }
  }
  return [...byAction.values()];
}

// ---------------------------------------------------------------------------
// The seven questions (PRD 7.5)
// ---------------------------------------------------------------------------

function QA({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-dotted border-stone-200 py-3 last:border-b-0">
      <h3 className="text-sm font-semibold text-stone-900">{question}</h3>
      <div className="mt-1 text-sm text-stone-700">{children}</div>
    </div>
  );
}

function whatWasMeasured(view: PerformanceView): string {
  const readout = view.readout;
  const windowText = `${readout.window.readType} window (${fmtDate(readout.window.start)} → ${fmtDate(readout.window.end)}, per 26A.2 defaults for this recipe)`;
  switch (readout.mode) {
    case "holdout":
      return `Refund-netted purchase rate of the exposed audience versus a randomized customer-level holdout, over the ${windowText}.`;
    case "before_after_no_control":
      return `Refund-netted purchases and revenue for this audience in the ${windowText}, compared with the equal-length period immediately before launch. There is no control group.`;
    default:
      return `Audience sync status, audience size, match rate, and downstream purchases from the synced audience over the ${windowText} — PRD 15.2 metrics only.`;
  }
}

function holdoutAnswer(readout: MeasurementReadout): React.ReactNode {
  if (readout.mode !== "holdout") {
    return "No. No holdout ran for this action.";
  }
  const eligible = readout.metrics["eligible_audience"];
  const holdoutSize = readout.metrics["holdout_size"];
  return `Yes — a randomized customer-level holdout was assigned at launch (${String(holdoutSize ?? "—")} held out of ${String(eligible ?? "—")} eligible customers).`;
}

function holdoutShowed(readout: MeasurementReadout): React.ReactNode {
  if (readout.mode !== "holdout") return "Not applicable — no holdout ran.";
  if (!readout.lift) {
    return "Lift was not proven on this read: the confidence band includes zero or one measurement arm was empty. We report that plainly rather than claiming impact (PRD 26 DoD #21).";
  }
  const low = readout.metrics["incremental_revenue_low"];
  const high = readout.metrics["incremental_revenue_high"];
  const revenue =
    typeof low === "number" && typeof high === "number"
      ? ` Estimated incremental revenue between ${fmtMoney(low)} and ${fmtMoney(high)} (refund-netted range).`
      : "";
  return (
    <>
      Purchase-rate lift between <strong>{fmtLiftPoints(readout.lift.low)}</strong> and{" "}
      <strong>{fmtLiftPoints(readout.lift.high)}</strong> versus the held-out group
      (a range, never a point estimate — PRD 16.4).{revenue}
    </>
  );
}

function whyNoHoldout(readout: MeasurementReadout): string {
  if (readout.mode === "holdout") return "Not applicable — a holdout ran.";
  if (readout.mode === "directional") {
    return "Meta cannot enforce a customer-level holdout inside the activation path in v0, so no holdout is assigned and no lift claim is made. Meta reporting is always directional.";
  }
  return (
    readout.caveats.find((caveat) =>
      /below the 500|downgrad|activation level|no enforceable holdout/i.test(caveat),
    ) ??
    "No enforceable holdout was available for this launch (audience below 500 or activation level cannot enforce exclusion — PRD 14.2 / 26A.1)."
  );
}

function nextStep(readout: MeasurementReadout, windowInProgress: boolean): string {
  if (windowInProgress) {
    return "This read window has not fully elapsed — wait for it to close and re-read before making scaling decisions.";
  }
  if (readout.mode === "holdout") {
    if (readout.lift && readout.lift.low > 0) {
      return "Lift is proven above zero for this window. Keep the flow running and confirm at the long read before scaling the audience or offer.";
    }
    return "Keep the flow and its holdout running; do not scale spend or deepen discounts on this read. Re-read at the next window.";
  }
  if (readout.mode === "before_after_no_control") {
    return "Treat the change as indicative, not causal. To earn holdout-verified measurement, grow the eligible audience above 500 and keep activation inside the Klaviyo path so exclusion is enforceable (26A.1).";
  }
  return "Watch match rate and downstream purchases as the audience is used in campaigns. Do not treat these figures as lift — Meta measurement stays directional in v0.";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const account = await createDemoAccount();

  const successEntries = await getLedger({
    accountId: account.accountId,
    eventTypes: ["activation_success"],
    limit: 100,
  });
  const actions = launchedActions(successEntries.entries);

  const requestedAction = typeof sp.action === "string" ? sp.action : undefined;
  const selectedActionId =
    (requestedAction && actions.some((entry) => entry.actionId === requestedAction)
      ? requestedAction
      : undefined) ?? actions[0]?.actionId ?? null;
  const readParam = typeof sp.read === "string" ? sp.read : undefined;
  const readType = isReadType(readParam) ? readParam : undefined;

  let view: PerformanceView | null = null;
  let loadError: string | null = null;
  if (selectedActionId) {
    try {
      view = await getPerformance({
        accountId: account.accountId,
        actionId: selectedActionId,
        readType,
      });
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  }

  const examples = await getPerformanceExamples();
  const usedWindow = view?.windows.find((window) => window.used);

  return (
    <PageShell
      active="performance"
      title="Performance Summary"
      subtitle="What happened after activation — with the measurement label, window, and caveats stated on every read (PRD 7.5, 26A.2)."
      accountName={account.accountName}
      demoMode={account.demoMode}
    >
      {actions.length > 0 ? (
        <Card>
          <SectionHeading
            title="Launched actions"
            subtitle="Pick an action to read. Reads are logged to the Context Ledger as measurement_readback events."
          />
          <ul className="mt-3 flex flex-wrap gap-2">
            {actions.map((entry) => (
              <li key={entry.actionId}>
                <Link
                  href={`/performance?action=${entry.actionId}`}
                  className={
                    entry.actionId === selectedActionId
                      ? "inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-3 py-1.5 text-sm font-medium text-stone-50"
                      : "inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  }
                >
                  <span className="font-mono text-xs">{shortId(entry.actionId)}</span>
                  <span>{entry.destination ?? entry.measurementMode ?? "action"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <SectionHeading title="No launched actions yet" />
          <p className="mt-2 text-sm text-stone-600">
            Performance reads become available after an action is approved and
            activated (drafting alone is not activation — 26A.4). Until then,
            the simulated example readouts below show how each of the three
            measurement labels reports.
          </p>
        </Card>
      )}

      {loadError ? (
        <Card>
          <p className="text-sm text-rose-700">{loadError}</p>
        </Card>
      ) : null}

      {view ? (
        <Card as="section">
          {/* ONE measurement label, prominent (PRD 7.5) */}
          <div className="flex flex-wrap items-center gap-2">
            <ModeBadge mode={view.readout.mode} large />
            <ConfBadge level={view.readout.confidence} />
            <SimulatedBadge />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Action <span className="font-mono">{view.actionId}</span> ·{" "}
            {view.actionType} · recipe {view.recipeId} · launched{" "}
            {fmtDate(view.launchedAt)}
          </p>

          {/* 26A.2 — the window is always stated */}
          <div className="mt-4">
            <p className="text-sm font-medium text-stone-900">
              Read window: {view.readout.window.readType},{" "}
              {fmtDate(view.readout.window.start)} →{" "}
              {fmtDate(view.readout.window.end)}
              {usedWindow?.inProgress ? " (still in progress — figures are partial)" : ""}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {view.windows.map((window) => (
                <li key={window.readType}>
                  <Link
                    href={`/performance?action=${view.actionId}&read=${window.readType}`}
                    className={
                      window.used
                        ? "inline-flex items-center gap-1 rounded-full border border-stone-900 bg-stone-900 px-3 py-1 text-xs font-medium text-stone-50"
                        : "inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    }
                  >
                    {window.readType} · {fmtDate(window.start)} → {fmtDate(window.end)}
                    {window.inProgress ? " · in progress" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {view.readout.mode === "directional" ? (
            <MetaDirectionalDisclaimer className="mt-4" />
          ) : null}
          <ContaminationNotice risk={view.readout.contaminationRisk} className="mt-4" />

          {/* The seven questions — PRD 7.5 */}
          <div className="mt-4">
            <QA question="What happened?">{view.readout.summary}</QA>
            <QA question="What was measured?">{whatWasMeasured(view)}</QA>
            <QA question="Was there a holdout?">{holdoutAnswer(view.readout)}</QA>
            <QA question="What did the holdout show?">{holdoutShowed(view.readout)}</QA>
            <QA question="If no holdout, why not?">{whyNoHoldout(view.readout)}</QA>
            <QA question="What is the confidence level?">
              <ConfBadge level={view.readout.confidence} />
            </QA>
            <QA question="What should we do next?">
              {nextStep(view.readout, usedWindow?.inProgress ?? false)}
            </QA>
          </div>

          <SectionHeading title="Metrics" className="mt-6" />
          <MetricsTable metrics={view.readout.metrics} className="mt-2" />
          <SectionHeading title="Caveats" className="mt-6" />
          <CaveatList caveats={view.readout.caveats} className="mt-2" />
          <p className="mt-4 text-xs text-stone-500">
            Full audit trail:{" "}
            <Link className="underline" href={`/activation?action=${view.actionId}`}>
              activation status
            </Link>{" "}
            ·{" "}
            <Link className="underline" href={`/ledger?action=${view.actionId}`}>
              context ledger
            </Link>
          </p>
        </Card>
      ) : null}

      <section>
        <SectionHeading
          title="Example readouts (demo, simulated)"
          subtitle="One example per measurement label (PRD 20.4): holdout-verified, before/after with no control, and directional Meta."
        />
        {view ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">
              Show the three example readouts
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <ReadoutCard readout={examples.holdout} title="Holdout example — abandoned checkout recovery" />
              <ReadoutCard readout={examples.beforeAfterNoControl} title="No-control example — lapsed win-back (audience < 500)" />
              <ReadoutCard readout={examples.directionalMeta} title="Directional example — Meta seed + suppression" />
            </div>
          </details>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <ReadoutCard readout={examples.holdout} title="Holdout example — abandoned checkout recovery" />
            <ReadoutCard readout={examples.beforeAfterNoControl} title="No-control example — lapsed win-back (audience < 500)" />
            <ReadoutCard readout={examples.directionalMeta} title="Directional example — Meta seed + suppression" />
          </div>
        )}
      </section>

      {view ? (
        <section>
          <SectionHeading
            title="Recent measurement reads"
            subtitle="Every performance read is itself ledgered (measurement_readback)."
          />
          <div className="mt-3">
            <RecentReads accountId={account.accountId} actionId={view.actionId} />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

async function RecentReads({
  accountId,
  actionId,
}: {
  accountId: string;
  actionId: string;
}) {
  const page = await getLedger({
    accountId,
    eventTypes: ["measurement_readback"],
    actionId,
    limit: 10,
  });
  return <LedgerTable entries={page.entries} emptyLabel="No measurement reads logged yet." />;
}
