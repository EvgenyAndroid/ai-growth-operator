/**
 * tests/governance.test.ts — P9 governance-chokepoint tests (node:test).
 *
 * Runs checkAction() against a THROWAWAY demo account created in before() and
 * cascade-deleted in after() — the seeded demo workspaces are never touched,
 * so the smoke suite's baseline stays pristine. Deterministic: fixed clock,
 * fixed fixture rows, no live services.
 *
 * Brief coverage: unapproved activation blocks; stale source blocks;
 * non-overrideable claim blocks (even with an override); overrideable claim
 * passes ONLY with an explicit override; Meta requires identifier-rights
 * confirmation; suppressed / non-consented audience members block.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import type { DataFreshness, GovernanceCheckInput } from "../lib/contracts";
import { db } from "../lib/db";
import {
  checkAction,
  type CheckActionOptions,
} from "../lib/governance/check-action";
import { AS_OF, hoursAgo } from "./helpers";

let accountId = "";
let approvedApprovalId = "";
let pendingApprovalId = "";
let okCustomerId = "";
let noConsentCustomerId = "";
let suppressedCustomerId = "";

function fresh(): DataFreshness[] {
  return [
    { source: "shopify", lastSyncAt: AS_OF.toISOString(), thresholdHours: 24, isStale: false },
    { source: "klaviyo", lastSyncAt: AS_OF.toISOString(), thresholdHours: 24, isStale: false },
  ];
}

function baseInput(overrides: Partial<GovernanceCheckInput> = {}): GovernanceCheckInput {
  return {
    accountId,
    constitutionVersion: 1,
    actionType: "klaviyo_recovery_flow",
    channel: "klaviyo",
    activationLevel: "klaviyo_campaign_draft",
    audienceCustomerIds: [okCustomerId],
    copyText: ["Your cart is waiting — come back and finish your order."],
    sourceFreshness: fresh(),
    approvalId: approvedApprovalId,
    ...overrides,
  };
}

function options(overrides: Partial<CheckActionOptions> = {}): CheckActionOptions {
  return { now: AS_OF, ...overrides };
}

function gateOutcome(
  decision: Awaited<ReturnType<typeof checkAction>>,
  gate: string,
): string[] {
  return decision.gates
    .filter((entry) => entry.gate === gate)
    .map((entry) => entry.outcome);
}

before(async () => {
  const account = await db.account.create({
    data: {
      name: "P9 Governance Test Workspace",
      vertical: "shopify_dtc",
      demoMode: true,
    },
  });
  accountId = account.id;

  await db.constitution.create({
    data: {
      accountId,
      templateVertical: "shopify_dtc",
      version: 1,
      monthlyBudgetCap: 1000,
      maxDiscountPercent: 20,
      marginFloorPercent: 60,
      dailySendCap: 1000,
      bannedClaims: ["miracle formula"],
      effectiveFrom: AS_OF,
    },
  });

  const ok = await db.customer.create({
    data: {
      accountId,
      sourceCustomerIds: { shopify: "shp_gov_ok" },
      emailHash: "hash_gov_ok",
      emailLower: "gov_ok@example.com",
      consentEmail: true,
      consentAds: true,
      suppressionStatus: "none",
    },
  });
  okCustomerId = ok.id;
  const noConsent = await db.customer.create({
    data: {
      accountId,
      sourceCustomerIds: { shopify: "shp_gov_nc" },
      emailHash: "hash_gov_nc",
      emailLower: "gov_nc@example.com",
      consentEmail: false,
      consentAds: false,
      suppressionStatus: "none",
    },
  });
  noConsentCustomerId = noConsent.id;
  const suppressed = await db.customer.create({
    data: {
      accountId,
      sourceCustomerIds: { shopify: "shp_gov_sup" },
      emailHash: "hash_gov_sup",
      emailLower: "gov_sup@example.com",
      consentEmail: true,
      consentAds: true,
      suppressionStatus: "complaint",
    },
  });
  suppressedCustomerId = suppressed.id;

  const approved = await db.approval.create({
    data: { accountId, status: "approved", approver: "tester", timestamp: AS_OF },
  });
  approvedApprovalId = approved.id;
  const pending = await db.approval.create({
    data: { accountId, status: "pending" },
  });
  pendingApprovalId = pending.id;
});

after(async () => {
  if (accountId) {
    await db.account.delete({ where: { id: accountId } }); // cascades everything
  }
  await db.$disconnect();
});

test("governance: clean input passes every gate", async () => {
  const decision = await checkAction(baseInput(), options());
  assert.equal(decision.verdict, "pass");
  assert.deepEqual(decision.reasons, []);
  assert.equal(decision.constitutionVersion, 1);
});

test("governance: activation without an approval record blocks (26A.4 draft != activation)", async () => {
  const decision = await checkAction(baseInput({ approvalId: undefined }), options());
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "approval_gate").includes("block"));
});

test("governance: a pending (not approved) approval blocks", async () => {
  const decision = await checkAction(
    baseInput({ approvalId: pendingApprovalId }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "approval_gate").includes("block"));
});

test("governance: stale source data blocks with the PRD 8.5 re-sync message", async () => {
  const decision = await checkAction(
    baseInput({
      sourceFreshness: [
        {
          source: "klaviyo",
          lastSyncAt: hoursAgo(100).toISOString(),
          thresholdHours: 2,
          isStale: false, // elapsed > threshold must block on its own
        },
      ],
    }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "freshness").includes("block"));
  assert.ok(decision.reasons.some((reason) => reason.includes("Re-sync")));
});

test("governance: NO declared freshness data blocks (fail closed)", async () => {
  const decision = await checkAction(baseInput({ sourceFreshness: [] }), options());
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "freshness").includes("block"));
});

test("governance: non-overrideable claim blocks even with an explicit override", async () => {
  const decision = await checkAction(
    baseInput({ copyText: ["This serum cures dry skin overnight."] }),
    options({ claimOverrides: ["cures"] }),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "banned_claims").includes("block"));
});

test("governance: overrideable claim blocks WITHOUT an override and passes ONLY with it", async () => {
  const copyText = ["Our best moisturizer is back in stock."];
  const withoutOverride = await checkAction(baseInput({ copyText }), options());
  assert.equal(withoutOverride.verdict, "block");
  assert.ok(gateOutcome(withoutOverride, "banned_claims").includes("block"));
  assert.ok(withoutOverride.claimFindings.some((finding) => finding.claim === "best"));

  const withOverride = await checkAction(
    baseInput({ copyText }),
    options({ claimOverrides: ["best"] }),
  );
  assert.equal(withOverride.verdict, "pass");
  assert.ok(gateOutcome(withOverride, "banned_claims").includes("pass"));
});

test("governance: merchant Operating-Rules banned claim blocks", async () => {
  const decision = await checkAction(
    baseInput({ copyText: ["Try our miracle formula today."] }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "banned_claims").includes("block"));
});

test("governance: Meta audience action requires identifier-rights confirmation (26A.8)", async () => {
  const metaInput = baseInput({
    actionType: "meta_audience_sync",
    channel: "meta",
    activationLevel: "meta_audience_sync",
    copyText: ["High-value customer seed audience."],
  });
  const unconfirmed = await checkAction(metaInput, options());
  assert.equal(unconfirmed.verdict, "block");
  assert.equal(unconfirmed.destinationCompatibility.compatible, false);
  assert.ok(
    unconfirmed.reasons.some((reason) => reason.includes("identifiers")),
  );

  const confirmed = await checkAction(
    metaInput,
    options({ metaIdentifierRightsConfirmed: true }),
  );
  assert.equal(confirmed.verdict, "pass");
  assert.equal(confirmed.destinationCompatibility.compatible, true);
});

test("governance: suppressed audience members block", async () => {
  const decision = await checkAction(
    baseInput({ audienceCustomerIds: [okCustomerId, suppressedCustomerId] }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "suppression").includes("block"));
});

test("governance: non-consented audience members block (channel-specific consent)", async () => {
  const decision = await checkAction(
    baseInput({ audienceCustomerIds: [okCustomerId, noConsentCustomerId] }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "consent").includes("block"));
});

test("governance: unknown audience customer ids block (fail closed)", async () => {
  const decision = await checkAction(
    baseInput({ audienceCustomerIds: ["cghostcustomer00000000000"] }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "consent").includes("block"));
});

test("governance: discount above the Operating-Rules ceiling blocks", async () => {
  const decision = await checkAction(baseInput({ discountPercent: 50 }), options());
  assert.equal(decision.verdict, "block");
  assert.ok(gateOutcome(decision, "discount_limit").includes("block"));
  // 50% off also breaches the 60% margin floor.
  assert.ok(gateOutcome(decision, "margin_rule").includes("block"));
});

test("governance: missing Constitution version blocks everything (fail closed)", async () => {
  const decision = await checkAction(
    baseInput({ constitutionVersion: 99 }),
    options(),
  );
  assert.equal(decision.verdict, "block");
  assert.ok(decision.reasons.some((reason) => reason.includes("Operating Rules")));
});
