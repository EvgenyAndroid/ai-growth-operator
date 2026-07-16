/**
 * lib/recipes/measurement-plan.ts — builds the MeasurementPlan each recipe
 * attaches to its result (PRD 14, 26A.1, 26A.2, 26B.14).
 *
 * Trust rules enforced here:
 *  - Holdout only for Klaviyo flows with eligible audience >= minHoldoutAudience.
 *  - Holdout claims downgrade to before/after when the activation level cannot
 *    enforce exclusion (26A.1: exportable brief / manual instructions).
 *  - Meta is ALWAYS directional; plan copy never uses lift language (PRD 15.4).
 */

import {
  DEFAULT_MEASUREMENT_WINDOWS,
  HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS,
  MEASUREMENT_LABELS,
  type ActivationLevel,
  type HoldoutPlan,
  type MeasurementPlan,
  type RecipeId,
} from "../contracts";
import { buildMde } from "../measurement/holdout";

const KLAVIYO_EXCLUSION_WINDOWS: Record<string, string> = {
  abandoned_checkout_recovery: "P14D", // long read window (26A.2)
  lapsed_winback: "P30D",
};

export interface KlaviyoPlanArgs {
  recipeId: Extract<RecipeId, "abandoned_checkout_recovery" | "lapsed_winback">;
  eligibleAudienceSize: number;
  holdoutPercent: number;
  minHoldoutAudience: number;
  activationLevel: ActivationLevel;
  extraCaveats?: string[];
}

export function buildKlaviyoMeasurementPlan(args: KlaviyoPlanArgs): MeasurementPlan {
  const windows = DEFAULT_MEASUREMENT_WINDOWS[args.recipeId];
  const sizeEligible = args.eligibleAudienceSize >= args.minHoldoutAudience;
  const activationEnforceable = !HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS.includes(
    args.activationLevel,
  );
  const enforceable = sizeEligible && activationEnforceable;
  const mode = enforceable ? "holdout" : "before_after_no_control";

  const caveats: string[] = [...(args.extraCaveats ?? [])];
  if (enforceable) {
    caveats.push(
      "Cross-flow holdout interaction possible: customers may sit in multiple concurrent holdouts (26B.14).",
      "Holdout exclusion is enforced on the lowercase-email join key; unmatched profiles cannot be held out cleanly (26B.12).",
    );
  } else if (sizeEligible && !activationEnforceable) {
    caveats.push(
      `Audience qualifies for a holdout (${args.eligibleAudienceSize} >= ${args.minHoldoutAudience}) but the ${args.activationLevel} activation path cannot enforce exclusion, so measurement is downgraded to before/after with no control group (26A.1).`,
    );
  } else {
    caveats.push(
      `Eligible audience (${args.eligibleAudienceSize}) is below the ${args.minHoldoutAudience}-customer holdout minimum; results are before/after with no control group and cannot prove causal lift.`,
    );
  }

  const plannedHoldoutSize = Math.floor(
    (args.eligibleAudienceSize * args.holdoutPercent) / 100,
  );
  const holdout: HoldoutPlan | undefined = sizeEligible
    ? {
        eligibleAudienceSize: args.eligibleAudienceSize,
        holdoutPercent: args.holdoutPercent,
        holdoutSize: plannedHoldoutSize,
        assignmentMethod: "randomized_customer_level",
        exclusionWindow: KLAVIYO_EXCLUSION_WINDOWS[args.recipeId],
        enforceable,
        mde: buildMde(args.eligibleAudienceSize, plannedHoldoutSize),
      }
    : undefined;

  const primary = windows.find((w) => w.readType === "primary") ?? windows[0];
  const summary = enforceable
    ? `${args.holdoutPercent}% randomized customer-level holdout (${holdout?.holdoutSize} of ${args.eligibleAudienceSize}); holdout-verified lift reported as a range; primary read at ${primary.days} days.`
    : `Before/after comparison with no control group; primary read at ${primary.days} days. This cannot prove causal lift, and results are labeled accordingly.`;

  return {
    mode,
    label: MEASUREMENT_LABELS[mode],
    summary,
    holdout,
    windows: windows.map((w) => ({ readType: w.readType, days: w.days })),
    caveats,
  };
}

/**
 * Recipe 3: directional only, always (PRD 10.4 / 15). No lift language —
 * copy here must never contain META_DISALLOWED_TERMS.
 */
export function buildMetaMeasurementPlan(extraCaveats: string[] = []): MeasurementPlan {
  const windows = DEFAULT_MEASUREMENT_WINDOWS.meta_seed_suppression;
  return {
    mode: "directional",
    label: MEASUREMENT_LABELS.directional,
    summary:
      "Directional read only: audience size, match rate, sync status, spend against associated campaigns, and downstream purchases where observable, with prior-period comparison labeled non-causal. Reads at 7, 14, and 30 days. This cannot prove causal impact.",
    windows: windows.map((w) => ({ readType: w.readType, days: w.days })),
    caveats: [
      "Meta reporting is directional and non-causal; no control group exists and no causal claim is made (PRD 15).",
      "Prior-period comparisons are labeled non-causal.",
      ...extraCaveats,
    ],
  };
}
