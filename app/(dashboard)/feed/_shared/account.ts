/**
 * app/(dashboard)/feed/_shared/account.ts — demo-account resolution for the
 * dashboard slices (Alpha, PRD 25.1: demo mode is the only mode).
 *
 * ensureDemoAccount() is idempotent (reuses the existing demo workspace), so
 * every server component can resolve the working accountId with one call.
 */

import { ensureDemoAccount } from "@/lib/server";

export async function getDemoAccountId(): Promise<string> {
  const account = await ensureDemoAccount();
  return account.accountId;
}
