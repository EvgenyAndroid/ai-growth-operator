#!/usr/bin/env node
/**
 * scripts/smoke.mjs — end-to-end smoke test for the MVP v0 alpha (PRD 25.1).
 *
 * What it does, in order:
 *   1. Reseeds the deterministic demo dataset (fresh baseline every run).
 *   2. Ensures a production build exists (`next build` if .next is missing),
 *      then boots `next start` on a free port.
 *   3. Fetches `/` (demo banner) and `/feed` (found-money header + the three
 *      recipe cards) over HTTP.
 *   4. Runs one full approve cycle via direct module invocation
 *      (node --import tsx scripts/smoke-cycle.mts): recipe1 draft ->
 *      governance pass -> holdout (audience >= 500) -> ledger entry with
 *      constitutionVersion -> holdout-verified readout with a range;
 *      recipe3 directional readout with no PRD 15.4 lift language; and one
 *      before/after-no-control case.
 *   5. LOCAL vertical pack section: onboard-as-local exists on /setup; the
 *      local feed (vertical cookie) renders the POS coverage disclosure +
 *      lapsed-regular + catering + Meta cards; then the LOCAL approve cycle
 *      (node --import tsx scripts/smoke-cycle-local.mts): lapsed-regular
 *      approve yields before_after_no_control with NO holdout (audience
 *      engineered < 500), catering + Meta never counted as found money, and
 *      Meta stays directional. DTC checks above run first — unchanged — as
 *      the regression gate.
 *
 * Prints PASS/FAIL per check and exits nonzero on any failure.
 * Run with: node scripts/smoke.mjs
 * (npm run smoke runs scripts/smoke.ts — the fast in-process contract checks.)
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function runSync(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
  });
  return result.status === 0;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // --- 1. deterministic baseline: reseed the demo dataset --------------------
  const seeded = runSync(["--import", "tsx", "prisma/seed.ts"], "seed");
  check("setup: demo dataset seeded", seeded);
  if (!seeded) return;

  // --- 2. production build + next start --------------------------------------
  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    console.log("[smoke] no production build found — running next build...");
    const built = runSync([NEXT_BIN, "build"], "build");
    check("setup: next build", built);
    if (!built) return;
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  try {
    const up = await waitForServer(`${base}/`);
    check("server: next start responds", up, serverLog.slice(-500));
    if (!up) return;

    // --- 3. HTTP checks -------------------------------------------------------
    const home = await fetch(`${base}/`);
    const homeHtml = await home.text();
    check(
      "GET /: demo banner renders (PRD 20.3)",
      home.status === 200 && homeHtml.includes("Demo workspace"),
      `status=${home.status}`,
    );

    const feed = await fetch(`${base}/feed`);
    const feedHtml = await feed.text();
    check(
      "GET /feed: found-money header renders (PRD 16.2)",
      feed.status === 200 && feedHtml.includes("Found money"),
      `status=${feed.status}`,
    );
    const cardTitles = [
      ["abandoned checkout recovery", "Recover abandoned checkouts"],
      ["lapsed win-back", "Win back lapsed customers"],
      ["Meta seed + suppression", "suppress recent purchasers"],
    ];
    for (const [recipe, marker] of cardTitles) {
      check(
        `GET /feed: ${recipe} card renders`,
        feedHtml.includes(marker),
        `marker "${marker}" not found`,
      );
    }
    check(
      "GET /feed: all three measurement labels present on cards (PRD 4.6)",
      feedHtml.includes("Holdout-verified") && feedHtml.includes("Directional"),
    );

    // --- 4. approve cycle via direct module invocation -------------------------
    console.log("[smoke] running approve cycle (node --import tsx scripts/smoke-cycle.mts)...");
    const cycleOk = runSync(["--import", "tsx", "scripts/smoke-cycle.mts"], "cycle");
    check("approve cycle: all module checks passed (DTC regression)", cycleOk);

    // --- 5. LOCAL vertical pack (trust rules #9/#10) ----------------------------
    // Onboard-as-local path exists: the Business Setup screen offers the LOCAL
    // launch profile (selection sets the vertical cookie server-side).
    const setup = await fetch(`${base}/setup`);
    const setupHtml = await setup.text();
    check(
      "LOCAL GET /setup: onboard-as-local path exists (Business Setup profile)",
      setup.status === 200 &&
        setupHtml.includes("Local service (café / bakery / studio)"),
      `status=${setup.status}`,
    );

    // The feed routes by the vertical cookie (trust rule #10).
    const localFeed = await fetch(`${base}/feed`, {
      headers: { cookie: "ago_vertical=local_service" },
    });
    const localHtml = await localFeed.text();
    check(
      "LOCAL GET /feed: responds for the local_service vertical",
      localFeed.status === 200,
      `status=${localFeed.status}`,
    );
    check(
      "LOCAL GET /feed: POS coverage disclosure renders (trust rule #9)",
      localHtml.includes("of POS transactions are identified"),
    );
    check(
      "GET /feed: DTC feed does NOT show the POS coverage disclosure",
      !feedHtml.includes("of POS transactions are identified"),
    );
    const localCards = [
      ["lapsed-regular win-back", "Win back lapsed regulars"],
      ["catering upsell", "Pitch catering to repeat large-order customers"],
      ["Meta seed + suppression", "suppress recent purchasers"],
    ];
    for (const [recipe, marker] of localCards) {
      check(
        `LOCAL GET /feed: ${recipe} card renders`,
        localHtml.includes(marker),
        `marker "${marker}" not found`,
      );
    }
    check(
      "LOCAL GET /feed: Meta card stays Directional",
      localHtml.includes("Directional"),
    );
    check(
      "LOCAL GET /feed: DTC feed unchanged by vertical routing (regression)",
      feedHtml.includes("Recover abandoned checkouts") &&
        !feedHtml.includes("Win back lapsed regulars") &&
        !localHtml.includes("Recover abandoned checkouts"),
    );

    // LOCAL approve cycle: before/after (audience < 500, NO holdout), catering
    // and Meta never found-money, Meta directional.
    console.log(
      "[smoke] running LOCAL approve cycle (node --import tsx scripts/smoke-cycle-local.mts)...",
    );
    const localCycleOk = runSync(
      ["--import", "tsx", "scripts/smoke-cycle-local.mts"],
      "local-cycle",
    );
    check("LOCAL approve cycle: all module checks passed", localCycleOk);
  } finally {
    server.kill();
  }
}

main()
  .catch((err) => {
    console.error("FAIL  smoke crashed:", err);
    failures += 1;
  })
  .finally(() => {
    console.log(
      failures > 0
        ? `[smoke] ${failures} top-level check(s) failed`
        : "[smoke] all checks passed",
    );
    process.exitCode = failures > 0 ? 1 : 0;
    // next start keeps the event loop alive on some platforms even after kill()
    setTimeout(() => process.exit(process.exitCode ?? 0), 1_000).unref();
  });
