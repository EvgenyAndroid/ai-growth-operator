/**
 * lib/measurement/mode.ts — measurement-mode resolution (PRD 14.1/14.2/14.6/14.7 + 26A.1).
 *
 * Every action gets EXACTLY ONE mode:
 *   - holdout                  — only Klaviyo lifecycle flows, audience >= 500,
 *                                AND the activation path can enforce exclusion (26A.1)
 *   - before_after_no_control  — audience < 500, holdout unassignable, contamination
 *                                too high, or activation downgraded to brief/manual
 *   - directional              — Meta audience sync, ALWAYS. Never lift language.
 */

import type {
  ActivationLevel,
  ContractActionType,
  MeasurementLabel,
  MeasurementMode,
} from "../contracts";
import {
  HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS,
  MEASUREMENT_LABELS,
  MEASUREMENT_LABEL_COPY,
} from "../contracts";

/** PRD 14.2 — action types a holdout may ever apply to (Klaviyo email flows). */
export const HOLDOUT_ELIGIBLE_ACTION_TYPES: readonly ContractActionType[] = [
  "klaviyo_recovery_flow",
  "klaviyo_winback_flow",
];

/** PRD 14.2 default minimum eligible audience for a holdout. */
export const MIN_HOLDOUT_AUDIENCE = 500;

/** PRD 14.3 default holdout percentage. */
export const DEFAULT_HOLDOUT_PERCENT = 10;

export interface MeasurementModeInput {
  actionType: ContractActionType;
  activationLevel: ActivationLevel;
  eligibleAudienceSize: number;
  /** Override of the 500 default (RecipeConfigShape.minHoldoutAudience). */
  minHoldoutAudience?: number;
  /** PRD 14.6 — set true when contamination risk is judged too high to trust a holdout. */
  contaminationTooHigh?: boolean;
}

export interface MeasurementModeDecision {
  mode: MeasurementMode;
  label: MeasurementLabel;
  /** Display copy, e.g. "Before/after, no control group". */
  labelCopy: string;
  /** True when a holdout can be assigned AND enforced. */
  holdoutEligible: boolean;
  /**
   * 26A.1 — true when the action WOULD have been holdout-eligible but the
   * activation level (exportable brief / manual setup) cannot enforce
   * exclusion, so the claim downgraded to before/after.
   */
  downgradedByActivationLevel: boolean;
  /** Every reason that shaped the decision — inspectable, ledger-loggable. */
  reasons: string[];
}

/**
 * Resolve the single measurement mode for an action.
 * Deterministic: same input, same decision.
 */
export function resolveMeasurementMode(
  input: MeasurementModeInput,
): MeasurementModeDecision {
  const reasons: string[] = [];
  const minAudience = input.minHoldoutAudience ?? MIN_HOLDOUT_AUDIENCE;

  // PRD 14.7 — Meta audience sync is ALWAYS directional. No exceptions.
  if (
    input.actionType === "meta_audience_sync" ||
    input.activationLevel === "meta_audience_sync"
  ) {
    reasons.push(
      "Meta audience sync has no causal control in v0 — directional only (PRD 14.7).",
    );
    return decision("directional", false, false, reasons);
  }

  // PRD 14.2 — holdouts apply only to Klaviyo email flows.
  const typeEligible = HOLDOUT_ELIGIBLE_ACTION_TYPES.includes(input.actionType);
  if (!typeEligible) {
    reasons.push(
      `Action type "${input.actionType}" is not a Klaviyo lifecycle flow — holdout not applicable (PRD 14.2).`,
    );
    return decision("before_after_no_control", false, false, reasons);
  }

  // PRD 14.2 / 14.6 — audience must be >= 500.
  if (input.eligibleAudienceSize < minAudience) {
    reasons.push(
      `Eligible audience ${input.eligibleAudienceSize} is below the ${minAudience} minimum — before/after, no control group (PRD 14.6).`,
    );
    return decision("before_after_no_control", false, false, reasons);
  }

  // PRD 14.6 — contamination too high to trust a holdout.
  if (input.contaminationTooHigh) {
    reasons.push(
      "Contamination risk too high for a clean holdout — before/after, no control group (PRD 14.6).",
    );
    return decision("before_after_no_control", false, false, reasons);
  }

  // 26A.1 — holdout claims are valid only when exclusion is enforceable
  // inside the activation path. Brief/manual activation cannot enforce it.
  if (HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS.includes(input.activationLevel)) {
    reasons.push(
      `Activation level "${input.activationLevel}" cannot enforce holdout exclusion in the activation path — measurement downgraded to before/after, no control group (PRD 26A.1).`,
    );
    return decision("before_after_no_control", false, true, reasons);
  }

  reasons.push(
    `Klaviyo flow with eligible audience ${input.eligibleAudienceSize} >= ${minAudience} and enforceable exclusion at activation level "${input.activationLevel}" — holdout-verified measurement available (PRD 14.2/26A.1).`,
  );
  return decision("holdout", true, false, reasons);
}

function decision(
  mode: MeasurementMode,
  holdoutEligible: boolean,
  downgradedByActivationLevel: boolean,
  reasons: string[],
): MeasurementModeDecision {
  return {
    mode,
    label: MEASUREMENT_LABELS[mode],
    labelCopy: MEASUREMENT_LABEL_COPY[mode],
    holdoutEligible,
    downgradedByActivationLevel,
    reasons,
  };
}
