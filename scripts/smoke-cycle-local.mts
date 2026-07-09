/**
 * scripts/smoke-cycle-local.mts — LOCAL vertical pack half of the smoke test
 * (café/bakery on Square-like POS + Mailchimp-like email + GBP; PRD 25.1
 * demo-mode, trust rules #9/#10).
 *
 * Checks, via direct module invocation against the seeded LOCAL demo account:
 *   - onboard-as-local path: ensureDemoAccount({ vertical: "local_service" })
 *     resolves the Cardamom & Rye workspace with the LOCAL connector set;
 *   - feed: three LOCAL cards (lapsed-regular, catering, shared Meta seed),
 *     every card + the feed header carry the POS coverage disclosure;
 *   - found-money: catering_upsell and Meta are NEVER counted;
 *     local_lapsed_regular follows the standard Medium+ gate;
 *   - lapsed-regular approve cycle: audience < 500 so measurement mode is
 *     before_after_no_control and NO holdout row is created;
 *   - readout: labeled before-after-no-control, no lift field, states the
 *     identified-transaction share (trust rule #9);
 *   - Meta stays directional with no PRD 15.4 lift language.
 *
 * Invoked by scripts/smoke.mjs via: node --import tsx scripts/smoke-cycle-local.mts
 * Prints PASS/FAIL per check; exits nonzero on any failure.
 */

