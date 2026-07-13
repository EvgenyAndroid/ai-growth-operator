/**
 * tests/measurement.test.ts — P9 measurement-honesty tests (node:test).
 *
 * Pure-function coverage, no database, fully deterministic:
 *  - holdouts ONLY for Klaviyo lifecycle flows;
 *  - exportable-brief / manual-setup activation downgrades the claim (26A.1);
 *  - audience < 500 => before/after, no control group (PRD 14.2/14.6);
 *  - Meta is ALWAYS directional (PRD 14.7);
 *  - lift is ALWAYS a range, never a point (PRD 14.5);
 *  - a 95% band crossing zero => lift not proven (PRD 14.8);
 *  - contamination is disclosed with the exact PRD 14.4 string.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTAMINATION_DISCLOSURE } from "../lib/measurement/constants";
import { checkContamination } from "../lib/measurement/contamination";
import { assignArm, planHoldout } from "../lib/measurement/holdout";
import { computeLiftRange } from "../lib/measurement/lift";
import {
  MIN_HOLDOUT_AUDIENCE,
  resolveMeasurementMode,
} from "../lib/measurement/mode";

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

test("measurement: holdout applies ONLY to Klaviyo lifecycle flows", () => {
  const eligible = resolveMeasurementMode({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: 1000,
  });
  assert.equal(eligible.mode, "holdout");
  assert.equal(eligible.holdoutEligible, true);

  const winback = resolveMeasurementMode({
    actionType: "klaviyo_winback_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: 1000,
  });
  assert.equal(winback.mode, "holdout");
});

test("measurement: Meta audience sync is ALWAYS directional, regardless of size", () => {
  for (const size of [10, 499, 500, 100_000]) {
    const decision = resolveMeasurementMode({
      actionType: "meta_audience_sync",
      activationLevel: "meta_audience_sync",
      eligibleAudienceSize: size,
    });
    assert.equal(decision.mode, "directional");
    assert.equal(decision.holdoutEligible, false);
  }
});

test("measurement: audience below 500 downgrades to before/after, no control group", () => {
  const decision = resolveMeasurementMode({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: MIN_HOLDOUT_AUDIENCE - 1,
  });
  assert.equal(decision.mode, "before_after_no_control");
  assert.equal(decision.holdoutEligible, false);
  assert.equal(decision.downgradedByActivationLevel, false);
});

test("measurement: brief/manual activation cannot enforce exclusion -> downgraded (26A.1)", () => {
  for (const level of ["exportable_brief", "manual_setup_instructions"] as const) {
    const decision = resolveMeasurementMode({
      actionType: "klaviyo_winback_flow",
      activationLevel: level,
      eligibleAudienceSize: 1000,
    });
    assert.equal(decision.mode, "before_after_no_control");
    assert.equal(decision.downgradedByActivationLevel, true);
  }
});

test("measurement: contamination-too-high downgrades an otherwise eligible holdout", () => {
  const decision = resolveMeasurementMode({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: 1000,
    contaminationTooHigh: true,
  });
  assert.equal(decision.mode, "before_after_no_control");
});

// ---------------------------------------------------------------------------
// Holdout planning + assignment
// ---------------------------------------------------------------------------

test("measurement: planHoldout produces an enforceable 10% plan only when eligible", () => {
  const eligible = planHoldout({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: 1000,
  });
  assert.ok(eligible.plan);
  assert.equal(eligible.plan.holdoutPercent, 10);
  assert.equal(eligible.plan.holdoutSize, 100);
  assert.equal(eligible.plan.assignmentMethod, "randomized_customer_level");
  assert.equal(eligible.plan.enforceable, true);
  // MDE line: an underpowered holdout announces itself at plan time.
  assert.ok(eligible.plan.mde);
  assert.ok(eligible.plan.mde.absoluteRatePoints > 0);
  assert.equal(eligible.plan.mde.power, 0.8);
  assert.ok(eligible.plan.mde.note.includes("80% power"));
  // Larger audiences detect smaller effects.
  const bigger = planHoldout({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "klaviyo_campaign_draft",
    eligibleAudienceSize: 10_000,
  });
  assert.ok(bigger.plan);
  assert.ok(
    bigger.plan.mde!.absoluteRatePoints < eligible.plan.mde.absoluteRatePoints,
  );

  const ineligible = planHoldout({
    actionType: "klaviyo_recovery_flow",
    activationLevel: "exportable_brief",
    eligibleAudienceSize: 1000,
  });
  assert.equal(ineligible.plan, null);
});

test("measurement: arm assignment is deterministic per (seed, customer) and ~10%", () => {
  const seed = "acct:klaviyo_recovery_flow:action1";
  assert.equal(assignArm(seed, "customer-42"), assignArm(seed, "customer-42"));

  let heldOut = 0;
  const N = 10_000;
  for (let i = 0; i < N; i += 1) {
    if (assignArm(seed, `customer-${i}`) === "held_out") heldOut += 1;
  }
  const share = heldOut / N;
  assert.ok(share > 0.08 && share < 0.12, `held-out share ${share} not ~10%`);
});

// ---------------------------------------------------------------------------
// Lift — always a range; zero-crossing band = not proven
// ---------------------------------------------------------------------------

test("measurement: lift is reported as a RANGE, never a single point", () => {
  // 15% vs 5% on a 100-person control — decisively proven under Newcombe.
  const result = computeLiftRange({
    treated: { size: 900, purchasers: 135, revenue: 13_500, refunds: 500 },
    heldOut: { size: 100, purchasers: 5, revenue: 500, refunds: 0 },
    contaminationRisk: "none",
  });
  assert.notEqual(result.measuredLiftLow, null);
  assert.notEqual(result.measuredLiftHigh, null);
  assert.ok((result.measuredLiftLow as number) < (result.measuredLiftHigh as number));
  assert.ok(result.absoluteRateDiffLow < result.absoluteRateDiffHigh);
  assert.equal(result.liftNotProven, false);
  assert.equal(result.method, "newcombe_wilson_95");
});

test("measurement: Newcombe is stricter than Wald on small controls (regression)", () => {
  // This exact fixture was 'proven' under the old Wald interval; Newcombe's
  // honest control-side bound (8/100) widens the band across zero. The
  // stricter verdict is the point of the upgrade.
  const result = computeLiftRange({
    treated: { size: 900, purchasers: 135, revenue: 13_500, refunds: 500 },
    heldOut: { size: 100, purchasers: 8, revenue: 800, refunds: 0 },
    contaminationRisk: "none",
  });
  assert.equal(result.liftNotProven, true);
  assert.equal(result.confidence, "low");
});

test("measurement: Newcombe interval stays sane when the holdout arm has zero purchases", () => {
  // Wald degenerates here (control variance term = 0); Newcombe must not.
  const result = computeLiftRange({
    treated: { size: 500, purchasers: 50, revenue: 5_000, refunds: 0 },
    heldOut: { size: 50, purchasers: 0, revenue: 0, refunds: 0 },
    contaminationRisk: "none",
  });
  assert.equal(result.method, "newcombe_wilson_95");
  // Relative lift undefined at zero baseline; absolute band still real.
  assert.equal(result.measuredLiftLow, null);
  assert.ok(Number.isFinite(result.absoluteRateDiffLow));
  assert.ok(Number.isFinite(result.absoluteRateDiffHigh));
  // The band must have genuine width (Wald would collapse the control side).
  assert.ok(result.absoluteRateDiffHigh - result.absoluteRateDiffLow > 0.01);
  assert.ok(result.caveats.some((c) => c.includes("zero purchases")));
});

test("measurement: a 95% band crossing zero means lift is NOT proven (PRD 14.8)", () => {
  const result = computeLiftRange({
    treated: { size: 100, purchasers: 10, revenue: 1_000, refunds: 0 },
    heldOut: { size: 100, purchasers: 9, revenue: 900, refunds: 0 },
    contaminationRisk: "none",
  });
  assert.equal(result.liftNotProven, true);
  assert.equal(result.confidence, "low");
  assert.ok(result.caveats.some((caveat) => caveat.includes("cannot be proven")));
  // Never a negative "recovered revenue" claim.
  assert.ok(result.incrementalRevenueLow >= 0);
});

test("measurement: flagged contamination caps confidence below high", () => {
  const clean = computeLiftRange({
    treated: { size: 2_000, purchasers: 400, revenue: 40_000, refunds: 0 },
    heldOut: { size: 220, purchasers: 20, revenue: 2_000, refunds: 0 },
    contaminationRisk: "none",
  });
  assert.equal(clean.confidence, "high");
  const flagged = computeLiftRange({
    treated: { size: 2_000, purchasers: 400, revenue: 40_000, refunds: 0 },
    heldOut: { size: 220, purchasers: 20, revenue: 2_000, refunds: 0 },
    contaminationRisk: "flagged",
  });
  assert.equal(flagged.confidence, "medium");
});

// ---------------------------------------------------------------------------
// Contamination disclosure (PRD 14.4 / 26A.5)
// ---------------------------------------------------------------------------

test("measurement: holdout overlap with an active reach source is disclosed verbatim", () => {
  const result = checkContamination({
    holdoutEmailsLower: ["alice@example.com", "bob@example.com"],
    sources: [
      {
        type: "klaviyo_other_flow",
        name: "Legacy newsletter",
        active: true,
        memberEmailsLower: ["ALICE@example.com"],
      },
    ],
  });
  assert.equal(result.risk, "flagged");
  assert.equal(result.disclosure, CONTAMINATION_DISCLOSURE);
  assert.ok(result.caveats.includes(CONTAMINATION_DISCLOSURE));
  assert.equal(result.overlaps[0]?.overlapCount, 1);
});

test("measurement: unknowable membership on an active source flags AND lowers confidence (26A.5)", () => {
  const result = checkContamination({
    holdoutEmailsLower: ["alice@example.com"],
    sources: [
      {
        type: "shopify_native_abandoned_checkout",
        name: "Shopify native recovery",
        active: true,
        // memberEmailsLower intentionally unknown
      },
    ],
  });
  assert.equal(result.risk, "flagged");
  assert.equal(result.lowerConfidence, true);
});

test("measurement: no overlap and no active sources are honest too", () => {
  const noActive = checkContamination({ holdoutEmailsLower: ["a@x.com"], sources: [] });
  assert.equal(noActive.risk, "none");
  const activeNoOverlap = checkContamination({
    holdoutEmailsLower: ["a@x.com"],
    sources: [
      {
        type: "klaviyo_other_flow",
        name: "Other",
        active: true,
        memberEmailsLower: ["someone-else@x.com"],
      },
    ],
  });
  assert.equal(activeNoOverlap.risk, "low");
  assert.equal(activeNoOverlap.disclosure, null);
});
