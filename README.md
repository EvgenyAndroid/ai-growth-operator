# AI Growth Operator

Agentic CDP for SMB and DTC brands. The system of decision, not another system of storage.

**Spec:** docs/PRD.md (PRD v1.1 — authoritative, incl. §26A Build Clarifications + §26B Engineering Defaults). Strategy: docs/BRD-v3.md.

**Status:** Alpha (PRD §25.1) — demo mode, mocked connectors, deterministic recipes, simulated activation + holdouts. No LLM calls in alpha: recipes are deterministic and Operator Chat is a constrained command interface (PRD §26A.3).

**Stack:** Next.js (App Router, TypeScript) + Prisma + Tailwind. Alpha runs SQLite for zero-setup local dev; the schema is Postgres-compatible and private beta flips the Prisma datasource to Postgres (PRD §26B.19).

Core loop: **Find money → draft action → approve → activate → measure → learn.**

Measured lift, not vendor math — and when we cannot prove it, we say so.

## Running locally

```bash
npm install            # install dependencies
npx prisma db push     # create/update the local SQLite database (dev.db)
npm run seed           # seed the deterministic demo datasets (idempotent — replaces both demo accounts)
npm run dev            # start the dev server at http://localhost:3000
```

Enter the demo workspace from the landing page (auth is stubbed in alpha; demo mode is the only mode). The feed at `/feed` runs the active vertical's three recipes on every request.

## Two demo verticals

The alpha ships two demo launch profiles, picked on the Business Setup screen. Vertical selection routes everything — recipes, Operating Rules template, connector set, feed copy — via `VERTICAL_REGISTRY` in `lib/verticals.ts` (trust rule #10):

| | **Shopify DTC** | **Local café / bakery** |
| --- | --- | --- |
| Demo merchant | DTC brand (`lib/demo`) | "Cardamom & Rye" (`lib/demo/local`) |
| Connectors (mocked) | Shopify, Klaviyo, Meta, GA4 | Square-like POS, Mailchimp-like email, Google Business Profile, Meta |
| Recipes | abandoned checkout recovery, lapsed win-back, Meta seed + suppression | lapsed-regular win-back, catering upsell, Meta seed + suppression (shared) |
| Measurement | holdout-verified at >= 500-audience Klaviyo flows | audiences engineered **below 500**, so the before/after-no-control path exercises — no holdouts |
| Extra trust rule | — | POS coverage disclosure (#9): estimates cover identified (loyalty-matched) customers only; every LOCAL card and readout states the identified-transaction share. Catering and Meta are never found-money eligible. |

`npm run seed` seeds both demo accounts. The LOCAL pack is demo-mode only, exactly like the DTC alpha.

## Tests

```bash
npm run smoke          # fast in-process contract checks (scripts/smoke.ts)
node scripts/smoke.mjs # full end-to-end smoke: reseeds the demo data, builds
                       # (if needed) and boots `next start`, checks the demo
                       # banner + found-money feed over HTTP, then runs a real
                       # approve cycle (draft -> governance -> holdout ->
                       # ledger -> measurement readouts) via module invocation.
                       # Then the LOCAL vertical section: onboard-as-local,
                       # local feed (coverage disclosure + lapsed-regular +
                       # catering + Meta cards), and the LOCAL approve cycle
                       # (before/after-no-control, NO holdout, Meta directional)
                       # — with the DTC checks running first as regression gate
```

`node scripts/smoke.mjs` prints PASS/FAIL per check and exits nonzero on failure. It reseeds the demo database, so run `npm run seed` afterwards if you want a pristine demo account.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (localhost:3000) |
| `npm run build` | Production build (also typechecks the whole repo) |
| `npm run start` | Serve the production build |
| `npm run db:push` | Push `prisma/schema.prisma` to SQLite |
| `npm run db:generate` | Regenerate the Prisma client (`lib/generated/prisma`) |
| `npm run seed` | Seed/replace both demo accounts (Shopify DTC + local café/bakery) |
| `npm run lint` | ESLint |
