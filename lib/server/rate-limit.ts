/**
 * lib/server/rate-limit.ts — interface-based rate limiter + mutation-guard
 * compose helper (P7). Light alpha guardrails: the demo must stay usable,
 * so limits are generous and everything degrades gracefully.
 *
 * Architecture:
 * - `RateLimiter` is a tiny async interface so the storage backend is
 *   swappable without touching call sites.
 * - Default backend is the in-memory fixed-window limiter — correct for
 *   `next dev` / `next start` (single process) and best-effort per-isolate
 *   on Cloudflare Workers.
 * - No-op fallback: set RATE_LIMIT_DISABLED=1 (or call
 *   `setRateLimiter(createNoopRateLimiter())`) to turn limiting off without
 *   code changes.
 * - Cloudflare adapter seam: for real production enforcement across
 *   isolates, implement `RateLimiter` over KV / D1 / a Durable Object (or
 *   Cloudflare's native rate-limiting binding) and inject it once at startup
 *   via `setRateLimiter(...)`. No call-site changes required. (Prod TODO —
 *   out of scope for this alpha pass.)
 *
 * `guardMutation(action)` is the ONE-LINE composed guard for high-risk
 * actions (see lib/server/WIRING.md): same-origin check (./origin.ts) +
 * rate limit + mutation-attempt logging. Fail-closed on origin mismatch and
 * on limit exhaustion; skips entirely when there is no request scope so the
 * smoke suite and seed scripts keep working unchanged.
 *
 * NOT a "use server" module — plain server-only helpers imported by action
 * files. Marked server-only so it can never reach a client bundle.
 */

import "server-only";

import { checkSameOrigin } from "./origin";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RateLimitRule {
  /** Maximum number of calls allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Calls left in the current window (0 when denied). */
  remaining: number;
  /** How long until the window resets (ms); 0 when allowed. */
  retryAfterMs: number;
}

export interface RateLimiter {
  limit(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

/** Fixed-window in-memory limiter. Single-process scope; prunes lazily. */
export function createInMemoryRateLimiter(): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const MAX_TRACKED_KEYS = 5_000;

  function prune(now: number): void {
    if (windows.size < MAX_TRACKED_KEYS) return;
    for (const [key, entry] of windows) {
      if (entry.resetAt <= now) windows.delete(key);
    }
  }

  return {
    async limit(key, rule) {
      const now = Date.now();
      prune(now);
      const entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { allowed: true, remaining: rule.max - 1, retryAfterMs: 0 };
      }
      if (entry.count >= rule.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, entry.resetAt - now),
        };
      }
      entry.count += 1;
      return {
        allowed: true,
        remaining: rule.max - entry.count,
        retryAfterMs: 0,
      };
    },
  };
}

/** No-op limiter — always allows. Fallback when limiting must be disabled. */
export function createNoopRateLimiter(): RateLimiter {
  return {
    async limit(_key, rule) {
      return { allowed: true, remaining: rule.max, retryAfterMs: 0 };
    },
  };
}

// ---------------------------------------------------------------------------
// Active limiter (module singleton + injection seam)
// ---------------------------------------------------------------------------

let activeLimiter: RateLimiter | null = null;

/** Injection seam for a Cloudflare KV/D1/DO-backed adapter (see header). */
export function setRateLimiter(limiter: RateLimiter): void {
  activeLimiter = limiter;
}

export function getRateLimiter(): RateLimiter {
  if (!activeLimiter) {
    activeLimiter =
      process.env.RATE_LIMIT_DISABLED === "1"
        ? createNoopRateLimiter()
        : createInMemoryRateLimiter();
  }
  return activeLimiter;
}

// ---------------------------------------------------------------------------
// Per-action rules (generous — demo stays usable)
// ---------------------------------------------------------------------------

export const DEFAULT_MUTATION_RULE: RateLimitRule = {
  max: 30,
  windowMs: 60_000,
};

/** Overrides for the expensive / abuse-prone actions. */
export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  resetDemoWorkspace: { max: 5, windowMs: 60_000 },
  resyncConnection: { max: 10, windowMs: 60_000 },
  exportState: { max: 10, windowMs: 60_000 },
  operatorChat: { max: 20, windowMs: 60_000 },
};

// ---------------------------------------------------------------------------
// Compose helper — the one-line guard (see lib/server/WIRING.md)
// ---------------------------------------------------------------------------

/**
 * Best-effort client fingerprint for rate-limit keying.
 * Returns null when there is no request scope (scripts/tests) — callers
 * treat that as "skip guarding entirely".
 */
async function getClientKey(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip");
    return ip || "local";
  } catch {
    return null;
  }
}

function logMutationAttempt(
  action: string,
  key: string,
  outcome: "allowed" | "rate_limited" | "origin_denied",
  detail?: string,
): void {
  const line = `[mutation-guard] ${action} ${outcome} key=${key}${detail ? ` (${detail})` : ""}`;
  if (outcome === "allowed") console.info(line);
  else console.warn(line);
}

/**
 * Composed guard for high-risk mutating actions: same-origin check +
 * rate limit + attempt logging. Call as the first line of the action body:
 *
 *   await guardMutation("approveAction");
 *
 * Throws a user-safe Error (no internals, no stack details in the message)
 * when the request is cross-origin or over the limit. Skips silently when
 * invoked outside a request scope (seed/smoke/tests) so in-process action
 * calls keep working.
 */
export async function guardMutation(
  action: string,
  opts?: { rule?: RateLimitRule },
): Promise<void> {
  const key = await getClientKey();
  if (key === null) return; // no request scope — scripts/tests; skip.

  const origin = await checkSameOrigin();
  if (!origin.ok) {
    logMutationAttempt(action, key, "origin_denied", origin.reason);
    throw new Error("Request blocked: cross-origin mutation is not allowed.");
  }

  const rule = opts?.rule ?? RATE_LIMIT_RULES[action] ?? DEFAULT_MUTATION_RULE;
  const decision = await getRateLimiter().limit(`${action}:${key}`, rule);
  if (!decision.allowed) {
    logMutationAttempt(
      action,
      key,
      "rate_limited",
      `retry in ${Math.ceil(decision.retryAfterMs / 1000)}s`,
    );
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  logMutationAttempt(action, key, "allowed");
}
