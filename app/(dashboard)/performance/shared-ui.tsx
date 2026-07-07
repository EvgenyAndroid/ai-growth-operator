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
import { fmtDateTime } from "./readout-card";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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

const SCREEN_LINK_IDLE =
  "rounded-md px-2.5 py-1 text-[13px] font-medium text-ink-muted " +
  "transition-colors duration-150 hover:bg-neutral-soft hover:text-ink";

const SCREEN_LINK_ACTIVE =
  "rounded-md bg-primary px-2.5 py-1 text-[13px] font-semibold text-white shadow-sm";

export function ScreenNav({ active }: { active: ScreenKey }) {
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Operator screens">
      <Link href="/" className={SCREEN_LINK_IDLE}>
        Home
      </Link>
      {SCREENS.map((screen) => (
        <Link
          key={screen.key}
          href={screen.href}
          aria-current={screen.key === active ? "page" : undefined}
          className={screen.key === active ? SCREEN_LINK_ACTIVE : SCREEN_LINK_IDLE}
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
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <ScreenNav active={active} />
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink-secondary">
            {accountName}
          </span>
          {demoMode ? (
            // PRD 20.3 — demo mode must be clearly labeled.
            <Badge tone="info" title="Demo workspace — mocked connectors, simulated activation (PRD 25.1).">
              Demo mode
            </Badge>
          ) : null}
        </div>
      </div>
      <header className="mt-6">
        <h1 className="text-[1.75rem] leading-9 font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div className="mt-8 space-y-8">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LedgerTable — shared by the Context Ledger screen and per-action audit views.
// Audit-grade timeline rows: timestamp + event + summary at a glance, with the
// full record (IDs, rules version, confidence, measurement, destination) in an
// expandable detail per row.
// ---------------------------------------------------------------------------

function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </dt>
      <dd
        className={cx(
          "mt-0.5 break-words text-ink-secondary",
          mono ? "font-mono text-xs leading-5" : "text-sm"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function LedgerTable({
  entries,
  emptyLabel = "No ledger entries match this filter.",
}: {
  entries: LedgerEntryView[];
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border-strong bg-surface-soft/60 py-6 text-center text-sm text-ink-muted">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ol className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {entries.map((entry) => {
        const tone = eventTone(entry.eventType);
        return (
          <li key={entry.id} className="border-b border-border last:border-b-0">
            <details className="group">
              <summary
                className={cx(
                  "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
                  "transition-colors duration-150 hover:bg-surface-soft/70",
                  "[&::-webkit-details-marker]:hidden"
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="h-3 w-3 shrink-0 text-ink-soft transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4.5 2.5L8 6l-3.5 3.5" />
                </svg>
                <span
                  aria-hidden="true"
                  className={cx("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
                />
                <span className="font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums">
                  {fmtDateTime(entry.timestamp)}
                </span>
                <Badge tone={tone}>{entry.eventType}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                  {entry.reasoningSummary ?? entry.actionTaken ?? "—"}
                </span>
                {entry.constitutionVersion !== null ? (
                  <span className="hidden shrink-0 text-xs text-ink-soft tabular-nums sm:inline">
                    v{entry.constitutionVersion}
                  </span>
                ) : null}
              </summary>
              <dl className="grid gap-x-6 gap-y-3 border-t border-dotted border-border bg-surface-soft/50 px-4 py-3 pl-10 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField
                  label="Summary"
                  value={entry.reasoningSummary ?? entry.actionTaken ?? "—"}
                  className="sm:col-span-2 lg:col-span-3"
                />
                <DetailField label="Timestamp" mono value={fmtDateTime(entry.timestamp)} />
                <DetailField label="Event" value={entry.eventType} />
                <DetailField
                  label="Rules v"
                  value={entry.constitutionVersion ?? "—"}
                />
                <DetailField label="Action" mono value={entry.actionId ?? "—"} />
                <DetailField
                  label="Opportunity"
                  mono
                  value={entry.opportunityId ?? "—"}
                />
                <DetailField label="Confidence" value={entry.confidence ?? "—"} />
                <DetailField
                  label="Measurement"
                  value={entry.measurementMode ?? "—"}
                />
                <DetailField label="Destination" value={entry.destination ?? "—"} />
              </dl>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

type EventTone = "neutral" | "positive" | "caution" | "info" | "danger";

/** Timeline dot color per event tone — muted, audit-grade, not loud. */
const TONE_DOT: Record<EventTone, string> = {
  neutral: "bg-border-strong",
  positive: "bg-success",
  caution: "bg-warning",
  info: "bg-info",
  danger: "bg-danger",
};

function eventTone(eventType: LedgerEntryView["eventType"]): EventTone {
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
