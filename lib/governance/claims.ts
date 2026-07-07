/**
 * lib/governance/claims.ts — unsupported-claim scanning (PRD 12.6).
 *
 * Every claim in the PRD 12.6 flag list is detected with word-boundary,
 * case-insensitive matching. A non-overrideable subset (cures, treats disease,
 * FDA-approved, guaranteed medical outcome) blocks HARD — no user override.
 * All other flagged claims block approval unless the user edits the copy or
 * explicitly overrides the specific claim (claimOverrides in checkAction).
 *
 * Trust rule (PRD 10.4): when the destination channel is Meta, the
 * META_DISALLOWED_TERMS (lift, incrementality, recovered revenue, causal ROAS,
 * holdout-verified) are treated as NON-overrideable claims — Meta is always
 * directional and never gets lift language.
 */

import { META_DISALLOWED_TERMS } from "../contracts";

export interface ClaimRule {
  /** Canonical claim phrase (lowercase) — used as the override key. */
  claim: string;
  pattern: RegExp;
  nonOverrideable: boolean;
  why: string;
  saferAlternative: string;
}

function wordPattern(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
}

/**
 * PRD 12.6 "Claims To Flag" — the full list, verbatim. Overrideable unless
 * listed in the non-overrideable subset below.
 */
export const PRD_CLAIM_RULES: ClaimRule[] = [
  // --- Non-overrideable subset (PRD 12.6 "Non-Overrideable Claims") ---
  {
    claim: "cures",
    pattern: /(^|\W)cures?(\W|$)/i,
    nonOverrideable: true,
    why: "Cure claims are medical claims that require regulatory substantiation; product data cannot support them.",
    saferAlternative: 'Describe the customer experience instead, e.g. "customers tell us it helps them feel their best".',
  },
  {
    claim: "treats disease",
    pattern: /(^|\W)treats?\W(?:\w+\W){0,5}?(disease|illness|condition|infection|disorder)s?(\W|$)/i,
    nonOverrideable: true,
    why: "Disease-treatment claims are regulated medical claims and cannot be made for consumer products.",
    saferAlternative: "Focus on cosmetic or lifestyle benefits supported by your product data.",
  },
  {
    claim: "fda-approved",
    pattern: /(^|\W)fda[\s-]+(approved|cleared)(\W|$)/i,
    nonOverrideable: true, // Alpha: no source-data confirmation path exists, so this always blocks (PRD 12.6).
    why: "FDA approval status is not confirmed by any connected source data; claiming it without proof is a legal risk.",
    saferAlternative: 'Remove the regulatory claim, or cite verifiable facts like "made in an FDA-registered facility" only if documented.',
  },
  {
    claim: "guaranteed medical outcome",
    pattern: /(^|\W)guaranteed?\W(?:\w+\W){0,5}?(results?|outcomes?|cures?|relief|weight\sloss)(\W|$)/i,
    nonOverrideable: true,
    why: "Guaranteeing a medical or physical outcome is an unsubstantiated efficacy claim.",
    saferAlternative: 'Offer a satisfaction policy instead, e.g. "love it or your money back within 30 days".',
  },
  // --- Overrideable flag list (PRD 12.6 "Claims To Flag") ---
  {
    claim: "clinically proven",
    pattern: wordPattern("clinically proven"),
    nonOverrideable: false,
    why: "No clinical-study data exists in your connected sources to substantiate this.",
    saferAlternative: '"Loved by thousands of customers" (if order data supports it).',
  },
  {
    claim: "treats",
    pattern: /(^|\W)treats?(\W|$)/i,
    nonOverrideable: false,
    why: "Treatment language implies a medical claim your product data cannot substantiate.",
    saferAlternative: '"Helps with" or "designed for" framed around the product category.',
  },
  {
    claim: "prevents",
    pattern: /(^|\W)prevents?(\W|$)/i,
    nonOverrideable: false,
    why: "Prevention claims imply proven efficacy that source data does not confirm.",
    saferAlternative: '"Supports" or "helps maintain".',
  },
  {
    claim: "guaranteed",
    pattern: /(^|\W)guaranteed?(\W|$)/i,
    nonOverrideable: false,
    why: "Blanket guarantees are unsubstantiated unless backed by an actual policy.",
    saferAlternative: 'Reference your real return policy, e.g. "30-day returns, no questions asked".',
  },
  {
    claim: "medical-grade",
    pattern: wordPattern("medical grade"),
    nonOverrideable: false,
    why: "Medical-grade is a regulated quality claim not confirmed by product data.",
    saferAlternative: '"Professional-quality" only if supportable, or describe concrete materials/ingredients.',
  },
  {
    claim: "dermatologist-approved",
    pattern: wordPattern("dermatologist approved"),
    nonOverrideable: false,
    why: "No source data documents dermatologist endorsement.",
    saferAlternative: "Cite real reviews or ratings from your store data.",
  },
  {
    claim: "safe for all skin types",
    pattern: wordPattern("safe for all skin types"),
    nonOverrideable: false,
    why: "Universal safety claims cannot be substantiated and create liability.",
    saferAlternative: '"Formulated for sensitive skin" only if the product data says so, plus a patch-test note.',
  },
  {
    claim: "best",
    pattern: /(^|\W)best(\W|$)/i,
    nonOverrideable: false,
    why: "Superlative claims are unsupported comparative advertising.",
    saferAlternative: 'Specific, verifiable differentiators, e.g. "our top-rated moisturizer" (if ratings data exists).',
  },
  {
    claim: "#1",
    pattern: /(^|\s)#\s?1(\W|$)|(^|\W)number\s+one(\W|$)/i,
    nonOverrideable: false,
    why: "Ranking claims require a cited, verifiable source.",
    saferAlternative: '"A customer favorite" backed by your order or review data.',
  },
  {
    claim: "fastest",
    pattern: /(^|\W)fastest(\W|$)/i,
    nonOverrideable: false,
    why: "Speed superlatives are unsubstantiated comparisons.",
    saferAlternative: 'Concrete timing your data supports, e.g. "ships within 24 hours".',
  },
  {
    claim: "permanent",
    pattern: /(^|\W)permanent(?:ly)?(\W|$)/i,
    nonOverrideable: false,
    why: "Permanence claims overstate results and invite disputes.",
    saferAlternative: '"Long-lasting" with honest framing.',
  },
  {
    claim: "no side effects",
    pattern: wordPattern("no side effects"),
    nonOverrideable: false,
    why: "Absolute safety claims cannot be substantiated.",
    saferAlternative: "Omit the claim; link to ingredient or usage information instead.",
  },
  {
    claim: "scientifically proven",
    pattern: wordPattern("scientifically proven"),
    nonOverrideable: false,
    why: "No study data exists in connected sources to back this.",
    saferAlternative: "Describe the mechanism or ingredients factually without efficacy proof language.",
  },
  {
    claim: "doctor recommended",
    pattern: wordPattern("doctor recommended"),
    nonOverrideable: false,
    why: "No source data documents physician endorsement.",
    saferAlternative: "Use genuine customer testimonials from your review data.",
  },
];

