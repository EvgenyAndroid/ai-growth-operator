/**
 * lib/server/validation.ts — zod input schemas for every exported server
 * action (hardening P5).
 *
 * Rules applied uniformly:
 *  - ids: bounded length + charset (cuid/uuid-safe), never free-form
 *  - text: trimmed, minimum where required, hard max lengths
 *  - numbers: finite and bounded (zod rejects NaN/Infinity by default)
 *  - enums: validated against the contract unions (exhaustiveness is
 *    type-checked via the Record<Union, true> key-list pattern)
 *  - arrays: capped
 *  - unknown fields: stripped (zod object default), never persisted
 *  - failures: safeParse -> one user-safe Error message per action, no echo
 *    of oversized payloads, no stack traces surfaced to users
 *
 * Every exported server action calls parseInput(...) as its FIRST statement,
 * before the account guard and before any DB access.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import { z } from "zod";

import type {
  ContractLedgerEventType,
  ContractReadType,
  IntegrationSource,
} from "../contracts";
import { VERTICALS } from "../contracts";
import type { ExportFormat, ExportObjectType } from "./types";

// ---------------------------------------------------------------------------
// parse helper — safeParse with user-safe errors
// ---------------------------------------------------------------------------

/** User-safe validation failure (message contains no user-supplied payload). */
export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

