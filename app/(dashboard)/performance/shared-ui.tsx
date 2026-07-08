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
  "whitespace-nowrap rounded-md px-2 py-1 text-[13px] font-medium text-ink-muted " +
  "transition-colors duration-150 hover:bg-neutral-soft hover:text-ink";

const SCREEN_LINK_ACTIVE =
  "whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[13px] font-semibold text-white " +
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35),0_0_16px_var(--glow-blue)]";

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
        {/* Page title 34-42px (brief v3 §Typography) */}
        <h1 className="text-[2.125rem] leading-[2.6rem] font-bold tracking-tight text-ink-900">
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
    <>
      {/* Smooth ledger expand (brief v3 area 9) — CSS-only; the global
          reduced-motion kill-switch in globals.css disables it. */}
      <style>{`@keyframes ledger-reveal{from{opacity:0;transform:translateY(-3px)}}.ledger-reveal{animation:ledger-reveal .18s ease-out both}`}</style>
    <ol className="relative overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {/* Audit-timeline spine: a hairline rail the event dots sit on,
          fading out at both ends. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 bottom-3 left-[19.5px] w-px bg-gradient-to-b from-transparent via-border-strong/80 to-transparent"
      />
      {entries.map((entry, index) => {
        const tone = eventTone(entry.eventType);
        // Subtle day grouping: a quiet mono date row whenever the day changes.
        const day = entry.timestamp.slice(0, 10);
        const previousDay =
          index > 0 ? entries[index - 1].timestamp.slice(0, 10) : null;
        return (
          <React.Fragment key={entry.id}>
            {day !== previousDay ? (
              <li className="border-b border-border bg-surface-soft/60 px-4 py-1 pl-10 font-mono text-[10px] font-medium tracking-wider text-ink-soft uppercase tabular-nums">
                {day}
              </li>
            ) : null}
            <li className="border-b border-border last:border-b-0">
            <details className="group">
              <summary
                className={cx(
                  "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5",
                  "transition-colors duration-150 hover:bg-surface-soft/70",
                  "[&::-webkit-details-marker]:hidden"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "relative z-[1] h-2 w-2 shrink-0 rounded-full ring-4 ring-surface",
                    TONE_DOT[tone]
                  )}
                />
                <span className="font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums">
                  {fmtDateTime(entry.timestamp)}
                </span>
                <Badge tone={tone}>{entry.eventType}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                  {entry.reasoningSummary ?? entry.actionTaken ?? "—"}
                </span>
                {entry.measurementMode ? (
                  <span className="hidden shrink-0 font-mono text-[11px] text-ink-soft lg:inline">
                    {entry.measurementMode}
                  </span>
                ) : null}
                {entry.constitutionVersion !== null ? (
                  <span className="hidden shrink-0 text-xs text-ink-soft tabular-nums sm:inline">
                    v{entry.constitutionVersion}
                  </span>
                ) : null}
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
              </summary>
              <dl className="ledger-reveal grid gap-x-6 gap-y-3 border-t border-dotted border-border bg-surface-soft/50 px-4 py-3 pl-10 shadow-[inset_0_2px_6px_rgb(15_23_42/0.03)] sm:grid-cols-2 lg:grid-cols-3">
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
          </React.Fragment>
        );
      })}
    </ol>
    </>
  );
}

type EventTone = "neutral" | "positive" | "caution" | "info" | "danger";

/** Timeline dot color per event tone — muted, audit-grade, not loud. Each
 * toned dot carries a faint matching halo so the rail reads as proof, with the
 * event type always named in the adjacent Badge (never color-only status). */
const TONE_DOT: Record<EventTone, string> = {
  neutral: "bg-border-strong",
  positive: "bg-success shadow-[0_0_6px_rgb(5_150_105/0.45)]",
  caution: "bg-warning shadow-[0_0_6px_rgb(217_119_6/0.4)]",
  info: "bg-info shadow-[0_0_6px_rgb(37_99_235/0.4)]",
  danger: "bg-danger shadow-[0_0_6px_rgb(220_38_38/0.4)]",
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
