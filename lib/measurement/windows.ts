/**
 * lib/measurement/windows.ts — measurement windows (PRD 26A.2).
 *
 * Defaults (days from launch):
 *   abandoned checkout recovery: early 3 / primary 7 / long 14
 *   lapsed customer win-back:    early 7 / primary 21 / long 30
 *   Meta audience sync:          directional reads at 7 / 14 / 30
 *
 * EVERY readout carries its window — a performance summary without a stated
 * window must not render (26A.2).
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type {
  ContractReadType,
  MeasurementMode,
  RecipeId,
} from "../contracts";
import { DEFAULT_MEASUREMENT_WINDOWS } from "../contracts";
import type { Prisma } from "../contracts/models";
import { db as defaultDb } from "../db";

export interface ComputedWindow {
  readType: ContractReadType;
  days: number;
  start: string; // ISO
  end: string; // ISO
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Build the 26A.2 default windows for a recipe, anchored at launch time. Pure. */
export function buildMeasurementWindows(
  recipeId: RecipeId,
  launchedAt: Date,
): ComputedWindow[] {
  return DEFAULT_MEASUREMENT_WINDOWS[recipeId].map(({ readType, days }) => ({
    readType,
    days,
    start: launchedAt.toISOString(),
    end: new Date(launchedAt.getTime() + days * DAY_MS).toISOString(),
  }));
}

/** Pick one window (by read type) from the recipe defaults. */
export function getWindow(
  recipeId: RecipeId,
  launchedAt: Date,
  readType: ContractReadType,
): ComputedWindow {
  const window = buildMeasurementWindows(recipeId, launchedAt).find(
    (w) => w.readType === readType,
  );
  if (!window) {
    // Unreachable with DEFAULT_MEASUREMENT_WINDOWS (all three read types exist
    // for every recipe), but TypeScript cannot prove it.
    throw new Error(
      `No ${readType} measurement window defined for recipe ${recipeId}`,
    );
  }
  return window;
}

export interface PersistWindowsInput {
  accountId: string;
  actionId: string;
  recipeId: RecipeId;
  mode: MeasurementMode;
  launchedAt: Date;
  /** Attribution / lookback assumptions stored with each window (26A.9). */
  assumptions?: Prisma.InputJsonValue;
}

/**
 * Persist the three 26A.2 windows as MeasurementWindow rows at launch time.
 * Returns the computed windows (with row ids).
 */
export async function persistMeasurementWindows(
  input: PersistWindowsInput,
  client: typeof defaultDb = defaultDb,
): Promise<Array<ComputedWindow & { id: string }>> {
  const windows = buildMeasurementWindows(input.recipeId, input.launchedAt);
  const rows: Array<ComputedWindow & { id: string }> = [];
  for (const w of windows) {
    const row = await client.measurementWindow.create({
      data: {
        accountId: input.accountId,
        actionId: input.actionId,
        start: new Date(w.start),
        end: new Date(w.end),
        mode: input.mode,
        readType: w.readType,
        assumptions: input.assumptions ?? {
          attribution:
            "purchase events by audience members inside the window; refund-netted",
          identityJoin: "lowercase-email exact match (26B.12)",
        },
      },
    });
    rows.push({ ...w, id: row.id });
  }
  return rows;
}