/**
 * Validate `value` against `schema`; throw a single user-safe error naming
 * the action and the offending fields on failure. Unknown fields are stripped
 * by the object schemas, so the returned value is safe to use as-is.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  action: string,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 3)
      .map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path} ${issue.message}` : issue.message;
      })
      .join("; ");
    throw new InputValidationError(`Invalid input for ${action}: ${details}.`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Enum key lists — Record<Union, true> keeps them exhaustive at compile time
// ---------------------------------------------------------------------------

function enumKeys<T extends string>(record: Record<T, true>): [T, ...T[]] {
  return Object.keys(record) as [T, ...T[]];
}

const INTEGRATION_SOURCES = enumKeys<IntegrationSource>({
  shopify: true,
  klaviyo: true,
  meta: true,
  ga4: true,
  stripe: true,
  square: true,
  mailchimp: true,
  gbp: true,
});

const READ_TYPES = enumKeys<ContractReadType>({
  early: true,
  primary: true,
  long: true,
});

const LEDGER_EVENT_TYPES = enumKeys<ContractLedgerEventType>({
  data_sync: true,
  opportunity_found: true,
  opportunity_sized: true,
  opportunity_drafted: true,
  user_edit: true,
  approval: true,
  rejection: true,
  dismissal: true,
  activation_attempt: true,
  activation_success: true,
  activation_failure: true,
  holdout_assignment: true,
  measurement_readback: true,
  performance_summary: true,
  rules_edit: true,
  export: true,
  chat_interaction: true,
});

const EXPORT_OBJECT_TYPES = enumKeys<ExportObjectType>({
  customers: true,
  audiences: true,
  operating_rules: true,
  preferences: true,
  opportunities: true,
  actions: true,
  measurements: true,
});

const EXPORT_FORMATS = enumKeys<ExportFormat>({ csv: true, json: true });

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

/** Database ids (cuid today; charset also covers uuid). Bounded, no echo. */
const idSchema = z
  .string("must be a string")
  .trim()
  .min(1, "is required")
  .max(64, "is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "must be a well-formed id");

/** Actor labels (userId / approver / requestedBy) — display strings. */
const actorSchema = z
  .string("must be a string")
  .trim()
  .min(1, "must not be empty")
  .max(120, "is too long");

/** Required human-entered reasons (rejection / dismissal, PRD 26 DoD #11). */
const reasonSchema = z
  .string("must be a string")
  .trim()
  .min(1, "is required (PRD 26 DoD #11)")
  .max(2_000, "is too long (max 2000 characters)");

/** ISO-parseable timestamp filters. */
const isoDateSchema = z
  .string("must be a string")
  .trim()
  .max(64, "is too long")
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a valid date");

/** One validated template step of replacement draft copy (26B.18 edits). */
const draftCopyStepSchema = z.object({
  step: z.number("must be a number").int().min(1).max(50),
  channel: z.enum(["email", "meta_audience"]),
  subject: z.string().max(300, "is too long").optional(),
  previewText: z.string().max(500, "is too long").optional(),
  body: z.string().min(1, "is required").max(20_000, "is too long"),
  offerPercent: z.number("must be a number").min(0).max(100).optional(),
  sendDelayHours: z.number("must be a number").min(0).max(8_760).optional(),
});

// ---------------------------------------------------------------------------
// Per-action schemas
// ---------------------------------------------------------------------------

/** Bare accountId parameters (listOpportunities, getOperatingRules, ...). */
export const accountIdSchema = idSchema;

// actions.ts
export const draftActionSchema = z.object({
  accountId: idSchema,
  opportunityId: idSchema,
  userId: actorSchema.optional(),
});

export const approveActionSchema = z.object({
  accountId: idSchema,
  actionId: idSchema,
  approver: actorSchema.optional(),
  metaIdentifierRightsConfirmed: z.boolean("must be a boolean").optional(),
  claimOverrides: z
    .array(z.string().trim().min(1).max(120, "is too long"))
    .max(32, "has too many entries")
    .optional(),
});

export const rejectActionSchema = z.object({
  accountId: idSchema,
  actionId: idSchema,
  reason: reasonSchema,
  userId: actorSchema.optional(),
});

export const recordDraftEditSchema = z.object({
  accountId: idSchema,
  draftId: idSchema,
  editSummary: reasonSchema,
  copy: z.array(draftCopyStepSchema).max(24, "has too many steps").optional(),
  userId: actorSchema.optional(),
});

// opportunities.ts
export const getOpportunityDetailSchema = z.object({
  accountId: idSchema,
  opportunityId: idSchema,
});

export const dismissOpportunitySchema = z.object({
  accountId: idSchema,
  opportunityId: idSchema,
  reason: reasonSchema,
  cooldownDays: z.number("must be a number").int().min(1).max(365).optional(),
  userId: actorSchema.optional(),
});

// onboarding/read.ts — ensureDemoAccount NEVER accepts reset (hardening
// pass 2, item 3): a forged `reset` field is stripped by the object schema.
export const ensureDemoAccountSchema = z.object({
  vertical: z.enum(VERTICALS).optional(),
});

// onboarding/actions.ts — the ONLY reset path (guardMutation-guarded).
export const resetDemoWorkspaceSchema = z.object({
  vertical: z.enum(VERTICALS).optional(),
});

// onboarding/actions.ts — Business Setup vertical choice (registry membership
// is re-validated in setActiveVertical, which throws on unknown values).
export const selectDemoVerticalSchema = z.enum(VERTICALS);

export const saveOperatingRulesSchema = z.object({
  accountId: idSchema,
  monthlyBudgetCap: z
    .number("must be a number")
    .min(0, "must be a non-negative number")
    .max(100_000_000, "is too large"),
  maxDiscountPercent: z
    .number("must be a number")
    .min(0, "must be a non-negative number")
    .max(100, "cannot exceed 100"),
  dailySendCap: z
    .number("must be a number")
    .min(0, "must be a non-negative number")
    .max(10_000_000, "is too large"),
  userId: actorSchema.optional(),
});

export const resyncConnectionSchema = z.object({
  accountId: idSchema,
  source: z.enum(INTEGRATION_SOURCES),
  userId: actorSchema.optional(),
});

// performance.ts
export const getPerformanceSchema = z.object({
  accountId: idSchema,
  actionId: idSchema,
  readType: z.enum(READ_TYPES).optional(),
});

// ledger.ts
export const getLedgerSchema = z.object({
  accountId: idSchema,
  eventTypes: z
    .array(z.enum(LEDGER_EVENT_TYPES))
    .max(LEDGER_EVENT_TYPES.length, "has too many entries")
    .optional(),
  actionId: idSchema.optional(),
  opportunityId: idSchema.optional(),
  userId: actorSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  cursor: idSchema.optional(),
  limit: z.number("must be a number").int().min(1).max(200).optional(),
});

export const getActionAuditSchema = z.object({
  accountId: idSchema,
  actionId: idSchema,
});

export const getOpportunityAuditSchema = z.object({
  accountId: idSchema,
  opportunityId: idSchema,
});

// export.ts
export const exportStateSchema = z.object({
  accountId: idSchema,
  objectType: z.enum(EXPORT_OBJECT_TYPES),
  format: z.enum(EXPORT_FORMATS).optional(),
  // Matches the P8 in-action bound (200) rather than the 120 actor default.
  requestedBy: z.string().trim().min(1).max(200, "is too long").optional(),
});

// chat.ts — empty input is ALLOWED (the 26A.3 router answers "unsupported"),
// only the length is bounded.
export const operatorChatSchema = z.object({
  accountId: idSchema,
  input: z.string("must be a string").max(4_000, "is too long (max 4000 characters)"),
  userId: actorSchema.optional(),
});
