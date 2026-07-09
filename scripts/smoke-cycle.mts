/**
 * scripts/smoke-cycle.mts — direct-module-invocation half of the smoke test.
 *
 * Runs one full approve cycle against the demo database (PRD 25.1 alpha):
 *   recipe 1 (abandoned checkout recovery) -> draft -> governance pass ->
 *   holdout assigned (eligible audience >= 500) -> ledger entry with
 *   constitutionVersion -> holdout-verified performance readout with a range;
 *   recipe 3 (Meta seed + suppression) -> directional readout with NO PRD 15.4
 *   lift language; and one before/after-no-control case.
 *
 * Invoked by scripts/smoke.mjs via: node --import tsx scripts/smoke-cycle.mts
 * Prints PASS/FAIL per check; exits nonzero on any failure.
 */

import { db } from "../lib/db";
import { MEASUREMENT_LABELS } from "../lib/contracts";
import {
  ensureDemoAccount,
  getPerformance,
  getPerformanceExamples,
  listOpportunities,
} from "../lib/server";
import { approveAction, draftAction } from "../lib/server/actions";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// PRD 15.4 disallowed metrics/language for Meta (directional) reporting.
const PRD_15_4_DISALLOWED = [
  "lift",
  "incrementality",
  "recovered revenue",
  "causal roas",
  "verified impact",
  "holdout-verified result",
];
// The PRD 15.3 REQUIRED label is the one sanctioned occurrence of
// "holdout-verified lift" in directional copy — exempt it before scanning.
const META_REQUIRED_LABEL =
  "Directional reporting only. This is not holdout-verified lift.";

function forbiddenLiftLanguage(texts: string[]): string[] {
  const hits = new Set<string>();
  for (const text of texts) {
    const cleaned = text.split(META_REQUIRED_LABEL).join(" ").toLowerCase();
    for (const phrase of PRD_15_4_DISALLOWED) {
      if (cleaned.includes(phrase)) hits.add(phrase);
    }
  }
  return [...hits];
}

