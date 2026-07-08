/**
 * lib/governance/check-action.ts — THE governance runtime chokepoint
 * (PRD 12.5–12.7). Every activation must pass through checkAction(); there is
 * no code path that activates without it (lib/server enforces call order and
 * can use assertGovernancePass to make skipping impossible to compile around).
 *
 * Gates evaluated (PRD 12.5):
 *   approval status · consent (email for Klaviyo, ads for Meta) · suppression ·
 *   discount ceiling · margin floor · daily send cap + budget cap ·
 *   banned/unsupported claims (PRD 12.6) · data freshness (PRD 8.4/8.5) ·
 *   destination compatibility (26A.8, logged).
 *
 * Fail-closed philosophy: unknown customers, missing Constitution, missing
 * approval, or unparseable freshness data all BLOCK.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { db } from "../db";
import type { GovernanceCheckInput, GovernanceCheckResult, GovernanceGate } from "../contracts";
import type { Constitution } from "../contracts/models";
import { scanCopyForClaims, type ClaimFinding } from "./claims";
import { findStaleSources, type FreshnessEvaluation } from "./freshness";
import {
  checkDestinationCompatibility,
  type DestinationCompatibilityResult,
} from "./destination";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckActionOptions {
  /**
   * Claims the user has EXPLICITLY overridden (canonical lowercase claim keys
   * from ClaimFinding.claim). Only overrideable claims can be overridden;
   * the non-overrideable subset (PRD 12.6) blocks regardless.
   */
  claimOverrides?: string[];
  /** 26A.8 — merchant confirmed identifier-usage rights for Meta audiences. */
  metaIdentifierRightsConfirmed?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

type GateEntry = GovernanceCheckResult["gates"][number];

/**
 * Superset of the contract result: extra fields are additive, so every caller
 * typed against GovernanceCheckResult works unchanged. The extras exist so
 * lib/server can log the 26A.8 destination check and render claim flags.
 */
export interface GovernanceDecision extends GovernanceCheckResult {
  constitutionVersion: number;
  checkedAt: string; // ISO
  /** 26A.8 — must be logged with the decision. */
  destinationCompatibility: DestinationCompatibilityResult;
  /** Full claim findings for the flag-and-suggest UI (PRD 12.6). */
  claimFindings: ClaimFinding[];
  /** Stale-source detail incl. PRD 8.5 re-sync messages. */
  staleSources: FreshnessEvaluation[];
}

/** Thrown by assertGovernancePass — activation paths catch nothing and abort. */
export class GovernanceBlockedError extends Error {
  readonly decision: GovernanceDecision;
  constructor(decision: GovernanceDecision) {
    super(`Governance blocked activation: ${decision.reasons.join(" | ")}`);
    this.name = "GovernanceBlockedError";
    this.decision = decision;
  }
}

