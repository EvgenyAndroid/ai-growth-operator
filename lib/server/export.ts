"use server";

/**
 * lib/server/export.ts — exportable state (PRD 19).
 *
 * Supported object types: customers, audiences, operating_rules, preferences,
 * opportunities (history), actions (campaign/action history), measurements
 * (summaries). Formats: CSV (tabular) and JSON (structured).
 *
 * Privacy rules (PRD 19.3): raw PII is not exported — customers are exported
 * with their HASHED identifier only (emailLower is dropped); every export
 * carries timestamp, account id, and constitution_version.
 *
 * Hardening (P8): object-type + format allowlists at entry; row-count and
 * payload-size guards (fail closed); filenames derived ONLY from allowlisted
 * constants + server clock (never user input); path-traversal guards on the
 * local archival copy (Workers stays response-only); every failure marks the
 * ExportJob failed AND writes a ledger entry (P13) — no stack traces leave
 * the server.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import db from "../db";
import { writeFailureEvent, writeLedger } from "../ledger";
import { assertAccountAccess } from "./account-context";
import { guardMutation } from "./rate-limit";
import { logServerError, toUserMessage, UserFacingError } from "./errors";
import { latestConstitution } from "./shared";
import { exportStateSchema, parseInput } from "./validation";
import type { ExportFormat, ExportObjectType, ExportStateResult } from "./types";

type Row = Record<string, string | number | boolean | null>;

/** Size guards (P8): fail closed rather than stream unbounded data out. */
const MAX_EXPORT_ROWS = 50_000;
const MAX_EXPORT_BYTES = 20 * 1024 * 1024; // 20 MB serialized payload

/** DB page size — one row past the cap so overflow is detectable. */
const ROW_QUERY_LIMIT = MAX_EXPORT_ROWS + 1;

/** Path segments written to disk must be plain identifier-safe strings
 *  (account ids are cuids). Anything else skips the archival copy. */
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** True on the Cloudflare workerd runtime, where there is no writable disk —
 *  exports are then response-only (the UI downloads from `content` anyway). */
