/**
 * lib/server/vertical.ts — active-vertical resolution for the server layer.
 *
 * The onboarding Business Setup screen picks a vertical; that choice is
 * persisted in a cookie so every subsequent server component / action resolves
 * the matching demo account (vertical selection routes EVERYTHING — trust
 * rule #10). Defaults to "shopify_dtc" so the existing DTC alpha behaves
 * byte-identically when no choice was ever made.
 *
 * NOT re-exported through lib/server/index.ts: this module touches
 * next/headers (server-request scope) and must never reach a client bundle.
 * Server components and "use server" action files import it directly as
 * "@/lib/server/vertical".
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type { Vertical } from "../contracts";
import { getVerticalDefinition, isVertical } from "../verticals";

// Re-exported for server components (ui -> lib/server import direction).
export { getVerticalDefinition, isVertical };
export type { VerticalDefinition, FeedCopyVariants } from "../verticals";

/** Cookie carrying the vertical picked on the Business Setup screen. */
export const VERTICAL_COOKIE = "ago_vertical";

/**
 * Read the vertical cookie. Lazily imports next/headers and swallows the
 * "outside a request scope" error so non-Next callers (scripts/smoke-cycle.mts
 * runs createDemoAccount under tsx) keep working and fall back to DTC.
 */
async function readVerticalCookie(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return store.get(VERTICAL_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/**
 * The vertical the current request is operating in. Unknown / absent cookie
 * values resolve to "shopify_dtc" — the pre-vertical alpha behavior.
 */
export async function getActiveVertical(): Promise<Vertical> {
  const raw = await readVerticalCookie();
  return raw !== undefined && isVertical(raw) ? raw : "shopify_dtc";
}

/**
 * Persist the vertical choice (Business Setup screen). Must be called from a
 * Server Action or Route Handler — cookie writes are illegal during render.
 * Validates the value: routing silently to a wrong vertical would violate the
 * trust rules, so unknown values throw.
 */
export async function setActiveVertical(value: string): Promise<Vertical> {
  // getVerticalDefinition throws on unknown values with a precise message.
  const definition = getVerticalDefinition(value);
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(VERTICAL_COOKIE, definition.vertical, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return definition.vertical;
}
