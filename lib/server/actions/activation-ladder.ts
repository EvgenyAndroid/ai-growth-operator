/**
 * lib/server/actions/activation-ladder.ts — helpers shared by the action
 * slice (hardening P11 split; extracted verbatim from lib/server/actions.ts).
 *
 * channelFor / governanceView are pure mappers. simulateActivationLadder is
 * the SIMULATED Klaviyo/Meta activation ladder (PRD 13, 25.1 Alpha, 26B.17):
 * it only DESCRIBES what a launch does — actual (simulated) activation still
 * happens exclusively inside approveAction, behind the governance chokepoint.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type { ActivationLevel, ContractActionType } from "../../contracts";
import { ACTIVATION_LEVELS } from "../../contracts";
import type { GovernanceDecision } from "../../governance";
import type { ActivationLadderStep, GovernanceDecisionView } from "../types";

export function channelFor(actionType: ContractActionType): "klaviyo" | "meta" {
  return actionType === "meta_audience_sync" ? "meta" : "klaviyo";
}

export function governanceView(decision: GovernanceDecision): GovernanceDecisionView {
  return {
    verdict: decision.verdict,
    gates: decision.gates,
    reasons: decision.reasons,
    remediations: decision.remediations,
    claimFindings: decision.claimFindings.map((finding) => ({
      claim: finding.claim,
      why: finding.why,
      saferAlternative: finding.saferAlternative,
      overrideable: !finding.nonOverrideable,
    })),
    constitutionVersion: decision.constitutionVersion,
    checkedAt: decision.checkedAt,
    destinationCompatibilitySummary: decision.destinationCompatibility.logSummary,
  };
}

/** Simulated Klaviyo/Meta activation ladder (PRD 13, 25.1 Alpha, 26B.17). */
export function simulateActivationLadder(
  channel: "klaviyo" | "meta",
  targetLevel: ActivationLevel,
): { finalLevel: ActivationLevel; ladder: ActivationLadderStep[] } {
  if (channel === "meta") {
    return {
      finalLevel: "meta_audience_sync",
      ladder: [
        {
          level: "meta_audience_sync",
          levelCopy: ACTIVATION_LEVELS.meta_audience_sync,
          outcome: "succeeded_simulated",
          detail:
            "Seed + suppression audiences accepted by the mocked Meta connector (Alpha simulation, PRD 25.1).",
        },
      ],
    };
  }
  const ladder: ActivationLadderStep[] = [
    {
      level: "klaviyo_flow_draft",
      levelCopy: ACTIVATION_LEVELS.klaviyo_flow_draft,
      outcome: "unavailable",
      detail:
        "Klaviyo flow-draft creation is unavailable in the public API at build time (26B.17) — falling back.",
    },
  ];
  if (targetLevel === "klaviyo_campaign_draft" || targetLevel === "klaviyo_flow_draft") {
    ladder.push({
      level: "klaviyo_campaign_draft",
      levelCopy: ACTIVATION_LEVELS.klaviyo_campaign_draft,
      outcome: "succeeded_simulated",
      detail:
        "Campaign draft created in the mocked Klaviyo connector with audience, copy, suppression rules, and timing (Alpha simulation).",
    });
    return { finalLevel: "klaviyo_campaign_draft", ladder };
  }
  // Exportable brief / manual setup: 26A.1 downgrade territory.
  ladder.push({
    level: "klaviyo_campaign_draft",
    levelCopy: ACTIVATION_LEVELS.klaviyo_campaign_draft,
    outcome: "skipped",
    detail: "Campaign-draft level not targeted by this action.",
  });
  ladder.push({
    level: targetLevel,
    levelCopy: ACTIVATION_LEVELS[targetLevel],
    outcome: "succeeded_simulated",
    detail:
      targetLevel === "exportable_brief"
        ? "Exportable brief generated (PRD 13.3). Holdout exclusion cannot be enforced at this level (26A.1)."
        : "Manual setup instructions generated (PRD 13.1 Level 4). Holdout exclusion cannot be enforced at this level (26A.1).",
  });
  return { finalLevel: targetLevel, ladder };
}
