/**
 * lib/server/account-context.ts — the account boundary (auth-ready, no real
 * auth in the alpha; hardening P4).
 *
 * Server actions must never blindly trust a client-supplied accountId. The
 * alpha has no users/sessions — the only legitimate account for a browser
 * request is THE demo workspace of the vertical the visitor selected on the
 * Business Setup screen (persisted in the `ago_vertical` cookie, trust rule
 * #10). This module centralizes that resolution:
 *
 *   getCurrentAccountContext — resolve the demo account for the active
 *                              vertical context (null when not seeded yet)
 *   requireCurrentAccount    — same, but throws when unresolvable
 *   requireDemoAccount       — requireCurrentAccount + demoMode invariant
 *   assertAccountAccess(id)  — THE guard every account-scoped server action
 *                              calls first: the id must name an account that
 *                              exists, is a demo workspace, and (inside any
 *                              untrusted request context) is exactly the demo
 *                              account of the active vertical. Returns the
 *                              account row so callers keep a single lookup.
 *
 * Context resolution order:
 *   1. explicit AsyncLocalStorage override (runWithVerticalContext — used by
 *      trusted node checks/tests to simulate a request's vertical context);
 *   2. the request's vertical cookie (absent/unknown cookie => "shopify_dtc",
 *      matching lib/server/vertical.ts getActiveVertical);
 *   3. no context at all (tsx scripts like prisma/seed.ts and the smoke
 *      cycles, or build-time prerender): there is no untrusted client input
 *      to distrust — any *demo* account remains reachable, never a live one.
 *      HTTP requests can never take this branch: inside a request scope,
 *      cookies() always resolves.
 *
 * ── PRODUCTION SEAM (TODO before any real-auth launch) ─────────────────────
 * Real auth replaces the vertical-cookie match in assertAccountAccess with:
 *   session -> user -> org membership -> role, i.e.
 *   1. resolve the session user (cookie/JWT via the auth provider);
 *   2. load the user's org memberships + role;
 *   3. authorize: accountId ∈ user's orgs AND role permits the operation.
 * Everything else (call sites, error shape, fail-closed behavior) stays.
 * ────────────────────────────────────────────────────────────────────────────
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { AsyncLocalStorage } from "node:async_hooks";

import type { Vertical } from "../contracts";
import type { Account } from "../contracts/models";
import db from "../db";
import { DEMO_ACCOUNT_NAME } from "../demo";
import { LOCAL_DEMO_ACCOUNT_NAME } from "../demo/local";
import { isVertical } from "../verticals";
import { VERTICAL_COOKIE } from "./vertical";

/** Canonical demo workspace per vertical (PRD 25.1 — demo-mode only alpha). */
const DEMO_ACCOUNT_NAME_BY_VERTICAL: Record<Vertical, string> = {
  shopify_dtc: DEMO_ACCOUNT_NAME,
  local_service: LOCAL_DEMO_ACCOUNT_NAME,
};

/**
 * User-safe access failure. One message for "not found" and "forbidden" so
 * account ids cannot be probed, and it never echoes attacker-supplied input.
 */
export class AccountAccessError extends Error {
  constructor() {
    super("This workspace is not available in the current session.");
    this.name = "AccountAccessError";
  }
}

// ---------------------------------------------------------------------------
// Vertical-context resolution
// ---------------------------------------------------------------------------

type VerticalScope =
  | { source: "override" | "request"; vertical: Vertical }
  | { source: "none"; vertical: null };

// Singleton via globalThis (same pattern as lib/db.ts): under tsx, .mts
// entrypoints (ESM) and .ts lib modules (CJS) can instantiate this module
// twice — the override must live in ONE AsyncLocalStorage for both.
const globalForAccountContext = globalThis as unknown as {
  __agoVerticalOverride?: AsyncLocalStorage<Vertical>;
};
const verticalOverride = (globalForAccountContext.__agoVerticalOverride ??=
  new AsyncLocalStorage<Vertical>());

