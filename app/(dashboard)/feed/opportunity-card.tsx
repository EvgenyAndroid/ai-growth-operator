/**
 * app/(dashboard)/feed/opportunity-card.tsx — one feed card (PRD 7.2).
 *
 * Renders every required card field: title, estimated value range or
 * directional label, confidence, data-as-of, what was found, why it matters,
 * recommended action, measurement mode, approval needed, CTA, dismiss.
 * A card without a full ExplanationContract never reaches this component
 * (PRD 4.4 — enforced by the server layer).
 *
 * Scan-first structure (brief v4): header row (icon + title + badges), big
 * value, meta strip, two compact insight panels, action module, full-bleed
 * CTA strip. Mode accent rail + CSS-only mode icon encode the trust
 * hierarchy (emerald / amber / washed violet — directional never reads as
 * strong as verified).
 */

import Link from "next/link";
import type { OpportunityCardView } from "@/lib/server";
import {
  Badge,
  Card,
  ConfidenceBadge,
  MeasurementBadge,
  StatusDot,
} from "@/components/ui/primitives";
import { DismissButton } from "./dismiss-button";
import { EstimateValue } from "./_shared/explanation";
import { fmtDateTime } from "./_shared/format";

const ACTION_LABELS: Record<string, string> = {
  klaviyo_recovery_flow: "3-step Klaviyo recovery email sequence",
  klaviyo_winback_flow: "Klaviyo win-back email sequence (non-discount-first)",
  meta_audience_sync: "Meta seed + purchaser-suppression audience sync",
};

/**
 * LOCAL trust rule #9 — the POS coverage disclosure. Rendered verbatim on
 * every LOCAL card (coverage is null on DTC cards, so DTC renders nothing).
 */
function CoverageDisclosure({
  coverage,
}: {
  coverage: OpportunityCardView["coverage"];
}) {
  if (!coverage) return null;
  // The note is rendered verbatim (lib/contracts IdentifiedCoverage) and
  // already states the identified-transaction share.
  return (
    <p className="rounded-md border border-amber-200 bg-warning-soft px-3 py-2 text-xs leading-5 text-amber-900">
      {coverage.note}
    </p>
  );
}

const STATUS_TONE: Record<string, "neutral" | "info" | "positive"> = {
  drafted: "info",
  approved: "info",
  launched: "positive",
  measured: "positive",
  learned: "positive",
};

/**
 * Top accent rail by measurement mode (brief v3 area 4). Trust hierarchy is
 * encoded in the CSS: holdout = saturated emerald, before/after = amber,
 * directional = washed violet that never reads as strong as verified.
 */
const MODE_RAIL: Record<string, string> = {
  holdout: "bg-gradient-to-r from-emerald-500 via-emerald-400/60 to-transparent",
  before_after_no_control:
    "bg-gradient-to-r from-amber-500 via-amber-400/55 to-transparent",
  directional:
    "bg-gradient-to-r from-violet-300 via-violet-200/50 to-transparent",
};

/**
 * CSS-only mode icon (brief v4): revenue arrow for dollar-carrying cards,
 * proof dot (holdout) / warning dot (before-after) otherwise, and a washed
 * directional diamond. Decorative — the badges beside the title carry the
 * text equivalent, so status is never color-alone.
 */
function ModeIcon({
  mode,
  hasEstimate,
}: {
  mode: string;
  hasEstimate: boolean;
}) {
  const box =
    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border";
  if (hasEstimate) {
    // Revenue arrow — upward chevron on the money surface.
    return (
      <span
        aria-hidden="true"
        className={`${box} border-emerald-200/70 bg-emerald-50 shadow-[0_1px_6px_-1px_var(--glow-money)]`}
      >
        <span className="mt-0.5 h-2 w-2 -rotate-45 border-r-2 border-t-2 border-emerald-600" />
      </span>
    );
  }
  if (mode === "holdout") {
    return (
      <span
        aria-hidden="true"
        className={`${box} border-blue-200/70 bg-blue-50 shadow-[0_1px_6px_-1px_var(--glow-proof)]`}
      >
        <span className="h-2 w-2 rounded-full bg-info shadow-[0_0_0_2px_rgb(37_99_235/0.15)]" />
      </span>
    );
  }
  if (mode === "before_after_no_control") {
    return (
      <span
        aria-hidden="true"
        className={`${box} border-amber-200/70 bg-amber-50`}
      >
        <span className="h-2 w-2 rounded-full bg-warning shadow-[0_0_0_2px_rgb(217_119_6/0.14)]" />
      </span>
    );
  }
  // Directional diamond — deliberately the quietest of the set.
  return (
    <span
      aria-hidden="true"
      className={`${box} border-violet-200/50 bg-violet-50/60`}
    >
      <span className="h-2 w-2 rotate-45 bg-violet-300" />
    </span>
  );
}

