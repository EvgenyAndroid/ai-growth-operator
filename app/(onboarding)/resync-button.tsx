"use client";

/**
 * app/(onboarding)/resync-button.tsx — PRD 8.5: the user can re-sync a
 * source from the UI. Simulated sync in the alpha; revalidates the screen so
 * freshness re-renders.
 */

import * as React from "react";
import { Button } from "@/components/ui/primitives";
import type { ConnectionStatusView } from "@/lib/server/types";
import { resyncSourceAction } from "./actions";

export function ResyncButton({
  accountId,
  source,
  path,
  label = "Sync now",
}: {
  accountId: string;
  source: ConnectionStatusView["source"];
  path: string;
  label?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resyncSourceAction({ accountId, source, path });
        })
      }
    >
      {pending ? "Syncing…" : label}
    </Button>
  );
}
