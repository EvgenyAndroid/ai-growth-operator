/**
 * Screen 9 — Operator Chat (PRD 17, 26A.3).
 *
 * A constrained command interface over the three v0 recipes: deterministic
 * intent router, no LLM. Server shell resolves the demo account; the
 * conversation itself is the client ChatPanel.
 */

import { ensureDemoAccount } from "@/lib/server";
import { PageShell } from "../performance/shared-ui";
import { ChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Operator Chat — AI Growth Operator" };

export default async function ChatPage() {
  const account = await ensureDemoAccount();

  return (
    <PageShell
      active="chat"
      title="Operator Chat"
      subtitle="A constrained command interface over the three v0 recipes — it explains, drafts, and routes approved actions. It cannot activate anything, bypass governance, or invent capabilities outside v0 (PRD 17, 26A.3)."
      accountName={account.accountName}
      demoMode={account.demoMode}
    >
      <ChatPanel accountId={account.accountId} />
    </PageShell>
  );
}
