/**
 * lib/server/actions/draft.ts — draftAction implementation (P11 split).
 *
 * Drafting is NOT activation (26A.4): nothing customer-facing happens here.
 * Callers reach this ONLY through the "use server" wrapper in ./index.ts,
 * which runs guardMutation (P7) + zod validation (P5) first; this module
 * starts at the account boundary (P4).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type { RecipeResult } from "../../contracts";
import { ACTIVATION_LEVELS, MEASUREMENT_LABEL_COPY } from "../../contracts";
import db from "../../db";
import { writeLedger } from "../../ledger";
import { runRecipeForAccount } from "../../recipes";
import { assertAccountAccess } from "../account-context";
import { buildDraftCopy, buildDraftSequence } from "../draft-templates";
import {
  accountClock,
  requireConstitution,
  requireRecipeId,
  toInputJson,
} from "../shared";
import type { DraftActionResult } from "../types";
import { channelFor } from "./activation-ladder";

export async function runDraftAction(params: {
  accountId: string;
  opportunityId: string;
  userId?: string;
}): Promise<DraftActionResult> {
  const account = await assertAccountAccess(params.accountId); // P4 — account boundary
  const constitution = await requireConstitution(params.accountId);

  const opportunity = await db.opportunity.findFirst({
    where: { id: params.opportunityId, accountId: params.accountId },
  });
  if (!opportunity) throw new Error(`Opportunity ${params.opportunityId} not found.`);
  if (opportunity.status === "dismissed") {
    throw new Error("This opportunity was dismissed — resurface it before drafting.");
  }

  const recipeId = requireRecipeId(opportunity.recipeId);
  // Deterministic re-run to get the current audience + measurement plan
  // (demo accounts run on the demo dataset's fixed reference clock).
  const result: RecipeResult = await runRecipeForAccount(
    params.accountId,
    recipeId,
    accountClock(account),
  );
  if (result.noOpportunity) {
    throw new Error(
      `Recipe ${recipeId} no longer finds a qualifying audience: ${result.noOpportunity.whyNotQualified}`,
    );
  }

  // 26B.18 — learned offer stance shapes the template.
  const offerPref = await db.preference.findUnique({
    where: { accountId_key: { accountId: params.accountId, key: "offer_stance" } },
  });
  const avoidDiscounts =
    typeof offerPref?.value === "object" &&
    offerPref?.value !== null &&
    !Array.isArray(offerPref.value) &&
    (offerPref.value as Record<string, unknown>).stance === "avoid_discounts";

  const copy = buildDraftCopy(recipeId, result, {
    brandName: account.name,
    constitution,
    avoidDiscounts,
  });

  // Tighten the audience to channel consent + suppression BEFORE anything is
  // drafted (PRD 23.4: suppression is checked before draft approval; 26B.13:
  // consentAds gates ad audiences). This does not bypass governance — the
  // same gates re-check the persisted audience at approval time.
  const channel = channelFor(result.recommendedAction);
  const audienceCustomers = await db.customer.findMany({
    where: { accountId: params.accountId, id: { in: result.audience.customerIds } },
    select: { id: true, consentEmail: true, consentAds: true, suppressionStatus: true },
  });
  const eligibleIds = audienceCustomers
    .filter(
      (customer) =>
        customer.suppressionStatus === "none" &&
        (channel === "meta" ? customer.consentAds : customer.consentEmail),
    )
    .map((customer) => customer.id);
  const consentFiltered = result.audience.customerIds.length - eligibleIds.length;

  const audience = await db.audience.create({
    data: {
      accountId: params.accountId,
      name: result.audience.name,
      creationMethod: "recipe",
      inclusionRules: toInputJson({
        ...result.audience.inclusionRules,
        customerIds: eligibleIds,
        consentSuppressionFiltered: consentFiltered,
      }),
      exclusionRules: toInputJson(result.audience.exclusionRules),
      size: eligibleIds.length,
      eligibleChannels: toInputJson(result.audience.eligibleChannels),
    },
  });
  if (result.suppressionAudience) {
    await db.audience.create({
      data: {
        accountId: params.accountId,
        name: result.suppressionAudience.name,
        creationMethod: "recipe",
        inclusionRules: toInputJson({
          ...result.suppressionAudience.inclusionRules,
          customerIds: result.suppressionAudience.customerIds,
        }),
        exclusionRules: toInputJson(result.suppressionAudience.exclusionRules),
        size: result.suppressionAudience.size,
        eligibleChannels: toInputJson(result.suppressionAudience.eligibleChannels),
      },
    });
  }

  const action = await db.action.create({
    data: {
      accountId: params.accountId,
      type: result.recommendedAction,
      objective: result.title,
      channel: channelFor(result.recommendedAction),
      audienceId: audience.id,
      opportunityId: opportunity.id,
      status: "draft", // 26A.4 — NOT activation
      createdBy: params.userId,
      constitutionVersion: constitution.version,
      measurementMode: result.measurementPlan.mode,
      activationLevel: result.activationLevel,
      expectedOutcome: result.estimate ? toInputJson(result.estimate) : undefined,
      sourceReferences: toInputJson({
        recipeId,
        recipeVersion: result.recipeVersion,
        dataAsOf: result.dataAsOf,
      }),
    },
  });

  const draft = await db.draft.create({
    data: {
      accountId: params.accountId,
      opportunityId: opportunity.id,
      actionId: action.id,
      copy: toInputJson(copy),
      sequence: toInputJson(buildDraftSequence(copy)),
      activationTarget: result.activationLevel,
      status: "draft",
    },
  });

  const approval = await db.approval.create({
    data: {
      accountId: params.accountId,
      actionId: action.id,
      draftId: draft.id,
      status: "pending",
    },
  });

  if (opportunity.status !== "launched") {
    await db.opportunity.update({
      where: { id: opportunity.id },
      data: { status: "drafted" },
    });
  }

  await writeLedger({
    accountId: params.accountId,
    eventType: "opportunity_drafted",
    userId: params.userId,
    actionId: action.id,
    opportunityId: opportunity.id,
    skillInvoked: recipeId,
    constitutionVersion: constitution.version,
    sourceDataUsed: {
      draftId: draft.id,
      audienceSize: result.audience.size,
      activationTarget: result.activationLevel,
      steps: copy.length,
    },
    sourceFreshness: result.explanation.dataFreshness,
    reasoningSummary: `Drafted "${result.title}" as ${ACTIVATION_LEVELS[result.activationLevel]} (template copy, no LLM). Draft is not activation — approval required (26A.4).`,
    confidence: result.confidence,
    approvalStatus: "pending",
    destination: channelFor(result.recommendedAction),
    activationLevel: result.activationLevel,
    actionTaken: "draft created; awaiting approval",
    measurementMode: result.measurementPlan.mode,
  });

  return {
    actionId: action.id,
    draftId: draft.id,
    approvalId: approval.id,
    opportunityId: opportunity.id,
    copy,
    activationLevel: result.activationLevel,
    approvalNeeded:
      "Creating a draft is not activation. No send, sync, suppression change, or spend happens until you explicitly approve (PRD 26A.4).",
    explanation: result.explanation,
    measurementMode: result.measurementPlan.mode,
    measurementLabelCopy: MEASUREMENT_LABEL_COPY[result.measurementPlan.mode],
  };
}
