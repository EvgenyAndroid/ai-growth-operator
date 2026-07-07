/**
 * lib/measurement/contamination.ts — holdout contamination checks (PRD 14.4 + 26A.5).
 *
 * MVP rule: we guarantee clean exclusion from the OPERATOR-CREATED flow.
 * What we cannot guarantee is that other active reach sources (existing
 * Klaviyo flows, Shopify native emails, Meta retargeting, manual sends,
 * duplicate profiles) leave held-out users untouched. When they might not,
 * we flag the risk and attach the exact PRD 14.4 disclosure string.
 *
 * 26A.5: prefer explicit flow membership; fall back to event-history proxy;
 * if neither is available for an active source, flag risk and lower confidence.
 */

import type { ContractContaminationRisk } from "../contracts";
import { CONTAMINATION_DISCLOSURE } from "./constants";

/** PRD 14.4 — the reach-source categories that must be checked. */
export type ReachSourceType =
  | "klaviyo_abandoned_cart_flow"
  | "klaviyo_winback_flow"
  | "klaviyo_other_flow"
  | "shopify_native_abandoned_checkout"
  | "meta_retargeting_audience"
  | "other_campaign_same_audience"
  | "manual_send"
  | "duplicate_profile";

export interface ReachSource {
  type: ReachSourceType;
  name: string;
  active: boolean;
  /**
   * Lowercase emails the source reaches, when membership is knowable
   * (Klaviyo flow membership, or recent flow/campaign event history as
   * proxy — 26A.5). Leave undefined when membership is NOT knowable;
   * an active source with unknown membership is flagged conservatively.
   */
  memberEmailsLower?: string[];
  /** True when memberEmailsLower came from event-history proxy rather than explicit membership (26A.5). */
  membershipIsProxy?: boolean;
}

export interface ContaminationOverlap {
  sourceType: ReachSourceType;
  sourceName: string;
  /** -1 = membership unknowable (assumed overlapping). */
  overlapCount: number;
  viaProxy: boolean;
}

export interface ContaminationResult {
  risk: ContractContaminationRisk; // none | low | flagged
  overlaps: ContaminationOverlap[];
  /** Exact PRD 14.4 string when risk === "flagged"; null otherwise. */
  disclosure: string | null;
  /** True when 26A.5 says confidence must drop a level (unknown membership on an active source). */
  lowerConfidence: boolean;
  /** Caveats to merge into the readout (includes the disclosure when flagged). */
  caveats: string[];
}

export interface ContaminationCheckInput {
  /** Lowercase emails of HELD-OUT customers (26B.12 join key). */
  holdoutEmailsLower: string[];
  sources: ReachSource[];
}

/**
 * Check whether held-out users may still be reached by other active
 * campaigns (PRD 14.4). Pure and deterministic.
 *
 * Risk ladder:
 *   - "none"    — no active sources at all
 *   - "low"     — active sources exist but none overlap the holdout
 *   - "flagged" — >=1 active source overlaps the holdout, or an active
 *                 source's membership is unknowable (assumed overlap, 26A.5)
 */
export function checkContamination(
  input: ContaminationCheckInput,
): ContaminationResult {
  const holdoutSet = new Set(
    input.holdoutEmailsLower.map((e) => e.toLowerCase()),
  );
  const activeSources = input.sources.filter((s) => s.active);

  const overlaps: ContaminationOverlap[] = [];
  let lowerConfidence = false;

  for (const source of activeSources) {
    if (source.memberEmailsLower === undefined) {
      // 26A.5 — neither membership nor proxy available: flag + lower confidence.
      overlaps.push({
        sourceType: source.type,
        sourceName: source.name,
        overlapCount: -1,
        viaProxy: false,
      });
      lowerConfidence = true;
      continue;
    }
    let count = 0;
    for (const email of source.memberEmailsLower) {
      if (holdoutSet.has(email.toLowerCase())) count++;
    }
    if (count > 0) {
      overlaps.push({
        sourceType: source.type,
        sourceName: source.name,
        overlapCount: count,
        viaProxy: source.membershipIsProxy === true,
      });
    }
  }

  const risk: ContractContaminationRisk =
    overlaps.length > 0 ? "flagged" : activeSources.length > 0 ? "low" : "none";

  const caveats: string[] = [];
  if (risk === "flagged") {
    caveats.push(CONTAMINATION_DISCLOSURE);
    for (const o of overlaps) {
      caveats.push(
        o.overlapCount === -1
          ? `Active source "${o.sourceName}" (${o.sourceType}) has unknowable membership — assumed to reach held-out customers; confidence lowered (PRD 26A.5).`
          : `${o.overlapCount} held-out customer(s) may also be reached by "${o.sourceName}" (${o.sourceType})${o.viaProxy ? " [membership inferred from recent event history]" : ""}.`,
      );
    }
  }

  return {
    risk,
    overlaps,
    disclosure: risk === "flagged" ? CONTAMINATION_DISCLOSURE : null,
    lowerConfidence,
    caveats,
  };
}