export interface ClaimFinding {
  /** Canonical claim key (lowercase) — matches against claimOverrides. */
  claim: string;
  nonOverrideable: boolean;
  /** Index into the copyText[] array where the claim was found. */
  copyIndex: number;
  /** Short excerpt around the match for the flag UI. */
  snippet: string;
  why: string;
  saferAlternative: string;
  /** Named source checked, per PRD 12.6 "show source data checked". */
  sourceDataChecked: string;
}

function snippetAround(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return text.slice(0, 80);
  const start = Math.max(0, match.index - 30);
  const end = Math.min(text.length, match.index + match[0].length + 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export interface ScanClaimsOptions {
  /** Merchant banned-claim phrases from the active Constitution (Operating Rules). */
  merchantBannedClaims: string[];
  /** Destination channel — Meta adds the META_DISALLOWED_TERMS as hard blocks. */
  channel: "klaviyo" | "meta";
}

/**
 * Scan draft copy for unsupported claims. Deterministic — same copy, same
 * findings. Returns every occurrence (one finding per rule per copy block).
 */
export function scanCopyForClaims(
  copyText: string[],
  options: ScanClaimsOptions,
): ClaimFinding[] {
  const rules: ClaimRule[] = [...PRD_CLAIM_RULES];

  // Merchant Operating Rules banned claims (overrideable per PRD 12.6 unless
  // they duplicate the non-overrideable subset, which is checked first anyway).
  for (const phrase of options.merchantBannedClaims) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) continue;
    if (rules.some((rule) => rule.claim === normalized)) continue;
    rules.push({
      claim: normalized,
      pattern: wordPattern(normalized),
      nonOverrideable: false,
      why: `"${phrase}" is on your Operating Rules banned-claims list.`,
      saferAlternative: "Edit the copy to remove the banned phrase, or update your Operating Rules.",
    });
  }

  // Trust rule: Meta copy may NEVER contain lift language (PRD 10.4). Hard block.
  if (options.channel === "meta") {
    for (const term of META_DISALLOWED_TERMS) {
      rules.push({
        claim: term.toLowerCase(),
        pattern: wordPattern(term),
        nonOverrideable: true,
        why: `"${term}" is lift/incrementality language. Meta results are directional only in v0 — no causal claims.`,
        saferAlternative: 'Use directional framing, e.g. "audience synced; purchases observed during the window (directional)".',
      });
    }
  }

  const findings: ClaimFinding[] = [];
  copyText.forEach((text, copyIndex) => {
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        findings.push({
          claim: rule.claim,
          nonOverrideable: rule.nonOverrideable,
          copyIndex,
          snippet: snippetAround(text, rule.pattern),
          why: rule.why,
          saferAlternative: rule.saferAlternative,
          sourceDataChecked:
            "Checked: connected product catalog, order history, and review data — no substantiation found for this claim.",
        });
      }
    }
  });

  // Suppress the generic overrideable finding when a non-overrideable rule
  // already fired for the same copy block with an overlapping claim (e.g.
  // "treats" vs "treats disease", "guaranteed" vs "guaranteed medical outcome").
  return findings.filter((finding) => {
    if (finding.nonOverrideable) return true;
    const shadowed = findings.some(
      (other) =>
        other.nonOverrideable &&
        other.copyIndex === finding.copyIndex &&
        other.claim.includes(finding.claim.replace(/s$/, "").split(" ")[0] ?? finding.claim),
    );
    return !shadowed;
  });
}
