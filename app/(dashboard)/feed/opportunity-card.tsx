/**
 * app/(dashboard)/feed/opportunity-card.tsx — one feed card (PRD 7.2).
 *
 * Renders every required card field: title, estimated value range or
 * directional label, confidence, data-as-of, what was found, why it matters,
 * recommended action, measurement mode, approval needed, CTA, dismiss.
 * A card without a full ExplanationContract never reaches this component
 * (PRD 4.4 — enforced by the server layer).
 *
 * This is the HERO component of the product (design brief §Components):
 * subtle hover lift, strong-not-loud border, and the top-priority card
 * carries a restrained accent bar.
 */

import Link from "next/link";
import type { OpportunityCardView } from "@/lib/server";
import {
  Badge,
  Card,
  ConfidenceBadge,
  MeasurementBadge,
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
        "transition-[box-shadow,transform] duration-150 motion-safe:hover:-translate-y-0.5 hover:shadow-card-hover" +
        (priority ? " border-border-strong shadow-md" : "")
      }
    >
      {priority ? (
        // Priority accent line (brief §4): accent fading out, one quiet edge.
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent via-accent/50 to-transparent"
        />
      ) : null}

      {/* Title row + badges */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug tracking-tight text-ink">
          {card.title}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <ConfidenceBadge level={card.confidence} />
          <MeasurementBadge mode={card.measurementMode} />
          {STATUS_TONE[card.status] ? (
            <Badge tone={STATUS_TONE[card.status]}>{card.status}</Badge>
          ) : null}
        </div>
      </div>

      {/* Estimated value range or directional label (PRD 16.4) */}
      <div>
        <EstimateValue
          estimate={card.estimate}
          measurementMode={card.measurementMode}
          large
        />
      </div>

      {/* LOCAL POS coverage disclosure (trust rule #9); null for DTC */}
      <CoverageDisclosure coverage={card.coverage} />

      {/* What was found / why it matters */}
      <div className="grid gap-3 text-sm leading-relaxed text-ink-secondary sm:grid-cols-2">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            What was found
          </span>
          <p className="mt-1">{card.explanation.found}</p>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Why it matters
          </span>
          <p className="mt-1">{card.explanation.whyItMatters}</p>
        </div>
      </div>

      {/* Recommended action callout (brief §4) + approval needed */}
      <div className="relative overflow-hidden rounded-lg border border-blue-200/70 bg-info-soft/30 px-3.5 py-2.5 text-sm">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-0.5 bg-accent/70"
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

      {/* Footer: data-as-of + CTA + dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs text-ink-soft">
          Data as of {fmtDateTime(card.dataAsOf)} · {card.measurementLabelCopy}
        </span>
        <div className="flex items-center gap-2">
          <DismissButton accountId={accountId} opportunityId={card.id} />
          <Link
            href={`/opportunities/${card.id}`}
            className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover active:translate-y-px active:shadow-none"
          >
            Review &amp; draft
          </Link>
        </div>
      </div>
    </Card>
  );
}
