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
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import db from "../db";
import { writeLedger } from "../ledger";
import { latestConstitution, requireAccount } from "./shared";
import type { ExportFormat, ExportObjectType, ExportStateResult } from "./types";

type Row = Record<string, string | number | boolean | null>;

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

/**
 * Export one object type to CSV or JSON (PRD 19.2). Writes the file under
 * exports/<accountId>/ and returns the payload for direct download.
 */
export async function exportState(params: {
  accountId: string;
  objectType: ExportObjectType;
  format?: ExportFormat;
  requestedBy?: string;
}): Promise<ExportStateResult> {
  await requireAccount(params.accountId);
  if (!EXPORT_OBJECT_TYPES.includes(params.objectType)) {
    throw new Error(
      `Unsupported export object type "${params.objectType}". Supported: ${EXPORT_OBJECT_TYPES.join(", ")}.`,
    );
  }
  const format: ExportFormat = params.format ?? "csv";
  const now = new Date();
  const constitution = await latestConstitution(params.accountId);
  const constitutionVersion = constitution?.version ?? 0;

  const job = await db.exportJob.create({
    data: {
      accountId: params.accountId,
      objectType: params.objectType,
      requestedBy: params.requestedBy,
      format,
      status: "running",
    },
  });

  const rows = await collectRows(params.accountId, params.objectType);

  // Every export carries timestamp + account + constitution_version (PRD 19.3).
  const meta = {
    exported_at: now.toISOString(),
    account_id: params.accountId,
    constitution_version: constitutionVersion,
    object_type: params.objectType,
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

  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `${params.objectType}-${stamp}.${format}`;
  // On Workers there is no writable filesystem: skip the archival copy and
  // return the payload response-only. Locally, keep writing under exports/.
  let filePath = "";
  if (!isWorkerd()) {
    const dir = path.join(process.cwd(), "exports", params.accountId);
    filePath = path.join(dir, fileName);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, "utf8");
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
    userId: params.requestedBy,
    constitutionVersion,
    sourceDataUsed: { objectType: params.objectType, format, rowCount: rows.length },
    reasoningSummary: `Exported ${rows.length} ${params.objectType} rows as ${format.toUpperCase()} (hashed identifiers only).`,
    actionTaken: "export completed",
  });

  return {
    jobId: job.id,
    objectType: params.objectType,
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
}
