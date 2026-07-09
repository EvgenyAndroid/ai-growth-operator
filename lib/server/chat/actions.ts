"use server";

/**
 * lib/server/chat/actions.ts — Operator Chat (PRD 17, 26A.3). The narrow
 * "use server" action module of the chat slice (hardening pass 2, item 2):
 * operatorChat is the ONLY export, and the only client-callable entry point.
 *
 * A constrained command interface over the three v0 recipes: it can explain,
 * draft, and point at the approval queue — it can NEVER activate (chat cannot
 * bypass approval or governance; drafting routes through draftAction which
 * creates a pending Approval, and activation only happens in approveAction).
 *
 * Every action-recommending answer carries the full ExplanationContract
 * (PRD 17.3). Unsupported asks return the EXACT 26A.3 string.
 */

import type { ChatIntent, ExplanationContract, RecipeId } from "../../contracts";
import { CHAT_UNSUPPORTED_RESPONSE, MEASUREMENT_LABEL_COPY } from "../../contracts";
import db from "../../db";
import { writeLedger } from "../../ledger";
import { draftAction } from "../actions";
import { assertAccountAccess } from "../account-context";
import { guardMutation } from "../rate-limit";
import { routeChatIntent } from "../chat-router";
import { listOpportunities } from "../opportunities/read";
import { operatorChatSchema, parseInput } from "../validation";
import type { ChatResponse, FeedView, OpportunityCardView } from "../types";

function moneyRange(low: number, high: number): string {
  return `$${Math.round(low).toLocaleString("en-US")}-$${Math.round(high).toLocaleString("en-US")}`;
}

function cardLine(card: OpportunityCardView): string {
  const estimate = card.estimate
    ? `${moneyRange(card.estimate.low, card.estimate.high)} (${card.estimate.label})`
    : "no dollar estimate (directional)";
  return `${card.title} — ${estimate}, confidence ${card.confidence}, measured as "${card.measurementLabelCopy}"`;
}

function findCard(
  feed: FeedView,
  recipeId: RecipeId,
): OpportunityCardView | undefined {
  return (
    feed.opportunities.find((card) => card.recipeId === recipeId) ??
    feed.dismissed.find((card) => card.recipeId === recipeId)
  );
}

async function logChat(params: {
  accountId: string;
  userId?: string;
  input: string;
  intent: ChatIntent;
  summary: string;
  opportunityId?: string;
  actionId?: string;
}): Promise<string> {
  const { ledgerId } = await writeLedger({
    accountId: params.accountId,
    eventType: "chat_interaction",
    userId: params.userId,
    opportunityId: params.opportunityId,
    actionId: params.actionId,
    skillInvoked: `operator_chat:${params.intent}`,
    sourceDataUsed: { input: params.input.slice(0, 500) },
    reasoningSummary: params.summary,
    actionTaken: `chat answered (intent: ${params.intent})`,
  });
  return ledgerId;
}

/**
 * The deterministic Operator Chat entry point (26A.3 — intent router, no LLM).
 */
