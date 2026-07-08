/**
 * lib/server/errors.ts — central safe error handling (hardening P13).
 *
 * Rules:
 *  - Only messages explicitly marked user-safe (UserFacingError) may reach the
 *    UI or the Context Ledger. Everything else collapses to a generic message.
 *  - Stack traces and internal details (driver errors, paths, SQL) stay on the
 *    server console via logServerError — never in a thrown message, a ledger
 *    reasoningSummary, or a client-rendered string.
 *
 * This is a plain server helper module (server-only marker, NOT "use server" —
 * it exports a class and sync functions, which action modules cannot).
 */

import "server-only"; // build-time guard: must never enter a client bundle

/** Fallback shown when an error was not explicitly marked user-safe. */
export const GENERIC_USER_MESSAGE =
  "Something went wrong on our side. The failure has been recorded — please try again.";

/**
 * An error whose message is deliberately written for the merchant and safe to
 * surface in the UI and in ledger summaries. Wrap internal causes via
 * `{ cause }` so logServerError can still record the real failure.
 */
export class UserFacingError extends Error {
  /** Structural marker so instanceof survives duplicated module instances. */
  readonly userFacing = true as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UserFacingError";
  }
}

export function isUserFacingError(error: unknown): error is UserFacingError {
  if (error instanceof UserFacingError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { userFacing?: unknown }).userFacing === true &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/**
 * Collapse any thrown value to a string that is safe for the UI and for
 * ledger reasoningSummary fields. UserFacingError messages pass through;
 * anything else becomes the fallback (never a stack trace, never internals).
 */
export function toUserMessage(
  error: unknown,
  fallback: string = GENERIC_USER_MESSAGE,
): string {
  return isUserFacingError(error) ? error.message : fallback;
}

/**
 * Consistent server-side log line for failures. The full detail (including
 * stack and cause) goes to the server console ONLY — callers surface
 * toUserMessage() to the user instead.
 */
export function logServerError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  console.error(`[${scope}] ${detail}${suffix}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  if (error instanceof Error && error.cause !== undefined) {
    const cause = error.cause;
    console.error(
      `[${scope}] caused by:`,
      cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause),
    );
  }
}