async function main(): Promise<void> {
  // --- trust-rule constants -------------------------------------------------
  const labels = Object.values(MEASUREMENT_LABELS);
  check(
    "contracts: exactly the three measurement labels",
    labels.length === 3 &&
      labels.includes("holdout-verified") &&
      labels.includes("before-after-no-control") &&
      labels.includes("directional"),
    `got: ${labels.join(", ")}`,
  );

  // --- feed -------------------------------------------------------------------
  const account = await ensureDemoAccount();
  const feed = await listOpportunities(account.accountId);

  check(
    "feed: three recipe cards render",
    feed.opportunities.length === 3,
    `got ${feed.opportunities.length} cards`,
  );
  check(
    "feed: found-money header shows (Medium/High recovery + win-back only)",
    feed.foundMoney.show &&
      feed.foundMoney.totalLow > 0 &&
      feed.foundMoney.totalHigh > feed.foundMoney.totalLow,
    JSON.stringify(feed.foundMoney),
  );
  check(
    "feed: Meta opportunity never counted in found-money header",
    !feed.foundMoney.includedRecipeIds.includes("meta_seed_suppression"),
    `included: ${feed.foundMoney.includedRecipeIds.join(", ")}`,
  );

  // --- recipe 1: draft -> approve -> holdout -> ledger -> readout -------------
  const recipe1 = feed.opportunities.find(
    (card) => card.recipeId === "abandoned_checkout_recovery",
  );
  check("recipe1: opportunity card present", Boolean(recipe1));
  if (!recipe1) throw new Error("cannot continue without recipe1 card");

  const draft = await draftAction({
    accountId: account.accountId,
    opportunityId: recipe1.id,
    userId: "smoke-test",
  });
  const draftedAction = await db.action.findUnique({
    where: { id: draft.actionId },
  });
  check(
    "recipe1: draft created and is NOT activation (status draft, 26A.4)",
    draftedAction?.status === "draft",
    `status=${draftedAction?.status}`,
  );

  const approved = await approveAction({
    accountId: account.accountId,
    actionId: draft.actionId,
    approver: "smoke-test",
  });
  check(
    "recipe1: governance verdict pass and action activated",
    approved.activated && approved.governance.verdict === "pass",
    JSON.stringify({
      verdict: approved.governance.verdict,
      reasons: approved.governance.reasons,
    }),
  );
  check(
    "recipe1: holdout assigned with eligible audience >= 500",
    approved.measurement?.mode === "holdout" &&
      Boolean(approved.measurement?.holdout) &&
      (approved.measurement?.holdout?.eligibleAudienceSize ?? 0) >= 500 &&
      (approved.measurement?.holdout?.holdoutSize ?? 0) > 0,
    JSON.stringify(approved.measurement?.holdout ?? null),
  );

  const ledgerEntry = await db.ledgerEntry.findFirst({
    where: { actionId: draft.actionId, eventType: "activation_success" },
  });
  check(
    "recipe1: activation ledger entry exists with constitutionVersion",
    ledgerEntry !== null && ledgerEntry.constitutionVersion !== null,
    `entry=${ledgerEntry?.id ?? "none"} constitutionVersion=${ledgerEntry?.constitutionVersion ?? "null"}`,
  );

  const perf1 = await getPerformance({
    accountId: account.accountId,
    actionId: draft.actionId,
  });
  const low = perf1.readout.metrics.incremental_revenue_low;
  const high = perf1.readout.metrics.incremental_revenue_high;
  check(
    "recipe1: performance readout labeled holdout-verified with a range",
    perf1.readout.label === "holdout-verified" &&
      typeof low === "number" &&
      typeof high === "number" &&
      low <= high,
    `label=${perf1.readout.label} range=${String(low)}..${String(high)}`,
  );

  // Seeded historical winback (PRD 20.4) — a fully-elapsed holdout window with
  // a real measured lift range (the fresh launch above has no post-launch events
  // yet, so its range is degenerate and lift is correctly "not proven").
  const historical = await db.action.findFirst({
    where: {
      accountId: account.accountId,
      type: "klaviyo_winback_flow",
      measurementMode: "holdout",
      NOT: { id: draft.actionId },
    },
    orderBy: { launchedAt: "asc" },
  });
  if (historical) {
    const perfHist = await getPerformance({
      accountId: account.accountId,
      actionId: historical.id,
    });
    check(
      "measured holdout readout: holdout-verified label + lift RANGE (never a point)",
      perfHist.readout.label === "holdout-verified" &&
        perfHist.readout.lift !== undefined &&
        perfHist.readout.lift.low < perfHist.readout.lift.high,
      JSON.stringify(perfHist.readout.lift ?? null),
    );
  } else {
    check("measured holdout readout: seeded historical winback action exists", false);
  }

  // --- recipe 3: Meta is ALWAYS directional, never lift language ---------------
  const recipe3 = feed.opportunities.find(
    (card) => card.recipeId === "meta_seed_suppression",
  );
  check("recipe3: opportunity card present", Boolean(recipe3));
  if (recipe3) {
    check(
      "recipe3: card measurement mode is directional",
      recipe3.measurementMode === "directional",
      `mode=${recipe3.measurementMode}`,
    );
    const draft3 = await draftAction({
      accountId: account.accountId,
      opportunityId: recipe3.id,
      userId: "smoke-test",
    });
    const approved3 = await approveAction({
      accountId: account.accountId,
      actionId: draft3.actionId,
      approver: "smoke-test",
      metaIdentifierRightsConfirmed: true, // 26A.8
    });
    check(
      "recipe3: approved and measurement stays directional",
      approved3.activated && approved3.measurement?.mode === "directional",
      JSON.stringify({
        activated: approved3.activated,
        mode: approved3.measurement?.mode,
      }),
    );
    const perf3 = await getPerformance({
      accountId: account.accountId,
      actionId: draft3.actionId,
    });
    const hits = forbiddenLiftLanguage([
      perf3.readout.summary,
      ...perf3.readout.caveats,
      ...Object.keys(perf3.readout.metrics).map((key) => key.replace(/_/g, " ")),
    ]);
    check(
      "recipe3: directional readout contains NO PRD 15.4 lift language",
      perf3.readout.label === "directional" &&
        perf3.readout.lift === undefined &&
        hits.length === 0,
      `label=${perf3.readout.label} hits=[${hits.join(", ")}]`,
    );
  }

  // --- before/after, no control group (PRD 14.6) -------------------------------
  const examples = await getPerformanceExamples();
  const beforeAfter = examples.beforeAfterNoControl;
  check(
    "before/after case: labeled before-after-no-control, no lift field, no-control caveat",
    beforeAfter.label === "before-after-no-control" &&
      beforeAfter.lift === undefined &&
      beforeAfter.caveats.some((caveat: string) =>
        caveat.toLowerCase().includes("no control"),
      ),
    JSON.stringify({ label: beforeAfter.label, caveats: beforeAfter.caveats }),
  );
}

main()
  .catch((err) => {
    console.error("FAIL  smoke-cycle crashed:", err);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exitCode = failures > 0 ? 1 : 0;
  });
