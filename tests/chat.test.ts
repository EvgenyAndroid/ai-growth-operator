/**
 * tests/chat.test.ts — P9 Operator Chat tests (node:test).
 *
 * Deterministic intent-router coverage (pure) plus end-to-end operatorChat
 * calls against the seeded DTC demo workspace (ensureDemoAccount is
 * idempotent; chat only APPENDS chat_interaction ledger entries — the demo
 * baseline data is untouched and the smoke suite reseeds anyway).
 *
 * Brief coverage: unsupported asks return the EXACT 26A.3 response verbatim;
 * the Meta-lift question yields the directional explanation; chat never
 * reports unsupported (lift/causal) metrics for Meta.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import {
  CHAT_UNSUPPORTED_RESPONSE,
  MEASUREMENT_LABEL_COPY,
} from "../lib/contracts";
import { findLiftLanguage } from "../lib/measurement/constants";
import { db } from "../lib/db";
import { ensureDemoAccount } from "../lib/server";
import { operatorChat } from "../lib/server/chat/actions";
import { routeChatIntent } from "../lib/server/chat-router";

let accountId = "";

before(async () => {
  const demo = await ensureDemoAccount({ vertical: "shopify_dtc" });
  accountId = demo.accountId;
});

after(async () => {
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// Router — deterministic, no LLM
// ---------------------------------------------------------------------------

test("chat router: out-of-scope asks route to unsupported", () => {
  for (const ask of [
    "write me a poem about croissants",
    "what is my ROAS this quarter?",
    "change my Shopify theme",
    "",
    "   ",
  ]) {
    assert.equal(routeChatIntent(ask), "unsupported", `ask: "${ask}"`);
  }
});

test("chat router: v0 intents resolve deterministically and stably", () => {
  assert.equal(routeChatIntent("Recover my abandoned carts"), "recover_abandoned_carts");
  assert.equal(routeChatIntent("build a win-back campaign"), "build_winback");
  assert.equal(routeChatIntent("seed a Meta lookalike"), "build_meta_lookalike");
  assert.equal(
    routeChatIntent("Why can't you prove lift for Meta?"),
    "explain_meta_no_lift",
  );
  assert.equal(
    routeChatIntent("Draft a campaign but do not launch it"),
    "draft_without_launch",
  );
  // Same input, same intent — run twice.
  assert.equal(
    routeChatIntent("what should I do this week?"),
    routeChatIntent("what should I do this week?"),
  );
});

// ---------------------------------------------------------------------------
// operatorChat — end-to-end over the demo workspace
// ---------------------------------------------------------------------------

test("chat: unsupported ask returns the EXACT 26A.3 response verbatim", async () => {
  const response = await operatorChat({
    accountId,
    input: "book me a flight to Lisbon",
  });
  assert.equal(response.intent, "unsupported");
  assert.equal(response.message, CHAT_UNSUPPORTED_RESPONSE);
  assert.ok(response.ledgerId, "chat interactions must be ledgered");
});

test("chat: Meta-lift question gets the directional explanation, not a lift claim", async () => {
  const response = await operatorChat({
    accountId,
    input: "Why can't you prove lift for my Meta audiences?",
  });
  assert.equal(response.intent, "explain_meta_no_lift");
  assert.ok(response.message.includes(MEASUREMENT_LABEL_COPY.directional));
  assert.ok(response.message.toLowerCase().includes("no control"));
  // Never an unsupported metric: no numeric lift/incrementality claim shape.
  assert.ok(!/\d+(\.\d+)?\s*%\s*(lift|incremental)/i.test(response.message));
  assert.ok(!/causal\s+roas|verified impact|recovered revenue/i.test(response.message));
});

test("chat: recipe explanations carry the explanation contract and directional labels stay clean", async () => {
  const response = await operatorChat({
    accountId,
    input: "seed a Meta lookalike from my best customers",
  });
  assert.equal(response.intent, "build_meta_lookalike");
  if (response.opportunities && response.opportunities.length > 0) {
    const card = response.opportunities[0];
    assert.equal(card.recipeId, "meta_seed_suppression");
    // The Meta card is directional and its chat line must not use lift language.
    assert.equal(card.measurementLabelCopy, MEASUREMENT_LABEL_COPY.directional);
    assert.deepEqual(findLiftLanguage(response.message), []);
    assert.ok(response.explanation, "action-recommending answers carry the explanation contract");
  } else {
    // No qualifying audience is still an honest, explained answer (26A.10).
    assert.ok(response.message.length > 0);
  }
});
