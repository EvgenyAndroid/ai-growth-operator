/**
 * lib/measurement/holdout.ts — holdout planning + assignment (PRD 14.2/14.3, 26A.1, 26B.12/26B.14).
 *
 * Assignment is 10% randomized customer-level via a SEEDED HASH:
 * deterministic for a given (seed, customerId) pair, so re-running assignment
 * never reshuffles arms, but independent per flow because each holdout gets
 * its own seed (26B.14 — customers may sit in multiple concurrent holdouts).
 *
 * Persistence writes one Holdout row + one HoldoutMembership row per customer
 * (arm: held_out | treated) so exclusion is enforceable on the 26B.12 join key
 * and visible in the Context Ledger (PRD 14.3).
 */

import type { ActivationLevel, ContractActionType, HoldoutPlan } from "../contracts";
import { db as defaultDb } from "../db";
import {
  DEFAULT_HOLDOUT_PERCENT,
  MIN_HOLDOUT_AUDIENCE,
  resolveMeasurementMode,
  type MeasurementModeDecision,
} from "./mode";

export type HoldoutArm = "held_out" | "treated";

// ---------------------------------------------------------------------------
// Seeded hash — FNV-1a 32-bit. Fast, dependency-free, uniform enough for a
// 10% split. NOT cryptographic; assignment only needs determinism + balance.
// ---------------------------------------------------------------------------

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // unsigned 32-bit
}

/**
 * Randomized customer-level assignment (PRD 14.3).
 * Buckets 0..9999; held_out iff bucket < holdoutPercent * 100.
 * Deterministic per (seed, customerId).
 */
export function assignArm(
  seed: string,
  customerId: string,
  holdoutPercent: number = DEFAULT_HOLDOUT_PERCENT,
): HoldoutArm {
  const bucket = fnv1a32(`${seed}:${customerId}`) % 10000;
  return bucket < Math.round(holdoutPercent * 100) ? "held_out" : "treated";
}

// ---------------------------------------------------------------------------
// Planning — pure. Decides eligibility + mode, produces a HoldoutPlan.
// ---------------------------------------------------------------------------

export interface HoldoutPlanInput {
  actionType: ContractActionType;
  activationLevel: ActivationLevel;
  eligibleAudienceSize: number;
  holdoutPercent?: number; // default 10 (PRD 14.3)
  minHoldoutAudience?: number; // default 500 (PRD 14.2)
  /** ISO-8601 duration the exclusion must hold for (e.g. "P14D" = long read window). */
  exclusionWindow?: string;
  contaminationTooHigh?: boolean;
}

export interface HoldoutPlanResult {
  decision: MeasurementModeDecision;
  /** Present iff decision.mode === "holdout". */
  plan: HoldoutPlan | null;
}

/** Plan a holdout (or explain why one is unavailable). Pure and deterministic. */
export function planHoldout(input: HoldoutPlanInput): HoldoutPlanResult {
  const decision = resolveMeasurementMode(input);
  if (decision.mode !== "holdout") {
    return { decision, plan: null };
  }
  const holdoutPercent = input.holdoutPercent ?? DEFAULT_HOLDOUT_PERCENT;
  const plan: HoldoutPlan = {
    eligibleAudienceSize: input.eligibleAudienceSize,
    holdoutPercent,
    holdoutSize: Math.round(
      (input.eligibleAudienceSize * holdoutPercent) / 100,
    ),
    assignmentMethod: "randomized_customer_level",
    exclusionWindow: input.exclusionWindow ?? "P30D",
    enforceable: true, // decision.mode === "holdout" already implies 26A.1 passed
  };
  return { decision, plan };
}

// ---------------------------------------------------------------------------
// Assignment + persistence
// ---------------------------------------------------------------------------

export interface AssignHoldoutInput {
  accountId: string;
  /** Customer ids (Customer.id) in the eligible audience AFTER consent/suppression/exclusion filtering. */
  customerIds: string[];
  actionType: ContractActionType;
  activationLevel: ActivationLevel;
  holdoutPercent?: number;
  minHoldoutAudience?: number;
  exclusionWindow?: string;
  contaminationTooHigh?: boolean;
  /**
   * Seed for the assignment hash. MUST be unique per flow launch so holdouts
   * are independent across flows (26B.14). Defaults to
   * `${accountId}:${actionType}` which is stable per recipe per account in v0
   * (one active card per recipe — 26B.16).
   */
  seed?: string;
  startedAt?: Date;
}

