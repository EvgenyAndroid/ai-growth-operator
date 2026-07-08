#!/usr/bin/env node
/**
 * scripts/check-client-boundary.mjs — static server/client boundary check
 * (hardening brief P2/P3 acceptance).
 *
 * For every Client Component ("use client" module) it walks the transitive
 * RUNTIME import graph (type-only imports are erased by the compiler and are
 * skipped) and fails if any path reaches:
 *   - lib/db.ts                     (Prisma client singleton)
 *   - lib/generated/**              (generated Prisma clients)
 *   - lib/contracts/models.ts       (server-only model surface)
 *   - lib/server/index.ts           (broad server barrel — clients must import
 *                                    the specific "use server" module instead)
 *
 * Imports of "use server" modules are allowed AND not traversed: Next replaces
 * them with action reference proxies, so nothing behind them enters the client
 * bundle. Run with: node scripts/check-client-boundary.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SOURCE_DIRS = ["app", "components", "lib"];
const EXTS = [".ts", ".tsx", ".mts", ".js", ".jsx"];

/** Repo-relative forbidden targets for client bundles. */
function isForbidden(rel) {
  const p = rel.replaceAll("\\", "/");
  return (
    p === "lib/db.ts" ||
    p.startsWith("lib/generated/") ||
    p === "lib/contracts/models.ts" ||
    p === "lib/server/index.ts"
  );
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      out.push(...listFiles(p));
    } else if (EXTS.some((e) => entry.name.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

function read(file) {
  return readFileSync(file, "utf8");
}

function hasDirective(src, directive) {
  // Directive must appear before any statement; cheap check on the first
  // non-comment chunk is enough for this codebase's conventions.
  return new RegExp(`^\\s*(/\\*[\\s\\S]*?\\*/\\s*|//[^\\n]*\\n\\s*)*["']${directive}["']`).test(src);
}

/** Extract runtime (non-type-only) import/export-from specifiers. */
function runtimeImports(src) {
  const specs = [];
  const re =
    /(?:import|export)\s+([\s\S]*?)\s+from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const clause = m[1];
    const spec = m[2] ?? m[3];
    if (!spec) continue;
    if (clause && /^type[\s{]/.test(clause.trim())) continue; // import type {...} / export type {...}
    specs.push(spec);
  }
  return specs;
}

function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // external package — CSP of this check is project files only
  const candidates = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => path.join(base, "index" + e)),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const files = SOURCE_DIRS.flatMap((d) => listFiles(path.join(ROOT, d)));
const clientEntries = files.filter((f) => hasDirective(read(f), "use client"));

let failures = 0;
for (const entry of clientEntries) {
  const seen = new Set();
  const stack = [[entry, []]];
  while (stack.length) {
    const [file, chain] = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file);
    // "use server" modules become action-reference proxies in client bundles;
    // their bodies (and transitive imports) never ship to the client.
    if (file !== entry && hasDirective(src, "use server")) continue;
    const rel = path.relative(ROOT, file);
    if (isForbidden(rel)) {
      failures += 1;
      console.log(
        `FAIL  ${path.relative(ROOT, entry)} reaches ${rel}\n      via ${[...chain, rel].join(" -> ")}`,
      );
      continue;
    }
    for (const spec of runtimeImports(src)) {
      const resolved = resolveSpec(file, spec);
      if (resolved) stack.push([resolved, [...chain, rel]]);
    }
  }
}

console.log(
  failures === 0
    ? `PASS  ${clientEntries.length} client component(s): no transitive runtime import of lib/db, generated Prisma, contracts/models, or the lib/server barrel`
    : `[boundary] ${failures} violation(s)`,
);
process.exit(failures === 0 ? 0 : 1);
