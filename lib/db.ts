/**
 * lib/db.ts — Prisma client singleton (Prisma 7, driver-adapter API).
 *
 * Alpha uses SQLite via @prisma/adapter-better-sqlite3. Swapping to Postgres
 * later means swapping the adapter (e.g. @prisma/adapter-pg) — no call-site
 * changes anywhere in the app.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./dev.db";

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export default db;