export async function operatorChat(params: {
  accountId: string;
  input: string;
  userId?: string;
}): Promise<ChatResponse> {
  await guardMutation("operatorChat"); // P7 — origin check + rate limit first
  params = parseInput(operatorChatSchema, params, "operatorChat"); // P5 — bounded input
  await assertAccountAccess(params.accountId); // P4 — account boundary
  const intent = routeChatIntent(params.input);

  // --- unsupported: the EXACT 26A.3 response --------------------------------
  if (intent === "unsupported") {
    const ledgerId = await logChat({
      accountId: params.accountId,
      userId: params.userId,
      input: params.input,
      intent,
      summary: "Unsupported ask — returned the 26A.3 unavailable-in-v0 response.",
    });
    return { intent, message: CHAT_UNSUPPORTED_RESPONSE, ledgerId };
  }

  // --- recipe-backed intents -------------------------------------------------
  const recipeForIntent: Partial<Record<ChatIntent, RecipeId>> = {
    recover_abandoned_carts: "abandoned_checkout_recovery",
    build_winback: "lapsed_winback",
    build_meta_lookalike: "meta_seed_suppression",
  };

  if (intent in recipeForIntent) {
    const recipeId = recipeForIntent[intent] as RecipeId;
    const feed = await listOpportunities(params.accountId);
    const card = findCard(feed, recipeId);
    if (!card) {
      const noOpp = feed.noOpportunity.find((entry) => entry.recipeId === recipeId);
      const message = noOpp
        ? `Nothing qualifies right now. ${noOpp.whyNotQualified} Checked: ${noOpp.checked
            .map((check) => `${check.what}: ${check.count}`)
            .join(", ")}. Nearest next action: ${noOpp.nearestNextAction} ${noOpp.unlocks}`
        : "No qualifying opportunity was found for that recipe right now.";
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: message,
      });
      return { intent, message, ledgerId };
    }
    const message =
      `Here's what I found: ${cardLine(card)}. ` +
      `${card.explanation.found} ${card.explanation.whyItMatters} ` +
      `To proceed I can create a draft — nothing sends, syncs, or spends without your explicit approval (26A.4).`;
    const ledgerId = await logChat({
      accountId: params.accountId,
      userId: params.userId,
      input: params.input,
      intent,
      summary: `Explained ${recipeId} opportunity via feed card.`,
      opportunityId: card.id,
    });
    return { intent, message, explanation: card.explanation, opportunities: [card], ledgerId };
  }

  switch (intent) {
    case "weekly_plan": {
      const feed = await listOpportunities(params.accountId);
      const top = feed.opportunities[0];
      const lines = feed.opportunities.map(
        (card, index) => `${index + 1}. ${cardLine(card)}`,
      );
      const header = feed.foundMoney.show
        ? `${feed.foundMoney.headline}. `
        : "";
      const message =
        feed.opportunities.length === 0
          ? "No qualifying opportunities this week. Connect more sources or check back after the next sync."
          : `${header}This week, in order:\n${lines.join("\n")}\nStart with #1 — I can draft it now; activation still requires your approval.`;
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: `Weekly plan with ${feed.opportunities.length} ranked opportunities.`,
        opportunityId: top?.id,
      });
      return {
        intent,
        message,
        explanation: top?.explanation,
        opportunities: feed.opportunities,
        ledgerId,
      };
    }

    case "explain_holdout": {
      // Latest measured/active holdout with its action.
      const holdout = await db.holdout.findFirst({
        where: { accountId: params.accountId, status: { in: ["measured", "active"] } },
        orderBy: { createdAt: "desc" },
        include: { action: true },
      });
      let message: string;
      if (!holdout) {
        message =
          "No holdout exists yet. Holdouts are assigned automatically when you approve a Klaviyo flow with an eligible audience of at least 500 (PRD 14.2).";
      } else if (
        holdout.status === "measured" &&
        holdout.measuredLiftLow !== null &&
        holdout.measuredLiftHigh !== null
      ) {
        message =
          `The most recent measured holdout (${holdout.holdoutSize} of ${holdout.eligibleAudienceSize} customers held out, randomized at the customer level) showed a relative lift between ${(holdout.measuredLiftLow * 100).toFixed(1)}% and ${(holdout.measuredLiftHigh * 100).toFixed(1)}% — reported as a range, never a single number. ` +
          `Contamination risk was assessed as "${holdout.contaminationRisk ?? "none"}". This is a "${MEASUREMENT_LABEL_COPY.holdout}" readout.`;
      } else {
        message = `A holdout is currently active: ${holdout.holdoutSize} of ${holdout.eligibleAudienceSize} customers are held out. Lift will be reported as a range once a measurement window has elapsed.`;
      }
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: message,
        actionId: holdout?.action?.id,
      });
      return { intent, message, ledgerId };
    }

    case "no_discount_options": {
      const feed = await listOpportunities(params.accountId);
      const winback = findCard(feed, "lapsed_winback");
      const recovery = findCard(feed, "abandoned_checkout_recovery");
      const card = winback ?? recovery;
      const message =
        "You can act without any discount: (1) abandoned-cart reminders that just restate the saved cart, (2) win-back emails with a replenishment angle based on each customer's own reorder rhythm, and (3) a high-value Meta seed audience with recent-purchaser suppression — none of these require an offer. " +
        (card
          ? `Best fit right now: ${cardLine(card)}. I'll keep drafts discount-free for you.`
          : "No qualifying audience right now, but I'll keep drafts discount-free for you.");
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: "Listed non-discount options (26B.18 offer stance respected in templates).",
        opportunityId: card?.id,
      });
      return {
        intent,
        message,
        explanation: card?.explanation,
        opportunities: card ? [card] : undefined,
        ledgerId,
      };
    }

    case "draft_without_launch": {
      const feed = await listOpportunities(params.accountId);
      // Named recipe in the ask wins; otherwise the top-ranked card.
      const text = params.input.toLowerCase();
      const named: RecipeId | null = /abandon|cart|checkout/.test(text)
        ? "abandoned_checkout_recovery"
        : /win[- ]?back|lapsed/.test(text)
          ? "lapsed_winback"
          : /meta|lookalike/.test(text)
            ? "meta_seed_suppression"
            : null;
      const card = named
        ? findCard(feed, named)
        : feed.opportunities[0];
      if (!card) {
        const message = "There is no qualifying opportunity to draft right now.";
        const ledgerId = await logChat({
          accountId: params.accountId,
          userId: params.userId,
          input: params.input,
          intent,
          summary: message,
        });
        return { intent, message, ledgerId };
      }
      const draft = await draftAction({
        accountId: params.accountId,
        opportunityId: card.id,
        userId: params.userId,
      });
      const message =
        `Done — I drafted "${card.title}" (${draft.copy.length} step${draft.copy.length === 1 ? "" : "s"}) and did NOT launch it. ` +
        `Creating a draft is not activation: nothing sends or syncs until you explicitly approve it in the approval queue (26A.4).`;
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: `Drafted ${card.recipeId} without launching (26A.4).`,
        opportunityId: card.id,
        actionId: draft.actionId,
      });
      return {
        intent,
        message,
        explanation: draft.explanation,
        opportunities: [card],
        draftedAction: { actionId: draft.actionId, draftId: draft.draftId },
        ledgerId,
      };
    }

    case "explain_confidence": {
      const feed = await listOpportunities(params.accountId);
      const card = feed.opportunities[0];
      let message: string;
      let explanation: ExplanationContract | undefined;
      if (!card) {
        message = "There is no active opportunity to explain right now.";
      } else {
        explanation = card.explanation;
        message =
          `"${card.title}" is confidence ${card.confidence.toUpperCase()}. Confidence is scored deterministically from data recency, sample size, baseline availability, and exclusion reliability (PRD 11). ` +
          `Key inputs: data freshness (${card.explanation.dataFreshness
            .map((freshness) => `${freshness.source}: ${freshness.isStale ? "stale" : "fresh"}`)
            .join(", ")}); assumptions: ${card.explanation.assumptions.join(" ")}`;
      }
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: `Explained confidence for ${card?.recipeId ?? "no card"}.`,
        opportunityId: card?.id,
      });
      return { intent, message, explanation, ledgerId };
    }

    case "explain_meta_no_lift": {
      // Sanctioned negative-claim explanation (PRD 17.2 lists this question).
      const message =
        "Meta audience sync has no control group in v0: once an audience is synced, Meta decides delivery and we cannot hold out a comparable group inside the ad platform. Without a control, any revenue change could be seasonality, other campaigns, or platform optimization — so claiming lift would be vendor math. " +
        `Meta reporting is therefore always labeled "${MEASUREMENT_LABEL_COPY.directional}" and limited to observational metrics (audience size, match rate, sync status, non-causal downstream purchases). Holdout-verified measurement in v0 exists only for eligible Klaviyo lifecycle flows with 500+ customers (PRD 14.2, 15).`;
      const ledgerId = await logChat({
        accountId: params.accountId,
        userId: params.userId,
        input: params.input,
        intent,
        summary: "Explained why Meta measurement is directional-only in v0.",
      });
      return { intent, message, ledgerId };
    }
  }

  // Exhaustive over ChatIntent minus handled cases; TypeScript narrows to never.
  const fallbackLedgerId = await logChat({
    accountId: params.accountId,
    userId: params.userId,
    input: params.input,
    intent: "unsupported",
    summary: "Fell through intent handling — returned the 26A.3 response.",
  });
  return {
    intent: "unsupported",
    message: CHAT_UNSUPPORTED_RESPONSE,
    ledgerId: fallbackLedgerId,
  };
}
