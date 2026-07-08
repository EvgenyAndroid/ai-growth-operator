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
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-sm font-semibold text-ink">{card.title}</h4>
        <ConfBadge level={card.confidence} />
        <ModeBadge mode={card.measurementMode} />
      </div>
      <p className="mt-1.5 text-sm text-ink-secondary">
        {card.estimate ? (
          <>
            Estimated value {fmtMoney(card.estimate.low)}–{fmtMoney(card.estimate.high)}{" "}
            <span className="text-ink-muted">({ESTIMATE_LABEL_COPY[card.estimateLabel]})</span>
          </>
        ) : (
          <span className="text-ink-muted">
            Directional opportunity — no dollar estimate attached ({ESTIMATE_LABEL_COPY[card.estimateLabel]}).
          </span>
        )}
      </p>
      {card.recommendedAction ? (
        <p className="mt-1 text-sm text-ink-secondary">
          Recommended action: {card.recommendedAction}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-soft">
        Data as of {fmtDate(card.dataAsOf)} · recipe {card.recipeId} v{card.recipeVersion}
      </p>
      {/* PRD 4.4 / 17.3 — every recommendation carries its full contract. */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-ink-muted transition-colors duration-150 hover:text-ink">
          Why this recommendation (full explanation contract)
        </summary>
        <ExplanationPanel explanation={card.explanation} className="mt-2" />
      </details>
    </div>
  );
}

/** Tiny operator identity mark — accent dot with a soft halo, no dependency. */
function OperatorLabel() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_3px_rgb(37_99_235/0.15)]"
      />
      Operator
    </p>
  );
}

function OperatorTurn({ turn }: { turn: Turn }) {
  if (turn.error) {
    return (
      <div className="rounded-card border border-red-200 bg-danger-soft/60 p-4 text-sm text-red-800">
        Something went wrong: {turn.error}
      </div>
    );
  }
  if (!turn.response) {
    return (
      <div className="rounded-card border border-border border-l-2 border-l-accent/40 bg-surface p-4 shadow-card">
        <OperatorLabel />
        <p className="mt-2 text-sm text-ink-muted motion-safe:animate-pulse">Thinking…</p>
      </div>
    );
  }
  const response = turn.response;
  return (
    // Premium but secondary (brief v3 area 10): a quiet accent rail marks the
    // Operator's voice; the card itself stays calm and never louder than feed
    // cards.
    <div className="rounded-card border border-border border-l-2 border-l-accent/40 bg-surface p-4 shadow-card">
      <OperatorLabel />
      <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{response.message}</p>

      {response.explanation ? (
        <div className="mt-3">
          <h4 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
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
        <p className="mt-3 rounded-md border border-blue-200 bg-info-soft/60 px-3 py-2 text-sm text-blue-900">
          <strong>Draft created — nothing was launched.</strong> Drafting is
          not activation; this action needs your explicit approval before any
          customer-facing send (26A.4). Action{" "}
          <span className="break-all font-mono text-xs">{response.draftedAction.actionId}</span>,
          draft <span className="break-all font-mono text-xs">{response.draftedAction.draftId}</span>.
        </p>
      ) : null}

      {/* Ledger-reference stamp — every turn traces back to the proof rail. */}
      <p className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dotted border-border pt-2 text-xs text-ink-soft">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-info shadow-[0_0_6px_rgb(37_99_235/0.4)]"
        />
        <span>
          intent: {response.intent} · logged to Context Ledger{" "}
          <span className="font-mono">{response.ledgerId.slice(0, 10)}…</span>
        </span>
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
    // Compact assistant column — the feed is the product, chat stays modest.
    <div className="max-w-3xl space-y-4">
      <section>
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
          {/* Console micro-mark — decorative, matches the Operator dot. */}
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_rgb(37_99_235/0.15)]"
          />
          Supported questions (v0)
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isPending}
              onClick={() => send(question)}
              className="rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-ink-secondary shadow-xs transition-[background-color,border-color,color,translate,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-accent/40 hover:bg-accent-soft/40 hover:text-ink hover:shadow-[0_2px_8px_rgb(37_99_235/0.12)] active:translate-y-0 active:bg-accent-soft/60 disabled:pointer-events-none disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Anything outside these capabilities is labeled as not available in v0.
          Chat can draft, but it cannot approve or activate — those stay behind
          the approval gate and governance runtime.
        </p>
      </section>

      <section className="space-y-4">
        {turns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface-soft/60 grid-texture px-6 py-10 text-center">
            {/* CSS-only empty-state mark: the Operator dot, haloed. */}
            <span
              aria-hidden="true"
              className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-blue-200/70 bg-surface shadow-[0_0_18px_var(--glow-blue)]"
            >
              <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_3px_rgb(37_99_235/0.15)]" />
            </span>
            <h3 className="text-base font-semibold text-ink">
              Ask the Operator
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Pick a suggested question above or type your own. Responses are
              deterministic — the same system that powers the feed, with every
              turn logged to the Context Ledger.
            </p>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="space-y-2">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)]">
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
          className="flex-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-ink-soft focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || input.trim().length === 0}
          className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35)] transition-[background-color,box-shadow,translate] duration-150 ease-out hover:bg-primary-hover active:translate-y-px active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
        >
          {isPending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
