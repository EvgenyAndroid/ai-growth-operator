/**
 * lib/server/performance/read.ts — measurement readouts for launched actions
 * (PRD 14/15, 26A.1/26A.2) + the PRD 20.4 simulated demo examples.
 *
 * READ-ONLY and server-only (NOT "use server"): called by server components
 * via the lib/server barrel; never a client-invocable action endpoint
 * (hardening pass 2, item 2).
 *
 * getPerformance routes by the action's persisted measurementMode into the
 * lib/measurement builders — the ONLY three labels that exist. Holdout math
 * runs the real pipeline (arms -> outcomes -> lift range); Meta is directional
 * with PRD 15.2 whitelisted metrics only.
 */

import "server-only"; // build-time guard: must never enter a client bundle

import type {
  ContractReadType,
  MeasurementMode,
  MeasurementReadout,
  RecipeId,
} from "../../contracts";
import { HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS } from "../../contracts";
import db from "../../db";
import { writeLedger } from "../../ledger";
import { buildIdentifiedCoverage, getVerticalDefinition } from "../../verticals";
import {
  buildBeforeAfterReadout,
  buildDirectionalReadout,
  buildHoldoutReadout,
  checkContamination,
  computeArmOutcomes,
  computeLiftRange,
  loadHoldoutArms,
  simulatePerformanceExamples,
  type OutcomeEvent,
  type PerformanceExamples,
  type ReadoutWindow,
} from "../../measurement";
import { assertAccountAccess } from "../account-context";
import {
  accountClock,
  deterministicFraction,
  loadExistingFlowReachSources,
  parseAudienceCustomerIds,
  requireRecipeId,
} from "../shared";
import { getPerformanceSchema, parseInput } from "../validation";
import type { PerformanceView } from "../types";

const OUTCOME_EVENT_TYPES = ["purchase", "repeat_purchase", "refund"] as const;

async function loadOutcomeEvents(
  accountId: string,
  start: Date,
  end: Date,
): Promise<OutcomeEvent[]> {
  const rows = await db.event.findMany({
    where: {
      accountId,
      eventType: { in: [...OUTCOME_EVENT_TYPES] },
      eventTimestamp: { gte: start, lte: end },
      customerId: { not: null },
    },
    orderBy: [{ eventTimestamp: "asc" }, { id: "asc" }],
  });
  return rows
    .filter((row): row is typeof row & { customerId: string } => row.customerId !== null)
    .map((row) => ({
      customerId: row.customerId,
      eventType: row.eventType as OutcomeEvent["eventType"],
      eventTimestamp: row.eventTimestamp.toISOString(),
      value: row.value ?? undefined,
    }));
}

/**
 * Measurement readout for a launched action. `readType` picks a 26A.2 window;
 * default is the latest window that has fully elapsed, else the early read.
 */
