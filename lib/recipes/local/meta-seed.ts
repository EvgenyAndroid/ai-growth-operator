/**
 * lib/recipes/local/meta-seed.ts — the SHARED Meta seed/suppression recipe,
 * wired for the LOCAL vertical.
 *
 * The deterministic core is the same recipe (lib/recipes/meta-seed.ts):
 * identified customers with consentAds, composite-LTV top percentile seed,
 * recent-purchaser suppression, NO dollar estimate, directional as ever.
 * The LOCAL wiring only:
 *  - attaches the POS coverage disclosure (trust rule #9 — the seed can only
 *    ever be drawn from identified/loyalty-matched customers), and
 *  - rewrites source wording from Shopify to the Square-like POS.
 * Nothing about measurement, estimates, or eligibility changes — Meta is
 * ALWAYS directional and never found-money eligible.
 */

import type { RecipeInput, RecipeResult } from "../../contracts";
import { runMetaSeedSuppression } from "../meta-seed";
import type { RecipeDataSnapshot } from "../types";
import { computePosCoverage, coverageConfidenceInput } from "./coverage";

/** Deterministic source rewording — DTC copy names Shopify; LOCAL runs on POS. */
function posWording(text: string): string {
  return text.replace(/Shopify/g, "POS (Square-like)");
}

export function runLocalMetaSeed(
  input: RecipeInput<"meta_seed_suppression">,
  snapshot: RecipeDataSnapshot,
): RecipeResult<"meta_seed_suppression"> {
  const base = runMetaSeedSuppression(input, snapshot);
  const posCoverage = computePosCoverage(snapshot);

  return {
    ...base,
    sourceSignal: `${posWording(base.sourceSignal)}. Identified (loyalty-matched) customers only.`,
    confidenceInputs: {
      ...base.confidenceInputs,
      pos_identified_coverage: coverageConfidenceInput(posCoverage),
    },
    explanation: {
      ...base.explanation,
      dataUsed: base.explanation.dataUsed.map(posWording),
      // Trust rule #9 — coverage disclosure in every local readout. The note
      // contains no lift/causal language (META_DISALLOWED_TERMS-safe).
      assumptions: [...base.explanation.assumptions, posCoverage.coverage.note],
    },
    coverage: posCoverage.coverage, // REQUIRED for LOCAL results (trust rule #9)
  };
}