function isWorkerd(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Cloudflare-Workers")
  );
}

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? null)).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function jsonString(value: unknown): string {
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

async function collectRows(
  accountId: string,
  objectType: ExportObjectType,
): Promise<Row[]> {
  switch (objectType) {
    case "customers": {
      const customers = await db.customer.findMany({
        where: { accountId },
        orderBy: { id: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      // PRD 19.3 — hashed identifiers remain hashed; no raw email exported.
      return customers.map((customer) => ({
        id: customer.id,
        email_hash: customer.emailHash,
        consent_email: customer.consentEmail,
        consent_ads: customer.consentAds,
        lifecycle_stage: customer.lifecycleStage,
        first_purchase_date: customer.firstPurchaseDate?.toISOString() ?? null,
        last_purchase_date: customer.lastPurchaseDate?.toISOString() ?? null,
        total_orders: customer.totalOrders,
        total_revenue: customer.totalRevenue,
        refund_rate: customer.refundRate,
        suppression_status: customer.suppressionStatus,
      }));
    }
    case "audiences": {
      const audiences = await db.audience.findMany({
        where: { accountId },
        orderBy: { createdAt: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return audiences.map((audience) => ({
        id: audience.id,
        name: audience.name,
        creation_method: audience.creationMethod,
        size: audience.size,
        eligible_channels: jsonString(audience.eligibleChannels),
        // Rules only — member customer ids are internal working state.
        exclusion_rules: jsonString(audience.exclusionRules),
        destination_status: audience.destinationStatus,
        created_at: audience.createdAt.toISOString(),
      }));
    }
    case "operating_rules": {
      const constitutions = await db.constitution.findMany({
        where: { accountId },
        orderBy: { version: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return constitutions.map((constitution) => ({
        version: constitution.version,
        template_vertical: constitution.templateVertical,
        monthly_budget_cap: constitution.monthlyBudgetCap,
        max_discount_percent: constitution.maxDiscountPercent,
        margin_floor_percent: constitution.marginFloorPercent,
        daily_send_cap: constitution.dailySendCap,
        tone_guide: constitution.toneGuide,
        banned_claims: jsonString(constitution.bannedClaims),
        effective_from: constitution.effectiveFrom.toISOString(),
      }));
    }
    case "preferences": {
      const preferences = await db.preference.findMany({
        where: { accountId },
        orderBy: { key: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return preferences.map((preference) => ({
        key: preference.key,
        value: jsonString(preference.value),
        source: preference.source,
        updated_at: preference.updatedAt.toISOString(),
      }));
    }
    case "opportunities": {
      const opportunities = await db.opportunity.findMany({
        where: { accountId },
        orderBy: { createdAt: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return opportunities.map((opportunity) => ({
        id: opportunity.id,
        recipe_id: opportunity.recipeId,
        recipe_version: opportunity.recipeVersion,
        title: opportunity.title,
        status: opportunity.status,
        confidence: opportunity.confidence,
        estimate_low: opportunity.estimatedValueLow,
        estimate_high: opportunity.estimatedValueHigh,
        estimate_label: opportunity.estimateLabel,
        data_as_of: opportunity.dataAsOf.toISOString(),
        dismissed_reason: opportunity.dismissedReason,
        created_at: opportunity.createdAt.toISOString(),
      }));
    }
    case "actions": {
      const actions = await db.action.findMany({
        where: { accountId },
        orderBy: { createdAt: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return actions.map((action) => ({
        id: action.id,
        type: action.type,
        objective: action.objective,
        channel: action.channel,
        status: action.status,
        activation_level: action.activationLevel,
        measurement_mode: action.measurementMode,
        launched_at: action.launchedAt?.toISOString() ?? null,
        constitution_version: action.constitutionVersion,
        lift_low: action.liftLow,
        lift_high: action.liftHigh,
        created_at: action.createdAt.toISOString(),
      }));
    }
    case "measurements": {
      const entries = await db.ledgerEntry.findMany({
        where: {
          accountId,
          eventType: { in: ["measurement_readback", "performance_summary"] },
        },
        orderBy: { timestamp: "asc" },
        take: ROW_QUERY_LIMIT,
      });
      return entries.map((entry) => ({
        ledger_id: entry.id,
        timestamp: entry.timestamp.toISOString(),
        action_id: entry.actionId,
        measurement_mode: entry.measurementMode,
        confidence: entry.confidence,
        summary: entry.reasoningSummary,
        measured_outcome: jsonString(entry.measuredOutcome),
        constitution_version: entry.constitutionVersion,
      }));
    }
  }
}

const EXPORT_OBJECT_TYPES: ExportObjectType[] = [
  "customers",
  "audiences",
  "operating_rules",
  "preferences",
  "opportunities",
  "actions",
  "measurements",
];

const EXPORT_FORMATS: readonly ExportFormat[] = ["csv", "json"];

/**
 * Export one object type to CSV or JSON (PRD 19.2). Writes the file under
 * exports/<accountId>/ and returns the payload for direct download.
 *
 * P8/P13 failure contract: once the ExportJob row exists, ANY failure marks
 * it status="failed" and appends a ledger entry before rethrowing a
 * user-safe error (never internals, never a stack trace).
 */
export async function exportState(params: {
  accountId: string;
  objectType: ExportObjectType;
  format?: ExportFormat;
  requestedBy?: string;
}): Promise<ExportStateResult> {
  await guardMutation("exportState"); // P7 — origin check + rate limit first
  // P5 — schema validation at entry (id shape, enums, bounded requester label,
  // unknown fields stripped). The P8 allowlist re-reads below stay as
  // defense-in-depth for everything derived from these values.
  params = parseInput(exportStateSchema, params, "exportState");
  // --- input hardening: strict allowlists BEFORE any DB work (P8) -----------
  // Canonical values are re-read from the allowlist constants so everything
  // derived from them (queries, filename, ledger) is never raw user input.
  const objectTypeIndex = EXPORT_OBJECT_TYPES.indexOf(params.objectType);
  if (objectTypeIndex === -1) {
    throw new UserFacingError(
      `Unsupported export object type. Supported: ${EXPORT_OBJECT_TYPES.join(", ")}.`,
    );
  }
  const objectType = EXPORT_OBJECT_TYPES[objectTypeIndex];

  const formatIndex = EXPORT_FORMATS.indexOf(params.format ?? "csv");
  if (formatIndex === -1) {
    throw new UserFacingError(
      `Unsupported export format. Supported: ${EXPORT_FORMATS.join(", ")}.`,
    );
  }
  const format = EXPORT_FORMATS[formatIndex];

  // Bounded, trimmed requester label (stored in the job row + ledger only).
  const requestedBy =
    typeof params.requestedBy === "string"
      ? params.requestedBy.trim().slice(0, 200) || undefined
      : undefined;

  await assertAccountAccess(params.accountId); // P4 — account boundary

  const job = await db.exportJob.create({
    data: {
      accountId: params.accountId,
      objectType,
      requestedBy,
      format,
      status: "running",
    },
  });

  try {
    const now = new Date();
    const constitution = await latestConstitution(params.accountId);
    const constitutionVersion = constitution?.version ?? 0;

    const rows = await collectRows(params.accountId, objectType);
    // Size guard (P8): fail closed instead of emitting an unbounded payload.
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new UserFacingError(
        `Export exceeds the ${MAX_EXPORT_ROWS.toLocaleString("en-US")}-row limit for a single ${objectType} export.`,
      );
    }

    // Every export carries timestamp + account + constitution_version (PRD 19.3).
    const meta = {
      exported_at: now.toISOString(),
      account_id: params.accountId,
      constitution_version: constitutionVersion,
      object_type: objectType,
      row_count: rows.length,
    };

    let content: string;
    let contentType: string;
    if (format === "json") {
      content = JSON.stringify({ ...meta, rows }, null, 2);
      contentType = "application/json";
    } else {
      const header =
        `# exported_at=${meta.exported_at} account_id=${meta.account_id} ` +
        `constitution_version=${meta.constitution_version} object_type=${meta.object_type}\r\n`;
      content = header + toCsv(rows);
      contentType = "text/csv";
    }

    // Payload byte guard (P8). TextEncoder works on both Node and workerd.
    if (new TextEncoder().encode(content).length > MAX_EXPORT_BYTES) {
      throw new UserFacingError(
        `Export exceeds the ${Math.floor(MAX_EXPORT_BYTES / (1024 * 1024))} MB payload limit.`,
      );
    }

    // Filename derives ONLY from the allowlisted object type, the server
    // clock, and the allowlisted format — never from user input (P8).
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const fileName = `${objectType}-${stamp}.${format}`;
    // On Workers there is no writable filesystem: skip the archival copy and
    // return the payload response-only. Locally, keep writing under exports/,
    // with traversal guards on the account-derived directory (P8).
    let filePath = "";
    if (!isWorkerd() && SAFE_PATH_SEGMENT.test(params.accountId)) {
      const exportsRoot = path.resolve(process.cwd(), "exports");
      const dir = path.resolve(exportsRoot, params.accountId);
      const resolved = path.resolve(dir, fileName);
      // Containment check (defense in depth behind the segment regex): the
      // resolved file must stay under exports/<accountId>/.
      if (
        dir.startsWith(exportsRoot + path.sep) &&
        resolved.startsWith(dir + path.sep)
      ) {
        await mkdir(dir, { recursive: true });
        await writeFile(resolved, content, "utf8");
        filePath = resolved;
      }
    }

    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        resultPath: filePath || null,
        completedAt: now,
      },
    });

    await writeLedger({
      accountId: params.accountId,
      eventType: "export",
      userId: requestedBy,
      constitutionVersion,
      sourceDataUsed: { objectType, format, rowCount: rows.length },
      reasoningSummary: `Exported ${rows.length} ${objectType} rows as ${format.toUpperCase()} (hashed identifiers only).`,
      actionTaken: "export completed",
    });

    return {
      jobId: job.id,
      objectType,
      format,
      status: "completed",
      fileName,
      filePath,
      content,
      contentType,
      exportedAt: now.toISOString(),
      accountId: params.accountId,
      constitutionVersion,
      rowCount: rows.length,
    };
  } catch (error) {
    // Failure path (P8 "ExportJob logs failures" + P13): full detail to the
    // server log; job marked failed; ledger entry appended; user-safe rethrow.
    logServerError("export.exportState", error, {
      jobId: job.id,
      accountId: params.accountId,
      objectType,
      format,
    });
    const reason = toUserMessage(error, "unexpected error while building the export");
    try {
      await db.exportJob.update({
        where: { id: job.id },
        data: { status: "failed", completedAt: new Date() },
      });
    } catch (updateError) {
      logServerError("export.exportState.jobUpdate", updateError, { jobId: job.id });
    }
    try {
      await writeFailureEvent({
        accountId: params.accountId,
        operation: "export",
        reason,
        userId: requestedBy,
        sourceDataUsed: { jobId: job.id, objectType, format },
      });
    } catch (ledgerError) {
      logServerError("export.exportState.failureLedger", ledgerError, { jobId: job.id });
    }
    throw new UserFacingError(
      `Export failed: ${reason} (job ${job.id} recorded as failed).`,
      { cause: error },
    );
  }
}
