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
import {
  Card,
  MeasurementLegend,
  MetricTile,
  ProofRail,
  SectionHeading,
  StatusDot,
} from "@/components/ui/primitives";
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
  READOUT_ACCENT,
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

function QA({
  question,
  children,
  highlight = false,
}: {
  question: string;
  children: React.ReactNode;
  /** Next-action treatment (brief v3 area 7): accent callout, not a list row. */
  highlight?: boolean;
}) {
  if (highlight) {
    // Next-action panel (brief v4 performance area): a proof-toned callout
    // that reads as the cockpit's "what now", not another list row.
    return (
      <div className="mt-4 rounded-lg border border-blue-200/70 border-l-2 border-l-accent bg-gradient-to-br from-blue-50/70 via-white to-emerald-50/40 px-4 py-3 shadow-[0_10px_28px_-12px_var(--glow-proof)]">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <StatusDot tone="proof" />
          {question}
        </h3>
        <div className="mt-1 text-sm text-ink-secondary">{children}</div>
      </div>
    );
  }
  return (
    <div className="border-b border-dotted border-border py-3 last:border-b-0">
      <h3 className="text-sm font-semibold text-ink">{question}</h3>
      <div className="mt-1 text-sm text-ink-secondary">{children}</div>
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
// Proof-led hero pieces (brief v4 performance area) — purely presentational
// derivations of metrics the MetricsTable below already lists in full.
// ---------------------------------------------------------------------------

/**
 * Prominent revenue range — holdout mode with proven lift only. Renders the
 * refund-netted incremental-revenue range big and tabular; never a point
 * estimate, never on before/after or directional reads.
 */
function RangeHero({ readout }: { readout: MeasurementReadout }) {
  if (readout.mode !== "holdout" || !readout.lift) return null;
  const low = readout.metrics["incremental_revenue_low"];
  const high = readout.metrics["incremental_revenue_high"];
  if (typeof low !== "number" || typeof high !== "number") return null;
  return (
    <div className="mt-5 rounded-xl border border-emerald-200/70 bg-[image:var(--surface-money)] px-4 py-4 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_16px_40px_-12px_var(--glow-money)]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-emerald-800 uppercase">
        Estimated incremental revenue
      </p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-4xl">
        {fmtMoney(low)}
        <span className="mx-1.5 text-xl font-medium text-ink-soft sm:text-2xl">–</span>
        {fmtMoney(high)}
      </p>
      <p className="mt-1.5 max-w-xl text-xs leading-5 text-ink-muted">
        Refund-netted range for this read window — reported as a range, never a
        point estimate (PRD 16.4). Purchase-rate lift{" "}
        {fmtLiftPoints(readout.lift.low)} to {fmtLiftPoints(readout.lift.high)}{" "}
        versus the held-out group.
      </p>
    </div>
  );
}

/** Eligible / exposed / holdout stat tiles (holdout mode only). */
function AudienceTiles({ metrics }: { metrics: Record<string, number | string> }) {
  const eligible = metrics["eligible_audience"];
  const exposed = metrics["exposed_audience"];
  const holdout = metrics["holdout_size"];
  if (
    typeof eligible !== "number" ||
    typeof exposed !== "number" ||
    typeof holdout !== "number"
  ) {
    return null;
  }
  return (
    <div className="mt-4 grid max-w-2xl grid-cols-3 gap-2.5">
      <MetricTile
        label="Eligible"
        value={eligible.toLocaleString("en-US")}
        hint="audience in scope"
      />
      <MetricTile
        label="Exposed"
        value={exposed.toLocaleString("en-US")}
        hint="measured arm"
      />
      <MetricTile
        label="Holdout"
        value={holdout.toLocaleString("en-US")}
        hint="control arm"
        tone="money"
      />
    </div>
  );
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
                      ? "inline-flex items-center gap-2 rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)]"
                      : "inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary shadow-xs transition-colors duration-150 hover:border-slate-300 hover:bg-surface-soft hover:text-ink"
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
          <p className="mt-2 text-sm text-ink-muted">
            Performance reads become available after an action is approved and
            activated (drafting alone is not activation — 26A.4). Until then,
            the simulated example readouts below show how each of the three
            measurement labels reports.
          </p>
          <div className="mt-4 border-t border-dotted border-border pt-3">
            <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
              Measurement legend
            </p>
            <MeasurementLegend className="mt-2.5" />
          </div>
        </Card>
      )}

      {loadError ? (
        <Card>
          <p className="text-sm text-danger">{loadError}</p>
        </Card>
      ) : null}

      {view ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_16.5rem]">
        <Card
          as="section"
          variant="flat"
          // Authority hierarchy at card level (brief v3 area 7): the live
          // holdout-verified read carries the emerald rail + verified glow
          // (composed directly so the utility-layer shadow in READOUT_ACCENT
          // cannot override .glow-verified); the other two modes rest on the
          // plain card shadow and never look as strong.
          className={
            view.readout.mode === "holdout"
              ? "border-t-2 border-t-success glow-verified"
              : `${READOUT_ACCENT[view.readout.mode]} shadow-card`
          }
        >
          {/* ONE measurement label, prominent (PRD 7.5) */}
          <div className="flex flex-wrap items-center gap-2">
            <ModeBadge mode={view.readout.mode} large />
            <ConfBadge level={view.readout.confidence} />
            <SimulatedBadge />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Action <span className="break-all font-mono">{view.actionId}</span> ·{" "}
            {view.actionType} · recipe {view.recipeId} · launched{" "}
            {fmtDate(view.launchedAt)}
          </p>

          {/* 26A.2 — the window is always stated */}
          <div className="mt-4">
            <p className="text-sm font-medium text-ink">
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
                        ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)]"
                        : "inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-ink-muted shadow-xs transition-colors duration-150 hover:border-slate-300 hover:bg-surface-soft hover:text-ink"
                    }
                  >
                    {window.readType} · {fmtDate(window.start)} → {fmtDate(window.end)}
                    {window.inProgress ? " · in progress" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Proof-led hero: prominent revenue range, then the
              eligible / exposed / holdout stat tiles (holdout mode only) */}
          <RangeHero readout={view.readout} />
          {view.readout.mode === "holdout" ? (
            <AudienceTiles metrics={view.readout.metrics} />
          ) : null}

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
            <QA question="What should we do next?" highlight>
              {nextStep(view.readout, usedWindow?.inProgress ?? false)}
            </QA>
          </div>

          <SectionHeading title="Metrics" className="mt-6" />
          <MetricsTable metrics={view.readout.metrics} className="mt-2" />
          <SectionHeading title="Caveats" className="mt-6" />
          <CaveatList caveats={view.readout.caveats} className="mt-2" />
          <p className="mt-4 text-xs text-ink-soft">
            Full audit trail:{" "}
            <Link
              className="font-medium text-accent underline underline-offset-2 transition-colors duration-150 hover:text-accent-hover"
              href={`/activation?action=${view.actionId}`}
            >
              activation status
            </Link>{" "}
            ·{" "}
            <Link
              className="font-medium text-accent underline underline-offset-2 transition-colors duration-150 hover:text-accent-hover"
              href={`/ledger?action=${view.actionId}`}
            >
              context ledger
            </Link>
          </p>
        </Card>
        {/* Presentational proof rail — seats the measurement legend on the
            performance screen (brief v4 measurement system). */}
        <div className="space-y-4">
          <aside className="proof-card rounded-card p-4">
            <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
              Proof rail
            </p>
            <ProofRail active={3} className="mt-2" />
            <p className="mt-2 text-[11px] leading-4 text-ink-muted">
              This action ran the full loop — found, drafted, approved by you,
              measured — with every step logged to the Context Ledger.
            </p>
          </aside>
          <aside className="rounded-card border border-border bg-surface p-4 shadow-card">
            <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-soft uppercase">
              Measurement legend
            </p>
            <MeasurementLegend className="mt-2.5" />
          </aside>
        </div>
        </div>
      ) : null}

      <section>
        <SectionHeading
          title="Example readouts (demo, simulated)"
          subtitle="One example per measurement label (PRD 20.4): holdout-verified, before/after with no control, and directional Meta."
        />
        {view ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-secondary transition-colors duration-150 hover:text-ink">
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