/**
 * Run `fn` as if the request carried the given vertical context. For trusted
 * server-side checks/tests (scripts/check-account-boundary.mts) that need to
 * exercise the SAME strict guard path a browser request goes through.
 */
export async function runWithVerticalContext<T>(
  vertical: Vertical,
  fn: () => Promise<T>,
): Promise<T> {
  return verticalOverride.run(vertical, fn);
}

/**
 * Resolve the active vertical context. Mirrors vertical.ts getActiveVertical
 * but distinguishes "inside a request, cookie absent => DTC default" (still an
 * untrusted client context — enforce) from "no request scope at all" (trusted
 * server-side execution — nothing to enforce against).
 */
async function resolveVerticalScope(): Promise<VerticalScope> {
  const override = verticalOverride.getStore();
  if (override !== undefined) return { source: "override", vertical: override };
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const raw = store.get(VERTICAL_COOKIE)?.value;
    return {
      source: "request",
      vertical: raw !== undefined && isVertical(raw) ? raw : "shopify_dtc",
    };
  } catch {
    // Outside a request scope (tsx scripts, build-time prerender).
    return { source: "none", vertical: null };
  }
}

// ---------------------------------------------------------------------------
// Central resolver
// ---------------------------------------------------------------------------

export interface AccountContext {
  account: Account;
  vertical: Vertical;
  /** Where the vertical context came from ("script" = no request scope). */
  source: "override" | "request" | "script";
}

/**
 * The account the current context is allowed to operate on: the demo
 * workspace of the active vertical. Null when that workspace has not been
 * seeded yet (the caller decides whether that is an error).
 */
export async function getCurrentAccountContext(): Promise<AccountContext | null> {
  const scope = await resolveVerticalScope();
  const vertical = scope.vertical ?? "shopify_dtc";
  const account = await db.account.findFirst({
    where: {
      name: DEMO_ACCOUNT_NAME_BY_VERTICAL[vertical],
      vertical,
      demoMode: true,
    },
  });
  if (!account) return null;
  return {
    account,
    vertical,
    source: scope.source === "none" ? "script" : scope.source,
  };
}

/** getCurrentAccountContext, but unresolvable context fails closed. */
export async function requireCurrentAccount(): Promise<Account> {
  const context = await getCurrentAccountContext();
  if (!context) throw new AccountAccessError();
  return context.account;
}

/** requireCurrentAccount + the demo-mode invariant made explicit (PRD 25.1). */
export async function requireDemoAccount(): Promise<Account> {
  const account = await requireCurrentAccount();
  if (!account.demoMode) throw new AccountAccessError();
  return account;
}

// ---------------------------------------------------------------------------
// The guard — every account-scoped server action calls this first
// ---------------------------------------------------------------------------

/**
 * Validate that the (client-supplied) accountId may be operated on from the
 * current context, and return the account row. Fails closed:
 *  - unknown account            -> AccountAccessError
 *  - non-demo account           -> AccountAccessError (alpha is demo-only)
 *  - request/override context   -> must be exactly the demo account of the
 *                                  active vertical, else AccountAccessError
 *  - no context (trusted script/build execution) -> any demo account
 */
export async function assertAccountAccess(accountId: string): Promise<Account> {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AccountAccessError();
  if (!account.demoMode) throw new AccountAccessError();

  const scope = await resolveVerticalScope();
  if (scope.source === "none") {
    // Trusted server-side execution (seed/smoke scripts, build-time render):
    // no untrusted client context exists. HTTP requests never reach here.
    return account;
  }

  // PRODUCTION SEAM: replace this vertical-cookie match with
  // session -> user -> org membership -> role (see module header).
  if (
    account.vertical !== scope.vertical ||
    account.name !== DEMO_ACCOUNT_NAME_BY_VERTICAL[scope.vertical]
  ) {
    throw new AccountAccessError();
  }
  return account;
}