export function OpportunityCard({
  accountId,
  card,
  priority = false,
}: {
  accountId: string;
  card: OpportunityCardView;
  /** Top card in the feed gets a subtle accent bar (design brief). */
  priority?: boolean;
}) {
  const recommended =
    card.recommendedAction !== null
      ? ACTION_LABELS[card.recommendedAction] ?? card.recommendedAction
      : "—";

  return (
    <Card
      as="article"
      className={
        "relative flex flex-col gap-3 overflow-hidden " +
        "transition-[box-shadow,translate] duration-150 ease-out motion-safe:hover:-translate-y-0.5 " +
        "hover:shadow-card-hover hover:ring-1 hover:ring-accent/15" +
        (priority ? " border-border-strong shadow-md" : "")
      }
    >
      {/* Measurement-mode accent rail (brief v3 area 4) — every card carries
          its mode color; directional stays deliberately washed. */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] ${
          MODE_RAIL[card.measurementMode] ?? ""
        }`}
      />

      {/* 1. Header row: mode icon + title + badges */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <ModeIcon
            mode={card.measurementMode}
            hasEstimate={card.estimate !== null}
          />
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-ink">
            {card.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ConfidenceBadge level={card.confidence} />
          <MeasurementBadge mode={card.measurementMode} />
          {STATUS_TONE[card.status] ? (
            <Badge tone={STATUS_TONE[card.status]}>{card.status}</Badge>
          ) : null}
        </div>
      </div>

      {/* 2. Big value: estimated range or directional label (PRD 16.4) */}
      <div>
        <EstimateValue
          estimate={card.estimate}
          measurementMode={card.measurementMode}
          large
        />
      </div>

      {/* 3. Meta strip: recipe version · data as of · type (brief v4) */}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5 text-ink-soft">
        <span className="font-medium text-ink-muted">
          Recipe v{card.recipeVersion}
        </span>
        <span aria-hidden="true">·</span>
        <span>Data as of {fmtDateTime(card.dataAsOf)}</span>
        <span aria-hidden="true">·</span>
        <span className="capitalize">{card.category.replace(/_/g, " ")}</span>
      </p>

      {/* LOCAL POS coverage disclosure (trust rule #9); null for DTC */}
      <CoverageDisclosure coverage={card.coverage} />

      {/* 4. What was found / why it matters — two compact insight panels
          (brief v4: scan-first) */}
      <div className="grid gap-3 text-sm leading-relaxed text-ink-secondary sm:grid-cols-2">
        <div className="rounded-lg bg-surface-soft/50 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <StatusDot tone="proof" />
            What was found
          </span>
          <p className="mt-1">{card.explanation.found}</p>
        </div>
        <div className="rounded-lg bg-surface-soft/50 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <StatusDot tone="money" />
            Why it matters
          </span>
          <p className="mt-1">{card.explanation.whyItMatters}</p>
        </div>
      </div>

      {/* 5. Action module (brief v3 area 4 / v4): card-blue gradient surface,
          gradient accent rail, soft proof glow — the intentional CTA zone. */}
      <div className="relative overflow-hidden rounded-lg border border-blue-200/70 bg-card-blue px-3.5 py-2.5 text-sm shadow-[0_8px_24px_-12px_var(--glow-proof)]">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-accent to-accent/30"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          Recommended action
        </p>
        <p className="mt-1 font-medium text-ink">{recommended}</p>
        <p className="mt-1 text-ink-muted">
          <span className="font-medium text-ink">Approval needed: </span>
          {card.explanation.approvalNeeded}
        </p>
      </div>

      {/* 6. CTA strip: full-bleed footer — measurement label + dismiss + CTA */}
      <div className="-mx-5 -mb-5 mt-0.5 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-soft/40 px-5 py-3">
        <span className="text-xs text-ink-soft">
          {card.measurementLabelCopy}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <DismissButton accountId={accountId} opportunityId={card.id} />
          <Link
            href={`/opportunities/${card.id}`}
            className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:translate-y-px active:shadow-none"
          >
            Review &amp; draft
          </Link>
        </div>
      </div>
    </Card>
  );
}
