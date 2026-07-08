/**
 * tests/export-privacy.test.ts — P9/P8 export privacy tests (node:test).
 *
 * Runs exportState() against a THROWAWAY demo account (created in before(),
 * cascade-deleted in after(); its exports/ directory is removed too) so the
 * seeded demo workspaces stay pristine.
 *
 * Brief coverage (P8): emailLower / raw email NEVER exports (hashed identifier
 * only); audience exports never leak member customer ids; object-type and
 * format allowlists reject at entry with NO ExportJob row; filenames are never
 * user-controlled; every export carries timestamp + account + constitution
 * version.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";

import { db } from "../lib/db";
import { exportState } from "../lib/server/export";
import { AS_OF } from "./helpers";

const RAW_EMAIL = "leaky.customer@example.com";
const EMAIL_HASH = "hash_export_privacy_1";

let accountId = "";
let memberCustomerId = "";

before(async () => {
  const account = await db.account.create({
    data: {
      name: "P9 Export Privacy Test Workspace",
      vertical: "shopify_dtc",
      demoMode: true,
    },
  });
  accountId = account.id;

  await db.constitution.create({
    data: {
      accountId,
      templateVertical: "shopify_dtc",
      version: 3,
      monthlyBudgetCap: 500,
      maxDiscountPercent: 15,
      dailySendCap: 400,
      effectiveFrom: AS_OF,
    },
  });

  const customer = await db.customer.create({
    data: {
      accountId,
      sourceCustomerIds: { shopify: "shp_export_1" },
      emailHash: EMAIL_HASH,
      emailLower: RAW_EMAIL,
      consentEmail: true,
      consentAds: true,
      totalOrders: 3,
      totalRevenue: 120,
    },
  });
  memberCustomerId = customer.id;

  await db.audience.create({
    data: {
      accountId,
      name: "Privacy test audience",
      creationMethod: "recipe",
      inclusionRules: { customerIds: [memberCustomerId], someRule: true },
      exclusionRules: { suppressed: 0 },
      size: 1,
      eligibleChannels: ["klaviyo_email"],
    },
  });
});

after(async () => {
  if (accountId) {
    await rm(path.resolve(process.cwd(), "exports", accountId), {
      recursive: true,
      force: true,
    });
    await db.account.delete({ where: { id: accountId } });
  }
  await db.$disconnect();
});

test("export privacy: customers export carries the HASH and never the raw email or emailLower", async () => {
  const result = await exportState({ accountId, objectType: "customers" });
  assert.equal(result.status, "completed");
  assert.ok(result.content.includes(EMAIL_HASH), "hashed identifier must export");
  assert.ok(!result.content.includes(RAW_EMAIL), "raw email must NEVER export");
  assert.ok(!result.content.includes("emailLower"), "emailLower column must not exist");
  assert.ok(!result.content.includes("email_lower"), "email_lower column must not exist");

  // PRD 19.3 stamp: timestamp + account + constitution_version on every export.
  assert.ok(result.content.includes(`account_id=${accountId}`));
  assert.ok(result.content.includes("constitution_version=3"));
  assert.equal(result.constitutionVersion, 3);
});

test("export privacy: JSON customers export is equally clean", async () => {
  const result = await exportState({ accountId, objectType: "customers", format: "json" });
  const parsed = JSON.parse(result.content) as {
    account_id: string;
    constitution_version: number;
    rows: Array<Record<string, unknown>>;
  };
  assert.equal(parsed.account_id, accountId);
  assert.equal(parsed.constitution_version, 3);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].email_hash, EMAIL_HASH);
  assert.ok(!("emailLower" in parsed.rows[0]));
  assert.ok(!result.content.includes(RAW_EMAIL));
});

test("export privacy: audience export never leaks member customer ids", async () => {
  const result = await exportState({ accountId, objectType: "audiences", format: "json" });
  assert.equal(result.status, "completed");
  assert.ok(
    !result.content.includes(memberCustomerId),
    "audience member customer ids are internal working state and must not export",
  );
  assert.ok(!result.content.includes("customerIds"));
  assert.ok(!result.content.includes(RAW_EMAIL));
});

test("export privacy: filename derives from the allowlist + server clock, never user input", async () => {
  const result = await exportState({
    accountId,
    objectType: "customers",
    requestedBy: "../../evil-path\\name",
  });
  assert.match(
    result.fileName,
    /^customers-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(-\d+)?Z\.csv$/,
    `unexpected filename shape: ${result.fileName}`,
  );
  assert.ok(!result.fileName.includes("evil"));
  // The archival copy (when written) must stay under exports/<accountId>/.
  if (result.filePath) {
    const exportsRoot = path.resolve(process.cwd(), "exports", accountId);
    assert.ok(result.filePath.startsWith(exportsRoot + path.sep));
  }
});

test("export privacy: traversal-shaped objectType is rejected at entry with NO ExportJob row", async () => {
  const jobsBefore = await db.exportJob.count({ where: { accountId } });
  await assert.rejects(
    () =>
      exportState({
        accountId,
        objectType: "../../etc/passwd" as never,
      }),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      assert.ok(!message.includes("etc/passwd"), "error must not echo the payload");
      assert.ok(!/\n\s+at /.test(message), "error must not carry a stack trace");
      return true;
    },
  );
  const jobsAfter = await db.exportJob.count({ where: { accountId } });
  assert.equal(jobsAfter, jobsBefore, "rejected export must not create a job row");
});

test("export privacy: unknown format is rejected at entry with NO ExportJob row", async () => {
  const jobsBefore = await db.exportJob.count({ where: { accountId } });
  await assert.rejects(() =>
    exportState({
      accountId,
      objectType: "customers",
      format: "xml" as never,
    }),
  );
  const jobsAfter = await db.exportJob.count({ where: { accountId } });
  assert.equal(jobsAfter, jobsBefore);
});

test("export privacy: completed jobs are recorded on the ExportJob table and in the ledger", async () => {
  const result = await exportState({ accountId, objectType: "operating_rules" });
  const job = await db.exportJob.findUnique({ where: { id: result.jobId } });
  assert.ok(job);
  assert.equal(job.status, "completed");
  assert.equal(job.objectType, "operating_rules");
  const ledgered = await db.ledgerEntry.findFirst({
    where: { accountId, eventType: "export" },
    orderBy: { timestamp: "desc" },
  });
  assert.ok(ledgered, "every export must write a ledger entry");
  assert.equal(ledgered.constitutionVersion, 3);
});
