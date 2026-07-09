/**
 * Screen 15 — Context Ledger / Audit Log (PRD 18).
 *
 * Filterable, paginated table over lib/server getLedger. Every Operator
 * decision — recommendation, draft, approval, rejection, activation,
 * measurement, export, rules edit, chat turn — is reconstructable here.
 */

import Link from "next/link";
import { ensureDemoAccount, getLedger } from "@/lib/server";
import type { ContractLedgerEventType } from "@/lib/contracts";
import { SectionHeading } from "@/components/ui/primitives";
import { LedgerTable, PageShell } from "../performance/shared-ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Context Ledger — AI Growth Operator" };

/** The full PRD 18.2 event list (mirrors ContractLedgerEventType). */
const EVENT_TYPES: ContractLedgerEventType[] = [
  "data_sync",
  "opportunity_found",
  "opportunity_sized",
  "opportunity_drafted",
  "user_edit",
  "approval",
  "rejection",
  "dismissal",
  "activation_attempt",
  "activation_success",
  "activation_failure",
  "holdout_assignment",
  "measurement_readback",
  "performance_summary",
  "rules_edit",
  "export",
  "chat_interaction",
];

function isEventType(value: string | undefined): value is ContractLedgerEventType {
  return value !== undefined && (EVENT_TYPES as string[]).includes(value);
}

function buildHref(params: {
  type?: string;
  action?: string;
  opportunity?: string;
  cursor?: string;
}): string {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.action) query.set("action", params.action);
  if (params.opportunity) query.set("opportunity", params.opportunity);
  if (params.cursor) query.set("cursor", params.cursor);
  const queryString = query.toString();
  return queryString ? `/ledger?${queryString}` : "/ledger";
}

const PAGE_SIZE = 50;

/** Event-type filter chips — technical mono labels, audit-console feel. */
const CHIP_ACTIVE =
  "rounded-full border border-primary bg-primary px-3 py-1 font-mono text-[11px] font-medium text-white " +
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_1px_2px_rgb(2_6_23/0.35),0_0_14px_var(--glow-blue)]";
const CHIP_IDLE =
  "rounded-full border border-border-strong bg-surface px-3 py-1 font-mono text-[11px] font-medium text-ink-muted " +
  "shadow-xs transition-[background-color,border-color,color,translate] duration-150 ease-out " +
  "hover:-translate-y-px hover:border-slate-300 hover:bg-surface-soft hover:text-ink";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const account = await ensureDemoAccount();

  const typeParam = typeof sp.type === "string" ? sp.type : undefined;
  const eventType = isEventType(typeParam) ? typeParam : undefined;
  const actionId = typeof sp.action === "string" ? sp.action : undefined;
  const opportunityId = typeof sp.opportunity === "string" ? sp.opportunity : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  const page = await getLedger({
    accountId: account.accountId,
    eventTypes: eventType ? [eventType] : undefined,
    actionId,
    opportunityId,
    cursor,
    limit: PAGE_SIZE,
  });

  const hasEntityFilter = Boolean(actionId ?? opportunityId);

  return (
    <PageShell
      active="ledger"
      title="Context Ledger"
      subtitle={`Every Operator decision, reconstructable (PRD 18). ${page.totalMatching.toLocaleString("en-US")} entries logged for this account.`}
      accountName={account.accountName}
      demoMode={account.demoMode}
    >
      <section>
        <SectionHeading
          title="Filter by event type"
          subtitle="One filter chip per PRD 18.2 event."
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link
            href={buildHref({ action: actionId, opportunity: opportunityId })}
            className={!eventType ? CHIP_ACTIVE : CHIP_IDLE}
          >
            all
          </Link>
          {EVENT_TYPES.map((type) => (
            <Link
              key={type}
              href={buildHref({ type, action: actionId, opportunity: opportunityId })}
              className={eventType === type ? CHIP_ACTIVE : CHIP_IDLE}
            >
              {type}
            </Link>
          ))}
        </div>
        {hasEntityFilter ? (
          <p className="mt-3 text-sm text-ink-muted">
            Filtered to{" "}
            {actionId ? (
              <>
                action <span className="break-all font-mono text-xs">{actionId}</span>
              </>
            ) : null}
            {actionId && opportunityId ? " and " : null}
            {opportunityId ? (
              <>
                opportunity <span className="break-all font-mono text-xs">{opportunityId}</span>
              </>
            ) : null}
            {" · "}
            <Link
              className="font-medium text-accent underline underline-offset-2 transition-colors duration-150 hover:text-accent-hover"
              href={buildHref({ type: eventType })}
            >
              clear entity filter
            </Link>
          </p>
        ) : null}
      </section>

      <LedgerTable entries={page.entries} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-ink-soft">
          Showing {page.entries.length} entries
          {eventType ? ` of type "${eventType}"` : ""}
          {cursor ? " (paged)" : ""}. Every entry written through the Operator
          carries its Operating Rules (constitution) version — PRD 18.3.
        </p>
        {page.nextCursor ? (
          <Link
            href={buildHref({
              type: eventType,
              action: actionId,
              opportunity: opportunityId,
              cursor: page.nextCursor,
            })}
            className="shrink-0 whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary shadow-xs transition-colors duration-150 hover:border-slate-300 hover:bg-surface-soft hover:text-ink"
          >
            Older entries →
          </Link>
        ) : null}
      </div>
    </PageShell>
  );
}
