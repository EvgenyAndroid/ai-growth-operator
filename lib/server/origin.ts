/**
 * lib/server/origin.ts — same-origin check for mutating server actions (P7).
 *
 * Defense-in-depth: Next.js already rejects server-action POSTs whose
 * `Origin` does not match the `Host`/`X-Forwarded-Host` (unless opted out via
 * `experimental.serverActions.allowedOrigins`). This module makes that
 * protection explicit, reusable outside the action transport (e.g. route
 * handlers), and observable (denials are logged by the compose helper in
 * ./rate-limit.ts).
 *
 * Semantics (browser-standard CSRF posture):
 * - No request scope at all (seed/smoke scripts, unit tests running actions
 *   in-process via tsx): SKIP — checks pass, nothing is logged. The smoke
 *   suite is the behavioral contract and must keep working unchanged.
 * - No `Origin` header: ALLOW. Same-origin navigations, server-side calls and
 *   non-browser clients often omit it; Next's built-in action check still
 *   applies on the transport.
 * - `Origin: null` (sandboxed iframe / opaque origin): DENY — fail closed.
 * - Malformed `Origin`: DENY — fail closed.
 * - Origin host !== request host: DENY — fail closed.
 *
 * NOT a "use server" module — plain server-only helpers imported by action
 * files. Marked server-only so it can never reach a client bundle.
 */

import "server-only";

export type OriginCheckResult =
  /** Check passed. `skipped` = true when there was no request scope. */
  | { ok: true; skipped: boolean }
  /** Check failed — caller must fail closed. */
  | { ok: false; reason: string };

/** First entry of a possibly comma-separated forwarded header. */
function firstForwarded(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Compare the request's `Origin` header against its effective host.
 * Never throws — returns a result object so callers decide how to fail.
 */
export async function checkSameOrigin(): Promise<OriginCheckResult> {
  let requestHeaders: { get(name: string): string | null };
  try {
    // Lazy import + request-scope probe, mirroring lib/server/vertical.ts —
    // outside a request (scripts, tests) next/headers throws and we skip.
    const { headers } = await import("next/headers");
    requestHeaders = await headers();
  } catch {
    return { ok: true, skipped: true };
  }

  const origin = requestHeaders.get("origin");
  if (!origin) return { ok: true, skipped: false };
  if (origin === "null") {
    return { ok: false, reason: "opaque (null) origin" };
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false, reason: `malformed origin header: ${origin}` };
  }

  const host =
    firstForwarded(requestHeaders.get("x-forwarded-host")) ??
    requestHeaders.get("host");
  // Cannot compare without a host header; Next's built-in server-action
  // origin/host check remains in force on the transport, so allow here.
  if (!host) return { ok: true, skipped: false };

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    return {
      ok: false,
      reason: `cross-origin request: origin host "${originHost}" != request host "${host}"`,
    };
  }

  return { ok: true, skipped: false };
}

/**
 * Standalone assertion for call sites that only need the origin check
 * (the composed `guardMutation` in ./rate-limit.ts is preferred for the
 * high-risk actions — it adds rate limiting + attempt logging).
 * Throws a user-safe Error (no internals) when the check fails.
 */
export async function assertSameOrigin(action: string): Promise<void> {
  const result = await checkSameOrigin();
  if (!result.ok) {
    console.warn(`[mutation-guard] ${action} origin_denied: ${result.reason}`);
    throw new Error("Request blocked: cross-origin mutation is not allowed.");
  }
}
