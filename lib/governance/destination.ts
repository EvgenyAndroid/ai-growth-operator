/**
 * lib/governance/destination.ts — destination-compatibility check (PRD 12.5,
 * 26A.8). Verifies the action type, channel, and activation level are mutually
 * coherent, and that Meta audience creation has the merchant's confirmation of
 * the right to use customer identifiers for ad-platform audiences.
 *
 * 26A.8 requires this check to be LOGGED — checkAction includes the result in
 * its return value so lib/server can write it to the ledger with the decision.
 */

import type { ActivationLevel, ContractActionType } from "../contracts";
import { ACTIVATION_LEVELS } from "../contracts";

const ACTION_CHANNEL: Record<ContractActionType, "klaviyo" | "meta"> = {
  klaviyo_recovery_flow: "klaviyo",
  klaviyo_winback_flow: "klaviyo",
  meta_audience_sync: "meta",
};

/** PRD 13.1 fallback ladder for Klaviyo; Meta has exactly one level. */
const CHANNEL_ACTIVATION_LEVELS: Record<"klaviyo" | "meta", ActivationLevel[]> = {
  klaviyo: [
    "klaviyo_flow_draft",
    "klaviyo_campaign_draft",
    "exportable_brief",
    "manual_setup_instructions",
  ],
  meta: ["meta_audience_sync"],
};

export interface DestinationCompatibilityInput {
  actionType: ContractActionType;
  channel: "klaviyo" | "meta";
  activationLevel: ActivationLevel;
  /**
   * 26A.8 — merchant confirmed the right to use customer identifiers for
   * ad-platform audience creation. Required for any Meta action. In Alpha
   * (mocked connectors) this is set during the simulated activation flow.
   */
  metaIdentifierRightsConfirmed?: boolean;
}

export interface DestinationCompatibilityResult {
  compatible: boolean;
  reasons: string[];
  /** Stable summary for the ledger (26A.8: the check must be logged). */
  logSummary: string;
}

export function checkDestinationCompatibility(
  input: DestinationCompatibilityInput,
): DestinationCompatibilityResult {
  const reasons: string[] = [];

  const expectedChannel = ACTION_CHANNEL[input.actionType];
  if (expectedChannel !== input.channel) {
    reasons.push(
      `Action type "${input.actionType}" targets ${expectedChannel}, but the destination channel is ${input.channel}.`,
    );
  }

  const allowedLevels = CHANNEL_ACTIVATION_LEVELS[input.channel];
  if (!allowedLevels.includes(input.activationLevel)) {
    reasons.push(
      `Activation level "${ACTIVATION_LEVELS[input.activationLevel]}" is not valid for the ${input.channel} destination. ` +
        `Valid levels: ${allowedLevels.map((level) => ACTIVATION_LEVELS[level]).join(", ")}.`,
    );
  }

  if (input.channel === "meta" && input.metaIdentifierRightsConfirmed !== true) {
    reasons.push(
      "Meta audience creation requires confirmation that the merchant has the right to use customer " +
        "identifiers for ad-platform audience creation (identifiers are hashed before sync). Confirm to continue.",
    );
  }

  const compatible = reasons.length === 0;
  return {
    compatible,
    reasons,
    logSummary: compatible
      ? `destination-compatibility: pass (${input.actionType} → ${input.channel} @ ${input.activationLevel})`
      : `destination-compatibility: block — ${reasons.join(" | ")}`,
  };
}