export interface AssignHoldoutResult {
  decision: MeasurementModeDecision;
  plan: HoldoutPlan | null;
  /** Null when no holdout was assigned (ineligible/downgraded). */
  holdoutId: string | null;
  heldOutCustomerIds: string[];
  treatedCustomerIds: string[];
}

/**
 * Assign a 10% randomized customer-level holdout at launch time (PRD 14.3)
 * and persist Holdout + memberships. If the action is ineligible or the
 * activation level cannot enforce exclusion (26A.1), nothing is written and
 * the decision explains the fallback mode.
 *
 * Alpha note (PRD 25.1): "simulated holdout" means assignment is real and
 * persisted, but no live Klaviyo exclusion API call is made; enforcement is
 * simulated by the demo activation layer honoring heldOutCustomerIds.
 */
export async function assignHoldout(
  input: AssignHoldoutInput,
  client: typeof defaultDb = defaultDb,
): Promise<AssignHoldoutResult> {
  const { decision, plan } = planHoldout({
    actionType: input.actionType,
    activationLevel: input.activationLevel,
    eligibleAudienceSize: input.customerIds.length,
    holdoutPercent: input.holdoutPercent,
    minHoldoutAudience: input.minHoldoutAudience,
    exclusionWindow: input.exclusionWindow,
    contaminationTooHigh: input.contaminationTooHigh,
  });

  if (decision.mode !== "holdout" || plan === null) {
    return {
      decision,
      plan: null,
      holdoutId: null,
      heldOutCustomerIds: [],
      treatedCustomerIds: [...input.customerIds],
    };
  }

  const seed = input.seed ?? `${input.accountId}:${input.actionType}`;
  const heldOutCustomerIds: string[] = [];
  const treatedCustomerIds: string[] = [];
  for (const customerId of input.customerIds) {
    if (assignArm(seed, customerId, plan.holdoutPercent) === "held_out") {
      heldOutCustomerIds.push(customerId);
    } else {
      treatedCustomerIds.push(customerId);
    }
  }

  const holdout = await client.$transaction(async (tx) => {
    const created = await tx.holdout.create({
      data: {
        accountId: input.accountId,
        eligibleAudienceSize: input.customerIds.length,
        holdoutPercent: plan.holdoutPercent,
        holdoutSize: heldOutCustomerIds.length,
        assignmentMethod: "randomized_customer_level",
        startedAt: input.startedAt ?? new Date(),
        exclusionWindow: plan.exclusionWindow,
        status: "active",
      },
    });
    await tx.holdoutMembership.createMany({
      data: [
        ...heldOutCustomerIds.map((customerId) => ({
          holdoutId: created.id,
          customerId,
          arm: "held_out",
        })),
        ...treatedCustomerIds.map((customerId) => ({
          holdoutId: created.id,
          customerId,
          arm: "treated",
        })),
      ],
    });
    return created;
  });

  return {
    decision,
    plan: {
      ...plan,
      holdoutSize: heldOutCustomerIds.length, // actual, not the pre-hash estimate
    },
    holdoutId: holdout.id,
    heldOutCustomerIds,
    treatedCustomerIds,
  };
}

/**
 * Load the arm map for a persisted holdout — used by lift readback and by
 * the activation layer to enforce exclusion (a held-out customer must be
 * excludable by the 26B.12 lowercase-email join key or the holdout is not
 * clean).
 */
export async function loadHoldoutArms(
  holdoutId: string,
  client: typeof defaultDb = defaultDb,
): Promise<Map<string, HoldoutArm>> {
  const memberships = await client.holdoutMembership.findMany({
    where: { holdoutId },
    select: { customerId: true, arm: true },
  });
  const arms = new Map<string, HoldoutArm>();
  for (const m of memberships) {
    arms.set(m.customerId, m.arm === "held_out" ? "held_out" : "treated");
  }
  return arms;
}
