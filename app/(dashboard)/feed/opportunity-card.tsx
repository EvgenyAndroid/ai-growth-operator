/**
 * app/(dashboard)/feed/opportunity-card.tsx — one feed card (PRD 7.2).
 *
 * Renders every required card field: title, estimated value range or
 * directional label, confidence, data-as-of, what was found, why it matters,
 * recommended action, measurement mode, approval needed, CTA, dismiss.
 * A card without a full ExplanationContract never reaches this component
 * (PRD 4.4 — enforced by the server layer).
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
}: {
  accountId: string;
  card: OpportunityCardView;
}) {
  const recommended =
    card.recommendedAction !== null
      ? ACTION_LABELS[card.recommendedAction] ?? card.recommendedAction
      : "—";

  return (
    <Card as="article" className="flex flex-col gap-3">
      {/* Title row + badges */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-stone-900">{card.title}</h3>
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

      {/* What was found / why it matters */}
      <div className="grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
            What was found
          </span>
          <p className="mt-0.5">{card.explanation.found}</p>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
            Why it matters
          </span>
          <p className="mt-0.5">{card.explanation.whyItMatters}</p>
        </div>
      </div>

      {/* Recommended action + approval needed */}
      <div className="rounded-md bg-stone-50 px-3 py-2 text-sm">
        <p>
          <span className="font-medium text-stone-800">Recommended action: </span>
          <span className="text-stone-700">{recommended}</span>
        </p>
        <p className="mt-1 text-stone-600">
          <span className="font-medium text-stone-800">Approval needed: </span>
          {card.explanation.approvalNeeded}
        </p>
      </div>

      {/* Footer: data-as-of + CTA + dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <span className="text-xs text-stone-500">
          Data as of {fmtDateTime(card.dataAsOf)} · {card.measurementLabelCopy}
        </span>
        <div className="flex items-center gap-2">
          <DismissButton accountId={accountId} opportunityId={card.id} />
          <Link
            href={`/opportunities/${card.id}`}
            className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
          >
            Review &amp; draft
          </Link>
        </div>
      </div>
    </Card>
  );
}
