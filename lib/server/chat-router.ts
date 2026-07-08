/**
 * lib/server/chat-router.ts — deterministic Operator Chat intent router
 * (PRD 17, 26A.3). NO LLM: pure keyword rules, same input -> same intent.
 *
 * v0 supported asks (PRD 17.2) map onto the ChatIntent union in contracts.
 * Anything else routes to "unsupported" and gets the EXACT 26A.3 response.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type { ChatIntent } from "../contracts";

interface IntentRule {
  intent: ChatIntent;
  matches: (text: string) => boolean;
}

/**
 * Ordered rules — first match wins. Order is significant:
 *  - "draft but do not launch" is checked before recipe keywords so
 *    "Draft a campaign but do not launch it" does not fall into a recipe.
 *  - "why can't you prove lift for Meta" is checked before the Meta-audience
 *    rule so it does not become build_meta_lookalike.
 */
const RULES: IntentRule[] = [
  {
    intent: "draft_without_launch",
    matches: (text) =>
      /draft/.test(text) &&
      /(do ?n[o']t|not|without|hold off|no)\s+(launch|send|activat)/.test(text),
  },
  {
    intent: "explain_meta_no_lift",
    matches: (text) =>
      /meta/.test(text) && /(lift|prove|proof|incrementalit|causal)/.test(text),
  },
  {
    intent: "explain_holdout",
    matches: (text) => /holdout|hold[- ]out|control group/.test(text),
  },
  {
    intent: "explain_confidence",
    matches: (text) => /confidence|why .*(medium|low|high)/.test(text),
  },
  {
    intent: "no_discount_options",
    matches: (text) =>
      /(without|no|not|avoid|skip|zero)[^.]*\b(discount|coupon|promo)/.test(text) ||
      /\b(discount|coupon|promo)[^.]*\b(without|no|not|avoid|skip)/.test(text),
  },
  {
    intent: "recover_abandoned_carts",
    matches: (text) => /abandon|cart|checkout/.test(text),
  },
  {
    intent: "build_winback",
    matches: (text) => /win[- ]?back|lapsed|reorder|churn/.test(text),
  },
  {
    intent: "build_meta_lookalike",
    matches: (text) =>
      /lookalike|meta|high[- ]?ltv|best customers|seed audience|suppress/.test(text),
  },
  {
    intent: "weekly_plan",
    matches: (text) =>
      /this week|grow revenue|what should i do|where.*(start|begin)|priorit|plan for/.test(
        text,
      ),
  },
];

/** Route free text to a v0 intent. Deterministic; defaults to "unsupported". */
export function routeChatIntent(input: string): ChatIntent {
  const text = input.trim().toLowerCase();
  if (text.length === 0) return "unsupported";
  for (const rule of RULES) {
    if (rule.matches(text)) return rule.intent;
  }
  return "unsupported";
}