import { db } from "../lib/db";
import { isFoundMoneyEligible } from "../lib/contracts";
import {
  ensureDemoAccount,
  getPerformance,
  listOpportunities,
} from "../lib/server";
import { approveAction, draftAction } from "../lib/server/actions";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(
    `${ok ? "PASS" : "FAIL"}  LOCAL ${name}${!ok && detail ? ` — ${detail}` : ""}`,
  );
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
  // --- onboard-as-local path (trust rule #10: vertical routes everything) ----
  const account = await ensureDemoAccount({ vertical: "local_service" });
  check(
    "onboarding: local_service demo workspace resolves",
    account.vertical === "local_service" && account.demoMode,
    JSON.stringify({ vertical: account.vertical, name: account.accountName }),
  );
  const integrations = await db.integration.findMany({
    where: { accountId: account.accountId },
    select: { source: true },
  });
  const sources = integrations.map((i) => i.source).sort();
  check(
    "onboarding: LOCAL connector set provisioned (square/mailchimp/gbp/meta)",
    ["gbp", "mailchimp", "meta", "square"].every((s) => sources.includes(s)),
    `sources: ${sources.join(", ")}`,
  );

  // --- feed: three LOCAL cards, coverage disclosure everywhere ---------------
  const feed = await listOpportunities(account.accountId);
  check(
    "feed: vertical is local_service",
    feed.vertical === "local_service",
    `vertical=${feed.vertical}`,
  );
  const recipeIds = feed.opportunities.map((card) => card.recipeId).sort();
  check(
    "feed: lapsed-regular + catering + shared Meta cards render",
    recipeIds.length === 3 &&
      recipeIds.includes("local_lapsed_regular") &&
      recipeIds.includes("catering_upsell") &&
      recipeIds.includes("meta_seed_suppression"),
    `cards: ${recipeIds.join(", ")}`,
  );
  check(
    "feed: every LOCAL card carries the POS coverage disclosure (trust rule #9)",
    feed.opportunities.length > 0 &&
      feed.opportunities.every(
        (card) =>
          card.coverage !== null &&
          card.coverage.identifiedShare > 0 &&
          card.coverage.identifiedShare <= 1 &&
          card.coverage.note.includes("identified"),
      ),
    feed.opportunities
      .map((card) => `${card.recipeId}:${card.coverage ? "yes" : "MISSING"}`)
      .join(", "),
  );
  check(
    "feed: account-level coverage disclosure present on the header",
    feed.coverage !== null &&
      feed.coverage.note.includes("POS transactions"),
    JSON.stringify(feed.coverage),
  );
  check(
    "feed: estimates are ranges (never points, PRD 16.4)",
    feed.opportunities.every(
      (card) => card.estimate === null || card.estimate.low <= card.estimate.high,
    ),
  );

  // --- found-money: catering + Meta never counted; lapsed follows the gate ---
  check(
    "found-money: catering_upsell and Meta never counted",
    !feed.foundMoney.includedRecipeIds.includes("catering_upsell") &&
      !feed.foundMoney.includedRecipeIds.includes("meta_seed_suppression"),
    `included: ${feed.foundMoney.includedRecipeIds.join(", ")}`,
  );
  check(
    "found-money: catering_upsell ineligible even at High confidence",
    !isFoundMoneyEligible({
      recipeId: "catering_upsell",
      confidence: "high",
      estimateLabel: "modeled",
    }),
  );
  check(
    "found-money: local_lapsed_regular follows the standard Medium+ gate",
    isFoundMoneyEligible({
      recipeId: "local_lapsed_regular",
      confidence: "medium",
      estimateLabel: "modeled",
    }) &&
      !isFoundMoneyEligible({
        recipeId: "local_lapsed_regular",
        confidence: "low",
        estimateLabel: "modeled",
      }),
  );

  // --- lapsed-regular approve cycle: before/after, NO holdout ----------------
  const lapsed = feed.opportunities.find(
    (card) => card.recipeId === "local_lapsed_regular",
  );
  check("lapsed-regular: opportunity card present", Boolean(lapsed));
  if (!lapsed) throw new Error("cannot continue without the lapsed-regular card");

  const draft = await draftAction({
    accountId: account.accountId,
    opportunityId: lapsed.id,
    userId: "smoke-test-local",
  });
  const draftedAction = await db.action.findUnique({
    where: { id: draft.actionId },
  });
  check(
    "lapsed-regular: draft is NOT activation (status draft, 26A.4)",
    draftedAction?.status === "draft",
    `status=${draftedAction?.status}`,
  );

  const approved = await approveAction({
    accountId: account.accountId,
    actionId: draft.actionId,
    approver: "smoke-test-local",
  });
  check(
    "lapsed-regular: governance pass and action activated",
    approved.activated && approved.governance.verdict === "pass",
    JSON.stringify({
      verdict: approved.governance.verdict,
      reasons: approved.governance.reasons,
    }),
  );
  check(
    "lapsed-regular: measurement mode is before_after_no_control",
    approved.measurement?.mode === "before_after_no_control",
    `mode=${approved.measurement?.mode}`,
  );

  const audienceRow = draftedAction?.audienceId
    ? await db.audience.findUnique({ where: { id: draftedAction.audienceId } })
    : null;
  check(
    "lapsed-regular: audience engineered below the 500 holdout floor",
    audienceRow !== null && audienceRow.size > 0 && audienceRow.size < 500,
    `audience size=${audienceRow?.size ?? "unknown"}`,
  );

  const actionAfter = await db.action.findUnique({
    where: { id: draft.actionId },
  });
  const holdoutLedger = await db.ledgerEntry.count({
    where: { actionId: draft.actionId, eventType: "holdout_assignment" },
  });
  check(
    "lapsed-regular: NO holdout created (no row, no assignment ledger entry)",
    approved.measurement?.holdout === null &&
      actionAfter?.holdoutId === null &&
      holdoutLedger === 0,
    JSON.stringify({
      holdout: approved.measurement?.holdout ?? "undefined",
      holdoutId: actionAfter?.holdoutId ?? null,
      holdoutLedger,
    }),
  );

  const perf = await getPerformance({
    accountId: account.accountId,
    actionId: draft.actionId,
  });
  check(
    "lapsed-regular: readout labeled before-after-no-control with no lift field",
    perf.readout.label === "before-after-no-control" &&
      perf.readout.lift === undefined &&
      perf.readout.caveats.some((c) => c.toLowerCase().includes("no control")),
    `label=${perf.readout.label}`,
  );
  check(
    "lapsed-regular: readout states the identified-transaction share (trust rule #9)",
    perf.readout.caveats.some(
      (c) => c.includes("identified") && c.includes("POS transactions"),
    ),
    `caveats=${JSON.stringify(perf.readout.caveats)}`,
  );

  // --- Meta stays directional --------------------------------------------------
  const meta = feed.opportunities.find(
    (card) => card.recipeId === "meta_seed_suppression",
  );
  check("meta: opportunity card present", Boolean(meta));
  if (meta) {
    check(
      "meta: card measurement mode is directional (ALWAYS)",
      meta.measurementMode === "directional",
      `mode=${meta.measurementMode}`,
    );
    check(
      "meta: card carries the coverage disclosure too (trust rule #9)",
      meta.coverage !== null,
    );
    const hits = forbiddenLiftLanguage([
      meta.explanation.measurementPlan.summary,
      ...meta.explanation.measurementPlan.caveats,
      ...(meta.coverage ? [meta.coverage.note] : []),
    ]);
    check(
      "meta: no PRD 15.4 lift language in plan or disclosure",
      hits.length === 0,
      `hits=[${hits.join(", ")}]`,
    );
  }
}

main()
  .catch((err) => {
    console.error("FAIL  LOCAL smoke-cycle crashed:", err);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exitCode = failures > 0 ? 1 : 0;
  });
