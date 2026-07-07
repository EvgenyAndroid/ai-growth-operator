"use client";

/**
 * Operator Chat panel (client) — suggestion chips for the PRD 17.2 supported
 * questions, deterministic responses from the 26A.3 intent router (including
 * the exact unsupported-ask string, which arrives verbatim in
 * response.message), and the full ExplanationContract rendered on every
 * action-recommending answer (PRD 17.3).
 *
 * Imports only types plus the operatorChat server action and the client-safe
 * presentational pieces from ../performance/readout-card.
 */

import * as React from "react";
import { useRef, useState, useTransition } from "react";
import { operatorChat } from "@/lib/server/chat";
import type { ChatResponse, OpportunityCardView } from "@/lib/server/types";
import {
  ConfBadge,
  ExplanationPanel,
  fmtDate,
  fmtMoney,
  ModeBadge,
  ReadoutCard,
} from "../performance/readout-card";

/** PRD 17.2 — the supported v0 questions, offered as one chip each. */
const SUGGESTED_QUESTIONS: string[] = [
  "What should I do this week to grow revenue?",
  "Recover abandoned carts.",
  "Build a win-back campaign for lapsed customers.",
  "Create a Meta lookalike from my best customers.",
  "What did the holdout show?",
  "What can I do without offering a discount?",
  "Draft a campaign but do not launch it.",
  "Why is this opportunity confidence Medium?",
  "Why can't you prove lift for Meta?",
];

interface Turn {
  id: number;
  question: string;
  response: ChatResponse | null;
  error: string | null;
}

const ESTIMATE_LABEL_COPY: Record<OpportunityCardView["estimateLabel"], string> = {
  merchant_historical: "merchant historical",
  modeled: "modeled estimate",
  directional: "directional",
  unavailable: "no defensible estimate",
};

function OpportunityMiniCard({ card }: { card: OpportunityCardView }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-sm font-semibold text-stone-900">{card.title}</h4>
        <ConfBadge level={card.confidence} />
        <ModeBadge mode={card.measurementMode} />
      </div>
      <p className="mt-1.5 text-sm text-stone-700">
        {card.estimate ? (
          <>
            Estimated value {fmtMoney(card.estimate.low)}–{fmtMoney(card.estimate.high)}{" "}
            <span className="text-stone-500">({ESTIMATE_LABEL_COPY[card.estimateLabel]})</span>
          </>
        ) : (
          <span className="text-stone-500">
            Directional opportunity — no dollar estimate attached ({ESTIMATE_LABEL_COPY[card.estimateLabel]}).
          </span>
        )}
      </p>
      {card.recommendedAction ? (
        <p className="mt-1 text-sm text-stone-700">
          Recommended action: {card.recommendedAction}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-stone-500">
        Data as of {fmtDate(card.dataAsOf)} · recipe {card.recipeId} v{card.recipeVersion}
      </p>
      {/* PRD 4.4 / 17.3 — every recommendation carries its full contract. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-stone-600">
          Why this recommendation (full explanation contract)
        </summary>
        <ExplanationPanel explanation={card.explanation} className="mt-2" />
      </details>
    </div>
  );
}

function OperatorTurn({ turn }: { turn: Turn }) {
  if (turn.error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Something went wrong: {turn.error}
      </div>
    );
  }
  if (!turn.response) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
        Thinking…
      </div>
    );
  }
  const response = turn.response;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-sm whitespace-pre-wrap text-stone-800">{response.message}</p>

      {response.explanation ? (
        <div className="mt-3">
          <h4 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Explanation contract (PRD 17.3)
          </h4>
          <ExplanationPanel explanation={response.explanation} className="mt-2" />
        </div>
      ) : null}

      {response.opportunities && response.opportunities.length > 0 ? (
        <div className="mt-3 space-y-3">
          {response.opportunities.map((card) => (
            <OpportunityMiniCard key={card.id} card={card} />
          ))}
        </div>
      ) : null}

      {response.readout ? (
        <div className="mt-3">
          <ReadoutCard readout={response.readout} />
        </div>
      ) : null}

      {response.draftedAction ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <strong>Draft created — nothing was launched.</strong> Drafting is
          not activation; this action needs your explicit approval before any
          customer-facing send (26A.4). Action{" "}
          <span className="font-mono text-xs">{response.draftedAction.actionId}</span>,
          draft <span className="font-mono text-xs">{response.draftedAction.draftId}</span>.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-stone-400">
        intent: {response.intent} · logged to Context Ledger{" "}
        <span className="font-mono">{response.ledgerId.slice(0, 10)}…</span>
      </p>
    </div>
  );
}

export function ChatPanel({ accountId }: { accountId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const nextId = useRef(1);

  function send(question: string): void {
    const trimmed = question.trim();
    if (trimmed.length === 0 || isPending) return;
    const id = nextId.current++;
    setTurns((previous) => [...previous, { id, question: trimmed, response: null, error: null }]);
    setInput("");
    startTransition(async () => {
      try {
        const response = await operatorChat({ accountId, input: trimmed });
        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, response } : turn)),
        );
      } catch (error) {
        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === id
              ? { ...turn, error: error instanceof Error ? error.message : String(error) }
              : turn,
          ),
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Supported questions (v0)
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isPending}
              onClick={() => send(question)}
              className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Anything outside these capabilities is labeled as not available in v0.
          Chat can draft, but it cannot approve or activate — those stay behind
          the approval gate and governance runtime.
        </p>
      </section>

      <section className="space-y-4">
        {turns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
            <h3 className="text-base font-semibold text-stone-900">
              Ask the Operator
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
              Pick a suggested question above or type your own. Responses are
              deterministic — the same system that powers the feed, with every
              turn logged to the Context Ledger.
            </p>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="space-y-2">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
                  {turn.question}
                </p>
              </div>
              <OperatorTurn turn={turn} />
            </div>
          ))
        )}
      </section>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder='Try "What should I do this week to grow revenue?"'
          aria-label="Ask the Operator"
          className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || input.trim().length === 0}
          className="inline-flex items-center rounded-md border border-transparent bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
