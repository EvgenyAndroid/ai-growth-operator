"use client";

/**
 * app/(dashboard)/approvals/[actionId]/review-client.tsx — the interactive
 * approve / edit / reject panel of Campaign Draft Review (PRD 7.4).
 *
 * - Approve routes through approveAction (the ONLY activation path; the
 *   governance chokepoint runs server-side). Meta actions require the 26A.8
 *   identifier-rights confirmation before the button enables.
 * - A governance block renders the full decision (gates, reasons,
 *   remediations, claim findings); overrideable claims can be explicitly
 *   overridden and re-submitted — non-overrideable ones cannot.
 * - Edit records a new draft version + edit summary (26B.18 learning loop).
 * - Reject requires a reason from the PRD 7.4 list plus optional free text.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
// Client components import server actions directly from their "use server"
// module — never the broad @/lib/server barrel (server/client boundary rule).
import { approveAction, recordDraftEdit, rejectAction } from "@/lib/server/actions";
import type { ApproveActionResult, DraftCopyStep } from "@/lib/server/types";
import { Badge, Button, Card, ChoiceChip, StatList, StatRow } from "@/components/ui/primitives";
import { fmtDateTime, READ_TYPE_LABELS, REJECTION_REASONS } from "../../feed/_shared/format";

type Mode = "idle" | "edit" | "reject";

// ---------------------------------------------------------------------------
// Result panels
// ---------------------------------------------------------------------------

function GovernancePanel({ result }: { result: ApproveActionResult }) {
  const g = result.governance;
  return (
    <div
      className={
        "rounded-md border px-4 py-3 " +
        (g.verdict === "pass"
          ? "border-emerald-200 bg-success-soft/50"
          : "border-red-200 bg-danger-soft/50")
      }
    >
      <p className="text-sm font-semibold text-ink">
        Governance {g.verdict === "pass" ? "passed" : "blocked this activation"}
        <span className="ml-2 text-xs font-normal text-ink-muted">
          checked {fmtDateTime(g.checkedAt)} · Operating Rules v{g.constitutionVersion}
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {g.gates.map((gate) => (
          <li key={gate.gate}>
            <Badge
              tone={
                gate.outcome === "pass"
                  ? "positive"
                  : gate.outcome === "block"
                    ? "danger"
                    : "neutral"
              }
              title={gate.reason}
            >
              {gate.gate}: {gate.outcome}
            </Badge>
          </li>
        ))}
      </ul>
      {g.reasons.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm leading-relaxed text-red-800">
          {g.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      {g.remediations.length > 0 ? (
        <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
          <span className="font-medium text-ink">How to fix: </span>
          {g.remediations.join(" · ")}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-ink-soft">{g.destinationCompatibilitySummary}</p>
    </div>
  );
}

function ActivationPanel({ result }: { result: ApproveActionResult }) {
  if (!result.activated || !result.activation) return null;
  const m = result.measurement;
  return (
    <div className="space-y-3 rounded-md border border-emerald-200 bg-success-soft/50 px-4 py-3">
      <p className="text-sm font-semibold text-emerald-900">
        Activated (simulated — alpha): {result.activation.levelCopy}
      </p>
      {/* Fallback ladder as a controlled delivery system (brief v3 area 6):
          connected stepper line + per-step dot; outcome text stays in the
          badge, so status is never color-only. */}
      <ol className="space-y-1.5">
        {result.activation.ladder.map((step) => (
          <li
            key={step.level}
            className="relative flex flex-wrap items-center gap-2 pl-5 text-sm before:absolute before:-bottom-2 before:left-[3px] before:top-[15px] before:w-px before:bg-emerald-300/60 last:before:hidden"
          >
            <span
              aria-hidden="true"
              className={
                "absolute left-0 top-[7px] h-2 w-2 rounded-full " +
                (step.outcome === "succeeded_simulated"
                  ? "bg-success shadow-[0_0_0_3px_rgb(5_150_105/0.15)]"
                  : step.outcome === "unavailable"
                    ? "bg-warning shadow-[0_0_0_3px_rgb(217_119_6/0.14)]"
                    : "bg-slate-300 shadow-[0_0_0_3px_rgb(148_163_184/0.15)]")
              }
            />
            <Badge
              tone={
                step.outcome === "succeeded_simulated"
                  ? "positive"
                  : step.outcome === "unavailable"
                    ? "caution"
                    : "neutral"
              }
            >
              {step.levelCopy}: {step.outcome.replace(/_/g, " ")}
            </Badge>
            <span className="text-ink-muted">{step.detail}</span>
          </li>
        ))}
      </ol>
      {m ? (
        <div className="rounded-md border border-emerald-200 bg-surface px-3.5 py-2.5">
          <p className="text-sm font-medium text-ink">
            Measurement: {m.labelCopy}
            {m.downgradedByActivationLevel ? (
              <span className="ml-2 text-xs font-normal text-amber-800">
                downgraded — holdout not enforceable at this activation level (26A.1)
              </span>
            ) : null}
          </p>
          {m.reasons.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-5 text-ink-muted">
              {m.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {m.holdout ? (
            <StatList className="mt-1">
              <StatRow label="Holdout" value={`${m.holdout.holdoutPercent}% (${m.holdout.holdoutSize.toLocaleString()} of ${m.holdout.eligibleAudienceSize.toLocaleString()})`} />
              <StatRow label="Exclusion window" value={m.holdout.exclusionWindow} />
            </StatList>
          ) : null}
          {m.contamination?.disclosure ? (
            <p className="mt-1 text-xs leading-5 text-amber-800">{m.contamination.disclosure}</p>
          ) : null}
          {m.windows.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Reads:{" "}
              {m.windows
                .map(
                  (w) =>
                    `${READ_TYPE_LABELS[w.readType] ?? w.readType} at ${w.days}d (${fmtDateTime(w.end)})`,
                )
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ReviewActions({
  accountId,
  actionId,
  draftId,
  copy,
  isMeta,
  decidable,
  maxDiscountPercent,
}: {
  accountId: string;
  actionId: string;
  draftId: string;
  copy: DraftCopyStep[];
  isMeta: boolean;
  decidable: boolean;
  maxDiscountPercent: number;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("idle");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ApproveActionResult | null>(null);
  const [rejected, setRejected] = React.useState(false);

  // Approve state
  const [metaRights, setMetaRights] = React.useState(false);
  const [overrides, setOverrides] = React.useState<string[]>([]);

  // Edit state
  const [steps, setSteps] = React.useState<DraftCopyStep[]>(copy);
  const [editSummary, setEditSummary] = React.useState("");

  // Reject state
  const [reason, setReason] = React.useState("");
  const [freeText, setFreeText] = React.useState("");

  async function approve(claimOverrides?: string[]) {
    setBusy(true);
    setError(null);
    try {
      const r = await approveAction({
        accountId,
        actionId,
        metaIdentifierRightsConfirmed: isMeta ? metaRights : undefined,
        claimOverrides:
          claimOverrides && claimOverrides.length > 0 ? claimOverrides : undefined,
      });
      setResult(r);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editSummary.trim()) {
      setError("An edit summary is required — it feeds the Operator's learning loop.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await recordDraftEdit({ accountId, draftId, editSummary, copy: steps });
      setMode("idle");
      setEditSummary("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Edit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!reason) {
      setError("Pick a rejection reason from the list (PRD 7.4).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fullReason = freeText.trim() ? `${reason}: ${freeText.trim()}` : reason;
      await rejectAction({ accountId, actionId, reason: fullReason });
      setRejected(true);
      setMode("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejection failed.");
    } finally {
      setBusy(false);
    }
  }

  const overrideableFindings =
    result?.governance.claimFindings.filter((f) => f.overrideable) ?? [];
  const blockedByGovernance = result !== null && !result.activated;

  return (
    <Card as="section" variant="hero" glow className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
        <span
          aria-hidden="true"
          className="h-3 w-0.5 shrink-0 rounded-full bg-accent/60"
        />
        Decision
      </h2>

      {result ? <GovernancePanel result={result} /> : null}
      {result ? <ActivationPanel result={result} /> : null}

      {result?.governance.claimFindings.length ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-warning-soft/60 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Claim findings</p>
          <ul className="space-y-2">
            {result.governance.claimFindings.map((f) => (
              <li key={f.claim} className="text-sm leading-relaxed text-ink-secondary">
                <span className="font-medium text-ink">“{f.claim}”</span> — {f.why}
                <span className="block text-ink-muted">
                  Safer alternative: {f.saferAlternative}
                </span>
                {f.overrideable ? (
                  <label className="mt-1 flex items-center gap-2 text-xs text-ink-secondary">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={overrides.includes(f.claim)}
                      onChange={(e) =>
                        setOverrides((prev) =>
                          e.target.checked
                            ? [...prev, f.claim]
                            : prev.filter((c) => c !== f.claim),
                        )
                      }
                    />
                    I take responsibility for this claim (override)
                  </label>
                ) : (
                  <Badge tone="danger" className="mt-1">
                    non-overrideable — must edit copy
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          {overrideableFindings.length > 0 && blockedByGovernance ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || overrides.length === 0}
              onClick={() => approve(overrides)}
            >
              Re-approve with {overrides.length} override
              {overrides.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {rejected ? (
        <p className="rounded-md border border-border-strong bg-surface-soft/70 px-4 py-3 text-sm leading-relaxed text-ink-secondary">
          Draft rejected. The reason was logged and feeds the Operator&rsquo;s
          learned preferences (26B.18).
        </p>
      ) : null}

      {mode === "edit" ? (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.step} className="rounded-md border border-border-strong bg-surface p-3.5">
              <p className="text-xs font-medium text-ink-muted">
                Step {step.step}
                {typeof step.offerPercent === "number"
                  ? ` · offer ${step.offerPercent}% (ceiling ${maxDiscountPercent}% — offers are edited via Operating Rules, not here)`
                  : ""}
              </p>
              {step.subject !== undefined ? (
                <input
                  value={step.subject}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s, j) => (j === i ? { ...s, subject: e.target.value } : s)),
                    )
                  }
                  placeholder="Subject"
                  className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-soft"
                />
              ) : null}
              <textarea
                value={step.body}
                onChange={(e) =>
                  setSteps((prev) =>
                    prev.map((s, j) => (j === i ? { ...s, body: e.target.value } : s)),
                  )
                }
                rows={4}
                className="mt-2 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm leading-relaxed text-ink"
              />
            </div>
          ))}
          <input
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            placeholder="Edit summary (required) — e.g. “softened tone, removed urgency”"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-soft"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveEdit} disabled={busy}>
              {busy ? "Saving…" : "Save edit (new draft version)"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reject" ? (
        <div className="space-y-2.5 rounded-md border border-red-200 bg-red-50/40 p-3.5">
          <p className="text-sm font-medium text-ink">Why reject this draft?</p>
          <div className="flex flex-wrap gap-1.5">
            {REJECTION_REASONS.map((r) => (
              <ChoiceChip
                key={r}
                onClick={() => setReason(r)}
                selected={reason === r}
              >
                {r}
              </ChoiceChip>
            ))}
          </div>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Optional detail"
            rows={2}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-soft"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger" onClick={reject} disabled={busy}>
              {busy ? "Rejecting…" : "Reject draft"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {decidable && !result?.activated && !rejected && mode === "idle" ? (
        <div className="space-y-3">
          {isMeta ? (
            <label className="flex items-start gap-2 rounded-md border border-blue-200 bg-info-soft/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink-secondary">
              <input
                type="checkbox"
                checked={metaRights}
                onChange={(e) => setMetaRights(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                I confirm this business has the right to use these customer
                identifiers for ad-platform audience creation. Identifiers are
                hashed before sync and the destination-compatibility check is
                logged (PRD 26A.8).
              </span>
            </label>
          ) : null}
          {/* Brief §6: Approve = primary, Edit = secondary, Reject = tertiary
              (quiet text action — the destructive confirm lives inside the
              reason UI, so nothing is one accidental click away). */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => approve(overrides)}
              disabled={busy || (isMeta && !metaRights)}
            >
              {busy ? "Running governance…" : "Approve & activate"}
            </Button>
            <Button variant="secondary" onClick={() => setMode("edit")} disabled={busy}>
              Edit
            </Button>
            <button
              type="button"
              onClick={() => setMode("reject")}
              disabled={busy}
              className={
                "inline-flex select-none items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-red-700 " +
                "transition-colors duration-150 hover:bg-red-50 " +
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                "disabled:pointer-events-none disabled:opacity-50"
              }
            >
              Reject
            </button>
          </div>
          <p className="text-xs leading-5 text-ink-soft">
            Approval runs the governance chokepoint (consent, suppression,
            budget, discount ceiling, claim checks, freshness) before anything
            activates. Activation is simulated in alpha (PRD 25.1).
          </p>
        </div>
      ) : null}

      {!decidable && !result ? (
        <p className="text-sm text-ink-muted">
          This action is {rejected ? "rejected" : "already decided"} — see the
          Approval Center for its current state.
        </p>
      ) : null}
    </Card>
  );
}