export async function getPerformance(params: {
  accountId: string;
  actionId: string;
  readType?: ContractReadType;
}): Promise<PerformanceView> {
  params = parseInput(getPerformanceSchema, params, "getPerformance"); // P5
  const account = await assertAccountAccess(params.accountId); // P4 — account boundary
  const now = accountClock(account);

  const action = await db.action.findFirst({
    where: { id: params.actionId, accountId: params.accountId },
    include: {
      audience: true,
      opportunity: true,
      holdout: true,
      measurementWindows: { orderBy: { end: "asc" } },
    },
  });
  if (!action) throw new Error(`Action ${params.actionId} not found.`);
  if (!action.launchedAt || action.measurementWindows.length === 0) {
    throw new Error(
      "This action has not launched yet — there is no measurement window to read (26A.2).",
    );
  }
  const recipeId: RecipeId = action.opportunity
    ? requireRecipeId(action.opportunity.recipeId)
    : "abandoned_checkout_recovery";
  const mode = action.measurementMode as MeasurementMode;

  // --- pick the window (26A.2 — every summary states its window) -----------
  const windows = action.measurementWindows;
  const chosen =
    (params.readType &&
      windows.find((window) => window.readType === params.readType)) ||
    [...windows].reverse().find((window) => window.end.getTime() <= now.getTime()) ||
    windows[0];

  const readoutWindow: ReadoutWindow = {
    start: chosen.start.toISOString(),
    end: chosen.end.toISOString(),
    readType: chosen.readType as ContractReadType,
  };
  const windowInProgress = chosen.end.getTime() > now.getTime();
  const inProgressCaveat = windowInProgress
    ? [
        `The ${readoutWindow.readType} read window has not fully elapsed yet — figures are partial.`,
      ]
    : [];

  const audienceCustomerIds = parseAudienceCustomerIds(
    action.audience?.inclusionRules,
  );
  const audienceIdSet = new Set(audienceCustomerIds);
  const actionName = action.objective ?? action.type;

  let readout: MeasurementReadout;

  if (mode === "holdout" && action.holdoutId) {
    // --- holdout-verified: real arms -> outcomes -> lift range -------------
    const arms = await loadHoldoutArms(action.holdoutId);
    const events = await loadOutcomeEvents(
      params.accountId,
      chosen.start,
      chosen.end,
    );
    const outcomes = computeArmOutcomes(events, arms, {
      start: readoutWindow.start,
      end: readoutWindow.end,
    });

    const heldOutIds = [...arms.entries()]
      .filter(([, arm]) => arm === "held_out")
      .map(([customerId]) => customerId);
    const heldOutEmails = (
      await db.customer.findMany({
        where: { id: { in: heldOutIds } },
        select: { emailLower: true },
      })
    )
      .map((customer) => customer.emailLower)
      .filter((email): email is string => email !== null);
    const contamination = checkContamination({
      holdoutEmailsLower: heldOutEmails,
      sources: await loadExistingFlowReachSources(params.accountId),
    });

    // 26B.14 — flag cross-flow holdout interaction when other holdouts run.
    const concurrentHoldouts = await db.holdout.count({
      where: {
        accountId: params.accountId,
        status: "active",
        id: { not: action.holdoutId },
      },
    });
    const crossFlowCaveats =
      concurrentHoldouts > 0
        ? [
            `Cross-flow interaction possible: ${concurrentHoldouts} other holdout(s) are active for this account; customers may belong to multiple concurrent holdouts (26B.14).`,
          ]
        : [];

    const lift = computeLiftRange({
      treated: outcomes.treated,
      heldOut: outcomes.heldOut,
      contaminationRisk: contamination.risk,
      lowerConfidence: contamination.lowerConfidence,
      caveats: [...contamination.caveats, ...crossFlowCaveats],
    });

    readout = buildHoldoutReadout({
      actionId: action.id,
      window: readoutWindow,
      lift,
      contaminationRisk: contamination.risk,
      actionName,
      eligibleAudience: action.holdout?.eligibleAudienceSize ?? arms.size,
      holdoutSize: outcomes.heldOut.size,
      exposedSize: outcomes.treated.size,
      extraCaveats: inProgressCaveat,
    });
  } else if (mode === "before_after_no_control") {
    // --- before/after, no control group (PRD 14.6) --------------------------
    const windowMs = chosen.end.getTime() - chosen.start.getTime();
    const beforeStart = new Date(chosen.start.getTime() - windowMs);
    const summarize = (events: OutcomeEvent[], start: Date, end: Date) => {
      let purchases = 0;
      let revenue = 0;
      let refunds = 0;
      for (const event of events) {
        if (!audienceIdSet.has(event.customerId)) continue;
        if (event.eventType === "refund") refunds += Math.abs(event.value ?? 0);
        else {
          purchases += 1;
          revenue += event.value ?? 0;
        }
      }
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        purchases,
        revenue,
        refunds,
      };
    };
    const beforeEvents = await loadOutcomeEvents(
      params.accountId,
      beforeStart,
      chosen.start,
    );
    const afterEvents = await loadOutcomeEvents(
      params.accountId,
      chosen.start,
      chosen.end,
    );

    const activationDowngraded =
      action.activationLevel !== null &&
      (HOLDOUT_INELIGIBLE_ACTIVATION_LEVELS as string[]).includes(
        action.activationLevel,
      );
    const whyNoControl = activationDowngraded
      ? `Activation level "${action.activationLevel}" cannot enforce holdout exclusion in the activation path, so the holdout claim was downgraded (26A.1).`
      : audienceCustomerIds.length < 500
        ? `Eligible audience of ${audienceCustomerIds.length} is below the 500 minimum for a holdout (PRD 14.2/14.6).`
        : "No enforceable holdout was available for this launch.";

    readout = buildBeforeAfterReadout({
      actionId: action.id,
      window: readoutWindow,
      before: summarize(beforeEvents, beforeStart, chosen.start),
      after: summarize(afterEvents, chosen.start, chosen.end),
      actionName,
      whyNoControl,
      extraCaveats: inProgressCaveat,
    });
  } else if (mode === "holdout") {
    // Fail closed: a holdout-mode action without a persisted holdout is an
    // inconsistent state — never fall through to another label (PRD 4.6).
    throw new Error(
      `Action ${action.id} is marked holdout-verified but has no persisted holdout — refusing to render a readout under a different label (PRD 14.1/4.6).`,
    );
  } else {
    // --- directional (Meta) — PRD 15.2 metrics ONLY -------------------------
    const afterEvents = await loadOutcomeEvents(
      params.accountId,
      chosen.start,
      chosen.end,
    );
    let downstreamPurchases = 0;
    for (const event of afterEvents) {
      if (event.eventType !== "refund" && audienceIdSet.has(event.customerId)) {
        downstreamPurchases += 1;
      }
    }
    // Deterministic simulated match rate (Alpha mocked connector, PRD 25.1).
    const matchRate = deterministicFraction(`match:${action.id}`, 0.6, 0.85);

    readout = buildDirectionalReadout({
      actionId: action.id,
      window: readoutWindow,
      metrics: {
        audience_created: "yes (simulated)",
        audience_size: audienceCustomerIds.length,
        match_rate: `${(matchRate * 100).toFixed(1)}%`,
        sync_status: "accepted (simulated)",
        last_synced: action.launchedAt.toISOString(),
        downstream_purchases: downstreamPurchases,
      },
      actionName,
      summary: `${actionName}: audience of ${audienceCustomerIds.length} synced to Meta (simulated) with a ${(matchRate * 100).toFixed(1)}% match rate. ${downstreamPurchases} downstream purchases were observed from synced customers in this ${readoutWindow.readType} window — observational only, not a causal claim.`,
      extraCaveats: inProgressCaveat,
    });
  }

  // LOCAL trust rule #9 — every LOCAL readout states the identified-transaction
  // share (estimates cover identified/loyalty-matched customers only). Routed
  // via the vertical registry (trust rule #10 — no hardcoded vertical checks);
  // DTC readouts are byte-identical to before. The disclosure note contains no
  // META_DISALLOWED_TERMS, so it is safe on directional readouts too.
  if (getVerticalDefinition(account.vertical).requiresCoverageDisclosure) {
    const posPurchaseWhere = {
      accountId: params.accountId,
      eventType: { in: ["purchase", "repeat_purchase"] },
    };
    const [totalPos, identifiedPos] = await Promise.all([
      db.event.count({ where: posPurchaseWhere }),
      db.event.count({
        where: { ...posPurchaseWhere, customerId: { not: null } },
      }),
    ]);
    const coverage = buildIdentifiedCoverage(
      totalPos > 0 ? identifiedPos / totalPos : 0,
    );
    readout = { ...readout, caveats: [...readout.caveats, coverage.note] };
  }

  await writeLedger({
    accountId: params.accountId,
    eventType: "measurement_readback",
    actionId: action.id,
    opportunityId: action.opportunityId ?? undefined,
    constitutionVersion: action.constitutionVersion,
    reasoningSummary: readout.summary,
    confidence: readout.confidence,
    measuredOutcome: { metrics: readout.metrics, caveats: readout.caveats },
    measurementMode: mode,
    actionTaken: `performance read (${readoutWindow.readType} window)`,
  });

  return {
    actionId: action.id,
    actionType: action.type,
    recipeId,
    launchedAt: action.launchedAt.toISOString(),
    readout,
    windows: windows.map((window) => ({
      readType: window.readType as ContractReadType,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      mode: window.mode as MeasurementMode,
      used: window.id === chosen.id,
      inProgress: window.end.getTime() > now.getTime(),
    })),
  };
}

/**
 * PRD 20.4 — the three deterministic demo readouts (one holdout-verified, one
 * before/after-no-control, one directional Meta). Safe to call on any render.
 */
export async function getPerformanceExamples(): Promise<PerformanceExamples> {
  return simulatePerformanceExamples();
}
