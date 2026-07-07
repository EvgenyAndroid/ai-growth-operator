"use client";

/**
 * Export panel (client) — buttons per PRD 19.1 object type, CSV/JSON choice,
 * job status per row, and browser download of the returned payload.
 *
 * Imports only types plus the exportState server action — no runtime imports
 * of lib/contracts (client-bundle safety).
 */

import * as React from "react";
import { useState, useTransition } from "react";
import { exportState } from "@/lib/server/export";
import type {
  ExportFormat,
  ExportObjectType,
  ExportStateResult,
} from "@/lib/server/types";
import { fmtDateTime } from "../performance/readout-card";

const OBJECT_TYPES: Array<{
  objectType: ExportObjectType;
  label: string;
  description: string;
}> = [
  {
    objectType: "customers",
    label: "Customer context",
    description:
      "Lifecycle stage, consent, order aggregates. Identifiers are hashed — raw emails never leave the system.",
  },
  {
    objectType: "audiences",
    label: "Audiences",
    description: "Every audience the Operator built, with inclusion/exclusion rules and sizes.",
  },
  {
    objectType: "operating_rules",
    label: "Operating Rules",
    description: "All Operating Rules (constitution) versions: caps, discount ceiling, banned claims, tone.",
  },
  {
    objectType: "preferences",
    label: "Learned preferences",
    description: "Merchant preferences learned from rejections and edits (offer stance, tone corrections — 26B.18).",
  },
  {
    objectType: "opportunities",
    label: "Opportunity history",
    description: "Every opportunity with recipe version, confidence, estimate range, and lifecycle state.",
  },
  {
    objectType: "actions",
    label: "Campaign / action history",
    description: "Drafted and activated actions with activation level, measurement mode, and Operating Rules version.",
  },
  {
    objectType: "measurements",
    label: "Measurement summaries",
    description: "Readouts per action and window, labeled holdout-verified, before/after-no-control, or directional.",
  },
];

type RowState =
  | { status: "idle" }
  | { status: "running"; format: ExportFormat }
  | { status: "done"; job: ExportStateResult }
  | { status: "error"; message: string };

function downloadJob(job: ExportStateResult): void {
  const blob = new Blob([job.content], { type: job.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = job.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<Record<ExportObjectType, RowState>>(() => {
    const initial = {} as Record<ExportObjectType, RowState>;
    for (const row of OBJECT_TYPES) initial[row.objectType] = { status: "idle" };
    return initial;
  });
  const [, startTransition] = useTransition();

  function runExport(objectType: ExportObjectType, format: ExportFormat): void {
    setRows((previous) => ({ ...previous, [objectType]: { status: "running", format } }));
    startTransition(async () => {
      try {
        const job = await exportState({ accountId, objectType, format });
        setRows((previous) => ({ ...previous, [objectType]: { status: "done", job } }));
        downloadJob(job);
      } catch (error) {
        setRows((previous) => ({
          ...previous,
          [objectType]: {
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    });
  }

  return (
    <ul className="space-y-3">
      {OBJECT_TYPES.map(({ objectType, label, description }) => {
        const state = rows[objectType];
        return (
          <li
            key={objectType}
            className="rounded-card border border-border bg-surface p-5 shadow-card transition-shadow duration-150 hover:shadow-card-hover"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold tracking-tight text-ink">{label}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={state.status === "running"}
                  onClick={() => runExport(objectType, "csv")}
                  className="inline-flex items-center rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors duration-150 hover:bg-surface-soft disabled:pointer-events-none disabled:opacity-50"
                >
                  {state.status === "running" && state.format === "csv"
                    ? "Exporting…"
                    : "Export CSV"}
                </button>
                <button
                  type="button"
                  disabled={state.status === "running"}
                  onClick={() => runExport(objectType, "json")}
                  className="inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                >
                  {state.status === "running" && state.format === "json"
                    ? "Exporting…"
                    : "Export JSON"}
                </button>
              </div>
            </div>
            <ExportStatus state={state} onRedownload={downloadJob} />
          </li>
        );
      })}
    </ul>
  );
}

function ExportStatus({
  state,
  onRedownload,
}: {
  state: RowState;
  onRedownload: (job: ExportStateResult) => void;
}) {
  if (state.status === "idle") return null;
  if (state.status === "running") {
    return <p className="mt-3 text-sm text-ink-muted">Export job running…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="mt-3 rounded-md border border-red-200 bg-danger-soft/60 px-3 py-2 text-sm text-red-800">
        Export failed: {state.message}
      </p>
    );
  }
  const { job } = state;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-emerald-200 bg-success-soft/60 px-3 py-2 text-sm text-emerald-900">
      <span>
        <strong>Completed</strong> — {job.fileName} ({job.format.toUpperCase()},{" "}
        {job.rowCount.toLocaleString("en-US")} rows)
      </span>
      <span className="text-xs text-emerald-800">
        {fmtDateTime(job.exportedAt)} · Operating Rules v{job.constitutionVersion} · job{" "}
        <span className="font-mono">{job.jobId.slice(0, 10)}…</span>
      </span>
      <button
        type="button"
        onClick={() => onRedownload(job)}
        className="rounded-sm text-xs font-medium underline underline-offset-2 transition-colors duration-150 hover:text-emerald-950"
      >
        Download again
      </button>
    </div>
  );
}
