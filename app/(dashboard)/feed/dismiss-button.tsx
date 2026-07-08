"use client";

/**
 * Dismiss-with-reason (PRD 7.2 dismissal reason capture, 26 DoD #11).
 * Reason comes from the PRD 7.4 short list plus optional free text; the
 * server action sets the cooldown and feeds the 26B.18 learning loop.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { dismissOpportunity } from "@/lib/server/opportunities";
import { Button, ChoiceChip } from "@/components/ui/primitives";
import { REJECTION_REASONS } from "./_shared/format";

export function DismissButton({
  accountId,
  opportunityId,
}: {
  accountId: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [freeText, setFreeText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError("Pick a reason — dismissals require one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fullReason = freeText.trim()
        ? `${reason}: ${freeText.trim()}`
        : reason;
      await dismissOpportunity({ accountId, opportunityId, reason: fullReason });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dismissal failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Dismiss
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-border-strong bg-surface-soft/70 p-3.5">
      <p className="text-sm font-medium text-ink">
        Why dismiss this opportunity?
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
        placeholder="Optional detail (helps the Operator learn)"
        rows={2}
        className="mt-2 w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-soft"
      />
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Dismissing…" : "Dismiss opportunity"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-ink-soft">
        Dismissed cards pause re-detection for a 14-day cooldown and teach the
        Operator your preferences.
      </p>
    </div>
  );
}
