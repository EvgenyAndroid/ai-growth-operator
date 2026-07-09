"use server";

/**
 * app/(onboarding)/actions.ts — thin form-action wrappers over lib/server.
 *
 * The UI layer never imports deeper modules directly (docs/CONTRACTS.md import
 * direction rule); these wrappers adapt FormData / navigation concerns onto
 * the lib/server onboarding actions. Guards (P7) and validation (P5) live in
 * the lib/server actions themselves — exactly one guardMutation per action.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDemoAccount } from "@/lib/server/onboarding/read";
import {
  resetDemoWorkspace as resetDemoWorkspaceAction,
  resyncConnection,
  saveOperatingRules,
  selectDemoVertical,
} from "@/lib/server/onboarding/actions";
import type { ConnectionStatusView } from "@/lib/server/types";

/**
 * Screen 1 CTA — "Enter demo workspace". No real auth in the alpha (PRD 25.1);
 * this reuses (or first-creates) the seeded demo account and starts
 * onboarding. NEVER resets (hardening pass 2, item 3).
 */
export async function enterDemoWorkspace(): Promise<void> {
  await ensureDemoAccount();
  redirect("/setup");
}

/**
 * Landing-page secondary action — wipe and reseed the demo dataset. Delegates
 * to THE only reset path (lib/server/onboarding/actions resetDemoWorkspace,
 * guardMutation-guarded there).
 */
export async function resetDemoWorkspace(): Promise<void> {
  await resetDemoWorkspaceAction();
  redirect("/setup");
}

/**
 * Screen 2 — Business Setup. Persists the vertical choice (cookie — trust
 * rule #10: vertical selection routes everything downstream) and provisions
 * the matching demo workspace (guarded selectDemoVertical), then moves on to
 * the Operating Rules template. "shopify_dtc" keeps the existing DTC alpha
 * exactly as-is.
 */
export async function selectBusinessTypeAction(vertical: string): Promise<void> {
  await selectDemoVertical(vertical); // validates; throws on unknown
  redirect("/rules");
}

export interface SaveRulesFormState {
  error: string | null;
}

/**
 * Screen 4 — persist THE THREE NUMBERS (PRD 12.3). Creates a NEW Operating
 * Rules version via lib/server and moves on to Connect Data Sources.
 */
export async function saveRulesAction(
  _prev: SaveRulesFormState,
  formData: FormData,
): Promise<SaveRulesFormState> {
  const accountId = String(formData.get("accountId") ?? "");
  const monthlyBudgetCap = Number(formData.get("monthlyBudgetCap"));
  const maxDiscountPercent = Number(formData.get("maxDiscountPercent"));
  const dailySendCap = Number(formData.get("dailySendCap"));

  if (!accountId) {
    return { error: "Missing account. Re-enter the demo workspace from the landing page." };
  }

  try {
    await saveOperatingRules({
      accountId,
      monthlyBudgetCap,
      maxDiscountPercent,
      dailySendCap,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save Operating Rules. Check the three numbers and try again.",
    };
  }

  redirect("/connect");
}

/**
 * PRD 8.5 — user can re-sync a source from the UI (simulated in the alpha).
 * Revalidates the calling screen so freshness re-renders.
 */
export async function resyncSourceAction(params: {
  accountId: string;
  source: ConnectionStatusView["source"];
  path: string;
}): Promise<void> {
  await resyncConnection({ accountId: params.accountId, source: params.source });
  revalidatePath(params.path);
}
