# Database & Migration Posture — MVP v0 ALPHA (hardening P12)

One page on how schema changes move from `prisma/schema.prisma` to the two
runtimes (local SQLite, Cloudflare D1), what the alpha deliberately does NOT
do yet, and the exact commands. `docs/CONTRACTS.md` owns the schema-shape
rules (String columns for enums, Postgres-compatible types); this file owns
the lifecycle.

## TL;DR

| Environment | Engine | How schema gets there | Command |
| --- | --- | --- | --- |
| Local dev / CI / smoke | SQLite file (`dev.db`, gitignored) | **`prisma db push`** (no migration files) | `npm run db:push` |
| Cloudflare (demo deploy) | D1 (`ai-growth-operator-demo`, binding `DB`) | Full-schema SQL snapshot (`schema.sql`) applied via wrangler | `npx wrangler d1 execute ai-growth-operator-demo --file=schema.sql --remote` |
| Production (future) | Postgres (PRD 26B.19) | **`prisma migrate`** — versioned migration files, reviewed + applied by CI | not yet wired (see below) |

## Alpha posture: `db push`, not `migrate`

The alpha intentionally uses `prisma db push`:

- The only data anywhere is the deterministic demo dataset; `npm run seed`
  rebuilds both demo accounts from scratch at any time. There is nothing to
  migrate — destructive schema syncs are acceptable and even desirable.
- No migration history exists yet (`prisma/migrations/` does not exist by
  design; `prisma.config.ts` already points at that path for the day it does).
- CI (`.github/workflows/ci.yml`) creates a fresh database per run:
  `db:generate -> db:push -> seed -> build -> smoke -> tests`, all against
  `DATABASE_URL=file:./dev.db`. Deterministic, no secrets.

**The flip to `prisma migrate` is a production-readiness gate** (tracked in
docs/PRODUCTION-HARDENING.md): the first real (non-demo) row in a database
makes `db push` unacceptable. From that point: `prisma migrate dev` to author
migrations locally, `prisma migrate deploy` in CI, and `db push` never runs
against a shared environment again.

## Local SQLite notes

- `lib/db.ts` resolves `DATABASE_URL` and defaults to `file:./dev.db`
  (repo root — relative to where `next dev`/scripts run, which is always the
  repo root). The Node path uses `@prisma/adapter-better-sqlite3`.
- Prisma has **no native enums on SQLite**: enum-like columns are `String`;
  the legal values are the literal unions in `lib/contracts/public.ts` —
  treat those unions as law. On Postgres they can become native enums with no
  application-code change.
- The schema uses no other SQLite-only tricks (Json/DateTime/Float/relations
  are Postgres-compatible), so the datasource flip is adapter + provider only.

## Cloudflare D1 notes

- The Workers runtime cannot run Prisma's migration engine. D1 gets its
  schema from `schema.sql` (repo root) — a full-schema SQL snapshot applied
  with `wrangler d1 execute`. The snapshot is **generated and gitignored**
  (like the Prisma clients): never commit it, regenerate it on demand.
- Regenerate the snapshot after any `prisma/schema.prisma` change:

  ```bash
  npx prisma migrate diff --from-empty \
    --to-schema-datamodel prisma/schema.prisma --script > schema.sql
  npx wrangler d1 execute ai-growth-operator-demo --file=schema.sql --remote
  ```

  This DROPs nothing by itself but also alters nothing: it is a from-empty
  script, correct for bootstrap/rebuild of the demo database (which is
  disposable — reseed after). Incremental D1 migrations (`wrangler d1
  migrations`) become mandatory at the same production gate as
  `prisma migrate`.
- At runtime the Workers branch of `lib/db.ts` uses `@prisma/adapter-d1`
  with the `DB` binding plus the dedicated workerd Prisma client (see below).

## Generated clients: never committed, always generated

Two Prisma clients are generated from the one schema (`prisma/schema.prisma`
declares both generators):

- `lib/generated/prisma/` — Node runtime (dev server, scripts, tests)
- `lib/generated/prisma-workerd/` — workerd runtime (loads the query-compiler
  WASM via module import, required on Workers)

Both directories are **gitignored and must never be committed**. They are
guaranteed to exist at build time because `package.json` wires
`predev`/`prebuild` to `prisma generate`, and CI runs `npm run db:generate`
explicitly. If an editor shows red imports from `lib/generated/*`, run
`npm run db:generate` — do not hand-create or commit anything there.

## Command reference

```bash
npm run db:generate    # prisma generate (BOTH clients; also runs pre-dev/build)
npm run db:push        # sync prisma/schema.prisma -> local SQLite (alpha only)
npm run seed           # deterministic demo seed (idempotent, both verticals)
npx prisma studio      # inspect the local database
# D1 (demo deploy only):
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > schema.sql
npx wrangler d1 execute ai-growth-operator-demo --file=schema.sql --remote
```
