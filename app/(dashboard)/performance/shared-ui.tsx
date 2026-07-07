/**
 * app/(dashboard)/performance/shared-ui.tsx — server-side shared chrome for
 * the Activation / Performance / Ledger / Export / Chat screens.
 *
 * Server components only (imports components/ui/primitives, which pulls
 * lib/contracts at runtime). Client components use readout-card.tsx instead.
 */

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import type { LedgerEntryView } from "@/lib/server/types";
import { fmtDateTime, shortId } from "./readout-card";

export type ScreenKey =
  | "activation"
  | "performance"
  | "ledger"
  | "export"
  | "chat";

const SCREENS: Array<{ key: ScreenKey; href: string; label: string }> = [
  { key: "activation", href: "/activation", label: "Activation" },
  { key: "performance", href: "/performance", label: "Performance" },
  { key: "ledger", href: "/ledger", label: "Ledger" },
  { key: "export", href: "/export", label: "Export" },
  { key: "chat", href: "/chat", label: "Operator Chat" },
];

export function ScreenNav({ active }: { active: ScreenKey }) {
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Operator screens">
      <Link
        href="/"
        className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
      >
        Home
      </Link>
      {SCREENS.map((screen) => (
        <Link
          key={screen.key}
          href={screen.href}
          aria-current={screen.key === active ? "page" : undefined}
          className={
            screen.key === active
              ? "rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-stone-50"
              : "rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          }
        >
          {screen.label}
        </Link>
      ))}
    </nav>
  );
}

export function PageShell({
  active,
  title,
  subtitle,
  accountName,
  demoMode,
  children,
}: {
  active: ScreenKey;
  title: string;
  subtitle?: React.ReactNode;
  accountName: string;
  demoMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <ScreenNav active={active} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">{accountName}</span>
          {demoMode ? (
            // PRD 20.3 — demo mode must be clearly labeled.
            <Badge tone="info" title="Demo workspace — mocked connectors, simulated activation (PRD 25.1).">
              Demo mode
            </Badge>
          ) : null}
        </div>
      </div>
      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      </header>
      <div className="mt-6 space-y-6">{children}</div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// LedgerTable — shared by the Context Ledger screen and per-action audit views
// ---------------------------------------------------------------------------

export function LedgerTable({
  entries,
  emptyLabel = "No ledger entries match this filter.",
}: {
  entries: LedgerEntryView[];
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-stone-500">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
            <th className="px-3 py-2 font-semibold">Timestamp</th>
            <th className="px-3 py-2 font-semibold">Event</th>
            <th className="px-3 py-2 font-semibold">Summary</th>
            <th className="px-3 py-2 font-semibold">Action</th>
            <th className="px-3 py-2 font-semibold">Opportunity</th>
            <th className="px-3 py-2 font-semibold">Rules v</th>
            <th className="px-3 py-2 font-semibold">Confidence</th>
            <th className="px-3 py-2 font-semibold">Measurement</th>
            <th className="px-3 py-2 font-semibold">Destination</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-stone-100 align-top last:border-b-0">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-stone-600">
                {fmtDateTime(entry.timestamp)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <Badge tone={eventTone(entry.eventType)}>{entry.eventType}</Badge>
              </td>
              <td className="max-w-md px-3 py-2 text-stone-700">
                {entry.reasoningSummary ?? entry.actionTaken ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-stone-500" title={entry.actionId ?? undefined}>
                {shortId(entry.actionId)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-stone-500" title={entry.opportunityId ?? undefined}>
                {shortId(entry.opportunityId)}
              </td>
              <td className="px-3 py-2 text-stone-700">
                {entry.constitutionVersion ?? "—"}
              </td>
              <td className="px-3 py-2 text-stone-700">{entry.confidence ?? "—"}</td>
              <td className="px-3 py-2 text-stone-700">{entry.measurementMode ?? "—"}</td>
              <td className="px-3 py-2 text-stone-700">{entry.destination ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function eventTone(
  eventType: LedgerEntryView["eventType"],
): "neutral" | "positive" | "caution" | "info" | "danger" {
  switch (eventType) {
    case "activation_success":
    case "approval":
      return "positive";
    case "activation_failure":
    case "rejection":
      return "danger";
    case "dismissal":
    case "activation_attempt":
      return "caution";
    case "holdout_assignment":
    case "measurement_readback":
    case "performance_summary":
      return "info";
    default:
      return "neutral";
  }
}
