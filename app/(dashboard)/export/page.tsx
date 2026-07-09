/**
 * Screen 16 — Export State (PRD 19).
 *
 * One export row per PRD 19.1 object type, CSV/JSON format choice, and job
 * status. Server shell resolves the account; the interactive panel is a
 * client component calling the exportState server action.
 */

import { ensureDemoAccount } from "@/lib/server";
import { PageShell } from "../performance/shared-ui";
import { ExportPanel } from "./export-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Export State — AI Growth Operator" };

export default async function ExportPage() {
  const account = await ensureDemoAccount();

  return (
    <PageShell
      active="export"
      title="Export State"
      subtitle="Your context is portable: customers, audiences, Operating Rules, learned preferences, opportunity and action history, and measurement summaries export to open formats (PRD 19)."
      accountName={account.accountName}
      demoMode={account.demoMode}
    >
      <ExportPanel accountId={account.accountId} />
      <p className="text-xs text-ink-soft">
        Every export carries a timestamp, the account identifier, and the
        Operating Rules (constitution) version, and is logged to the Context
        Ledger as an <span className="font-mono">export</span> event. Hashed
        customer identifiers remain hashed — raw emails are never exported
        (PRD 19.3).
      </p>
    </PageShell>
  );
}
