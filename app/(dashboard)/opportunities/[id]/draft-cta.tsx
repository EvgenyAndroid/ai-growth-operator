"use client";

/**
 * CTA to draft the action (PRD 7.3). Drafting is NOT activation (26A.4) —
 * the button says so, and on success routes to the Campaign Draft Review
 * screen where explicit approval happens.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { draftAction } from "@/lib/server/actions";
import { Button } from "@/components/ui/primitives";

export function DraftCta({
  accountId,
  opportunityId,
}: {
  accountId: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function draft() {
    setBusy(true);
    setError(null);
    try {
      const result = await draftAction({ accountId, opportunityId });
      router.push(`/approvals/${result.actionId}?opp=${result.opportunityId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={draft} disabled={busy}>
        {busy ? "Drafting…" : "Draft this action (nothing sends)"}
      </Button>
      <p className="text-xs leading-5 text-ink-soft">
        Creates a reviewable draft only. Sends, syncs, and suppression changes
        require explicit approval (PRD 26A.4).
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
