/**
 * lib/db.ts — Prisma client singleton (Prisma 7, driver-adapter API).
 *
 * Runtime-aware:
 *  - On Cloudflare Workers (workerd) the client uses @prisma/adapter-d1 with
 *    the `DB` D1 binding, obtained via @opennextjs/cloudflare's
 *    getCloudflareContext().
 *  - Locally (node: `next dev`, tsx scripts, seed) it keeps the
 *    @prisma/adapter-better-sqlite3 path. That adapter is loaded via
 *    createRequire so bundlers never trace the native better-sqlite3 module
 *    into the worker bundle.
 *
 * The exported surface is unchanged: `db` (and default export) behaves as a
 * PrismaClient. Swapping to Postgres later still means swapping the adapter —
 * no call-site changes anywhere in the app.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "./generated/prisma/client";
// Workers-runtime client: loads the query-compiler WASM via a module import
// (runtime WASM compilation from bytes is disallowed on workerd).
import { PrismaClient as PrismaClientWorkerd } from "./generated/prisma-workerd/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./dev.db";

/** True when running on the Cloudflare workerd runtime. */
function isWorkerd(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.includes("Cloudflare-Workers")
  );
}

function createLocalClient(): PrismaClient {
  // createRequire keeps better-sqlite3 (native addon) invisible to the
  // Workers bundler; this branch only ever executes under node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeRequire: NodeRequire =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (require("node:module") as any).createRequire(process.cwd() + "/");
  const { PrismaBetterSqlite3 } = nodeRequire("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
  return new PrismaClient({ adapter });
}

type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

function createWorkersClient(): PrismaClient {
  const { env } = getCloudflareContext();
  const binding = (env as { DB?: D1Binding }).DB;
  if (!binding) {
    throw new Error(
      "D1 binding `DB` not found — check d1_databases in wrangler.jsonc.",
    );
  }
  const adapter = new PrismaD1(binding);
  // The workerd-generated client is structurally identical (same schema);
  // cast so the exported surface stays a single PrismaClient type.
  return new PrismaClientWorkerd({ adapter }) as unknown as PrismaClient;
}

function createClient(): PrismaClient {
  return isWorkerd() ? createWorkersClient() : createLocalClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Lazily initialize on first use so module import never touches a runtime it
 *  isn't on (and so the worker only reads its D1 binding inside a request). */
function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    return prop in getClient();
  },
});

export default db;
