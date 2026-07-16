/**
 * lib/recipes/local/measurement.ts — measurement plans for the LOCAL email
 * recipes (PRD 14, 26A.1, 26A.2), mirroring lib/recipes/measurement-plan.ts.
 *
 * Trust rules enforced here, unchanged from DTC:
 *  - The holdout branch EXISTS and triggers ONLY when the eligible audience
 *    >= minHoldoutAudience (500 — shared law). Local demo audiences are
 *    engineered smaller than 500, so the before/after path exercises.
 *  - Holdout claims downgrade to before/after when the activation level
 *    cannot enforce exclusion (26A.1 — catering's exportable brief always
 *    downgrades, so catering NEVER gets a holdout).
 *  - Three labels only; before/after copy never claims causal lift.
 */

import {
  DEFAULT_MEASUREMENT_WINDOWS,
  HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS,
  MEASUREMENT_LABELS,
  type ActivationLevel,
  type HoldoutPlan,
  type MeasurementPlan,
  type RecipeId,
} from "../../contracts";
import { buildMde } from "../../measurement/holdout";

/** The two LOCAL email recipes (the shared Meta recipe stays directional). */
export type LocalEmailRecipeId = Extract<
  RecipeId,
  "local_lapsed_regular" | "catering_upsell"
>;

const LOCAL_EXCLUSION_WINDOWS: Record<LocalEmailRecipeId, string> = {
  local_lapsed_regular: "P30D", // long read window (26A.2)
  catering_upsell: "P14D",
};

export interface LocalEmailPlanArgs {
  recipeId: LocalEmailRecipeId;
  eligibleAudienceSize: number;
  holdoutPercent: number;
  minHoldoutAudience: number;
  activationLevel: ActivationLevel;
  extraCaveats?: string[];
}

export function buildLocalEmailMeasurementPlan(
  args: LocalEmailPlanArgs,
): MeasurementPlan {
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
        exclusionWindow: LOCAL_EXCLUSION_WINDOWS[args.recipeId],
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