/** Call after checkAction in any activation path; throws on block. */
export function assertGovernancePass(decision: GovernanceDecision): GovernanceDecision {
  if (decision.verdict !== "pass") throw new GovernanceBlockedError(decision);
  return decision;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_QUERY_CHUNK = 500; // stay under SQLite bind-parameter limits

interface AudienceCustomerRow {
  id: string;
  consentEmail: boolean;
  consentAds: boolean;
  suppressionStatus: string;
}

async function fetchAudienceCustomers(
  accountId: string,
  customerIds: string[],
): Promise<AudienceCustomerRow[]> {
  const rows: AudienceCustomerRow[] = [];
  for (let i = 0; i < customerIds.length; i += CUSTOMER_QUERY_CHUNK) {
    const chunk = customerIds.slice(i, i + CUSTOMER_QUERY_CHUNK);
    const found = await db.customer.findMany({
      where: { accountId, id: { in: chunk } },
      select: {
        id: true,
        consentEmail: true,
        consentAds: true,
        suppressionStatus: true,
      },
    });
    rows.push(...found);
  }
  return rows;
}

function gate(
  name: GovernanceGate,
  outcome: GateEntry["outcome"],
  reason?: string,
): GateEntry {
  return reason === undefined ? { gate: name, outcome } : { gate: name, outcome, reason };
}

// ---------------------------------------------------------------------------
// checkAction — the single chokepoint
// ---------------------------------------------------------------------------

export async function checkAction(
  input: GovernanceCheckInput,
  options: CheckActionOptions = {},
): Promise<GovernanceDecision> {
  const now = options.now ?? new Date();
  const gates: GateEntry[] = [];
  const reasons: string[] = [];
  const remediations: string[] = [];

  // --- Load the governing Constitution (Operating Rules). Fail closed. -----
  const constitution: Constitution | null = await db.constitution.findFirst({
    where: { accountId: input.accountId, version: input.constitutionVersion },
  });

  if (!constitution) {
    const reason =
      `No Operating Rules version ${input.constitutionVersion} exists for this account. ` +
      "Actions cannot be evaluated without active Operating Rules.";
    const destinationCompatibility = checkDestinationCompatibility({
      actionType: input.actionType,
      channel: input.channel,
      activationLevel: input.activationLevel,
      metaIdentifierRightsConfirmed: options.metaIdentifierRightsConfirmed,
    });
    return {
      verdict: "block",
      gates: [
        gate("approval_gate", "block", reason),
        gate("consent", "block", reason),
        gate("suppression", "block", reason),
        gate("budget_limit", "block", reason),
        gate("discount_limit", "block", reason),
        gate("margin_rule", "block", reason),
        gate("banned_claims", "block", reason),
        gate("freshness", "block", reason),
      ],
      reasons: [reason],
      remediations: ["Complete onboarding to create Operating Rules, then re-run this check."],
      constitutionVersion: input.constitutionVersion,
      checkedAt: now.toISOString(),
      destinationCompatibility,
      claimFindings: [],
      staleSources: [],
    };
  }

  // --- Destination compatibility (PRD 12.5, 26A.8 — logged) ----------------
  const destinationCompatibility = checkDestinationCompatibility({
    actionType: input.actionType,
    channel: input.channel,
    activationLevel: input.activationLevel,
    metaIdentifierRightsConfirmed: options.metaIdentifierRightsConfirmed,
  });
  if (!destinationCompatibility.compatible) {
    reasons.push(...destinationCompatibility.reasons);
  }

  // --- Approval gate (26A.4: draft is not activation) -----------------------
  if (!input.approvalId) {
    gates.push(
      gate(
        "approval_gate",
        "block",
        "Creating a draft is not activation. Customer-facing sends, audience syncs, and " +
          "suppression changes require explicit approval — no approval record exists for this action.",
      ),
    );
  } else {
    const approval = await db.approval.findFirst({
      where: { id: input.approvalId, accountId: input.accountId },
      select: { status: true },
    });
    if (!approval) {
      gates.push(
        gate("approval_gate", "block", `Approval record ${input.approvalId} was not found for this account.`),
      );
    } else if (approval.status !== "approved") {
      gates.push(
        gate(
          "approval_gate",
          "block",
          `Approval status is "${approval.status}" — activation requires an explicit "approved" status.`,
        ),
      );
    } else {
      gates.push(gate("approval_gate", "pass"));
    }
  }

  // --- Consent + suppression (channel-specific consent field, 26B.13) ------
  if (input.audienceCustomerIds.length === 0) {
    gates.push(gate("consent", "not_applicable", "Audience is empty."));
    gates.push(gate("suppression", "not_applicable", "Audience is empty."));
  } else {
    const customers = await fetchAudienceCustomers(input.accountId, input.audienceCustomerIds);
    const foundIds = new Set(customers.map((customer) => customer.id));
    const missingCount = input.audienceCustomerIds.filter((id) => !foundIds.has(id)).length;

    const consentField = input.channel === "meta" ? "consentAds" : "consentEmail";
    const consentLabel =
      input.channel === "meta"
        ? "ads consent (right to use identifiers for ad audiences)"
        : "email marketing consent";
    const nonConsented = customers.filter((customer) => !customer[consentField]);

    if (missingCount > 0 || nonConsented.length > 0) {
      const parts: string[] = [];
      if (nonConsented.length > 0) {
        parts.push(`${nonConsented.length} audience member(s) lack ${consentLabel}`);
      }
      if (missingCount > 0) {
        parts.push(`${missingCount} audience id(s) do not resolve to known customers (fail closed)`);
      }
      gates.push(gate("consent", "block", `${parts.join("; ")}.`));
      remediations.push(
        "Remove non-consented and unresolved customers from the audience and re-run the check.",
      );
    } else {
      gates.push(gate("consent", "pass"));
    }

    const suppressed = customers.filter((customer) => customer.suppressionStatus !== "none");
    if (suppressed.length > 0) {
      gates.push(
        gate(
          "suppression",
          "block",
          `${suppressed.length} audience member(s) are suppressed and must be excluded before activation.`,
        ),
      );
      remediations.push("Exclude suppressed customers from the audience.");
    } else {
      gates.push(gate("suppression", "pass"));
    }
  }

  // --- Discount ceiling ------------------------------------------------------
  if (input.discountPercent === undefined) {
    gates.push(gate("discount_limit", "not_applicable", "No discount attached to this action."));
  } else if (input.discountPercent > constitution.maxDiscountPercent) {
    gates.push(
      gate(
        "discount_limit",
        "block",
        `Discount of ${input.discountPercent}% exceeds your Operating Rules maximum of ${constitution.maxDiscountPercent}%.`,
      ),
    );
    remediations.push(
      `Reduce the discount to ${constitution.maxDiscountPercent}% or lower, or edit your Operating Rules.`,
    );
  } else {
    gates.push(gate("discount_limit", "pass"));
  }

  // --- Margin floor -----------------------------------------------------------
  if (constitution.marginFloorPercent === null || constitution.marginFloorPercent === undefined) {
    gates.push(gate("margin_rule", "not_applicable", "No margin floor is configured in Operating Rules."));
  } else if (input.discountPercent === undefined) {
    gates.push(gate("margin_rule", "not_applicable", "No discount attached to this action."));
  } else if (100 - input.discountPercent < constitution.marginFloorPercent) {
    gates.push(
      gate(
        "margin_rule",
        "block",
        `A ${input.discountPercent}% discount leaves ${100 - input.discountPercent}% of price, below your ` +
          `Operating Rules margin floor of ${constitution.marginFloorPercent}%.`,
      ),
    );
    remediations.push(
      `Cap the discount at ${Math.max(0, 100 - constitution.marginFloorPercent)}% to respect the margin floor.`,
    );
  } else {
    gates.push(gate("margin_rule", "pass"));
  }

  // --- Budget cap + daily send cap -------------------------------------------
  // NOTE: the GovernanceGate contract union has a single "budget_limit" gate;
  // the daily send cap (a volume budget, PRD 12.4/12.5) is evaluated under it
  // with a distinct reason string.
  {
    const budgetReasons: string[] = [];
    if (input.estimatedSpend !== undefined && input.estimatedSpend > constitution.monthlyBudgetCap) {
      budgetReasons.push(
        `Estimated spend $${input.estimatedSpend} exceeds your monthly budget cap of $${constitution.monthlyBudgetCap}.`,
      );
      remediations.push("Lower the spend or raise the monthly budget cap in Operating Rules.");
    }
    if (input.channel === "klaviyo" && input.audienceCustomerIds.length > constitution.dailySendCap) {
      budgetReasons.push(
        `Audience of ${input.audienceCustomerIds.length} exceeds your daily send cap of ${constitution.dailySendCap}.`,
      );
      remediations.push(
        `Split the send across days or reduce the audience to ${constitution.dailySendCap} or fewer.`,
      );
    }
    if (budgetReasons.length > 0) {
      gates.push(gate("budget_limit", "block", budgetReasons.join(" ")));
    } else if (input.estimatedSpend === undefined && input.channel !== "klaviyo") {
      gates.push(gate("budget_limit", "not_applicable", "No spend or send volume applies to this action."));
    } else {
      gates.push(gate("budget_limit", "pass"));
    }
  }

  // --- Banned / unsupported claims (PRD 12.6) ---------------------------------
  const merchantBannedClaims = Array.isArray(constitution.bannedClaims)
    ? (constitution.bannedClaims as unknown[]).filter((claim): claim is string => typeof claim === "string")
    : [];
  const claimFindings = scanCopyForClaims(input.copyText, {
    merchantBannedClaims,
    channel: input.channel,
  });
  const overrides = new Set((options.claimOverrides ?? []).map((claim) => claim.toLowerCase()));
  const blockingClaims = claimFindings.filter(
    (finding) => finding.nonOverrideable || !overrides.has(finding.claim),
  );
  if (claimFindings.length === 0) {
    gates.push(gate("banned_claims", "pass"));
  } else if (blockingClaims.length === 0) {
    gates.push(
      gate(
        "banned_claims",
        "pass",
        `${claimFindings.length} flagged claim(s) explicitly overridden by the user (override logged).`,
      ),
    );
  } else {
    const hard = blockingClaims.filter((finding) => finding.nonOverrideable);
    const soft = blockingClaims.filter((finding) => !finding.nonOverrideable);
    const parts: string[] = [];
    if (hard.length > 0) {
      parts.push(
        `Non-overrideable claim(s): ${[...new Set(hard.map((finding) => `"${finding.claim}"`))].join(", ")} — must be removed.`,
      );
    }
    if (soft.length > 0) {
      parts.push(
        `Flagged claim(s): ${[...new Set(soft.map((finding) => `"${finding.claim}"`))].join(", ")} — edit the copy or explicitly override.`,
      );
    }
    gates.push(gate("banned_claims", "block", parts.join(" ")));
    for (const finding of blockingClaims) {
      remediations.push(`Instead of "${finding.claim}": ${finding.saferAlternative}`);
    }
  }

  // --- Data freshness (PRD 8.4 thresholds, 8.5 message shape) -----------------
  const staleSources = findStaleSources(input.sourceFreshness, now);
  if (input.sourceFreshness.length === 0) {
    // No declared sources means freshness cannot be verified — fail closed.
    gates.push(
      gate(
        "freshness",
        "block",
        "This action declares no source freshness data, so staleness cannot be verified. Fail closed.",
      ),
    );
  } else if (staleSources.length > 0) {
    for (const stale of staleSources) {
      gates.push(gate("freshness", "block", stale.blockMessage));
      remediations.push(`Re-sync ${stale.source} and re-run the check.`);
    }
  } else {
    gates.push(gate("freshness", "pass"));
  }

  // --- Verdict -----------------------------------------------------------------
  for (const entry of gates) {
    if (entry.outcome === "block" && entry.reason) reasons.push(entry.reason);
  }
  const verdict: "pass" | "block" =
    reasons.length === 0 && destinationCompatibility.compatible ? "pass" : "block";

  return {
    verdict,
    gates,
    reasons: verdict === "pass" ? [] : reasons,
    remediations: [...new Set(remediations)],
    constitutionVersion: constitution.version,
    checkedAt: now.toISOString(),
    destinationCompatibility,
    claimFindings,
    staleSources,
  };
}
