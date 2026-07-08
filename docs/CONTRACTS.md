# Module Contracts & Ownership Map — MVP v0 ALPHA

One page. If a question about "who owns this file" or "what may I import" comes
up, this document is the answer. `docs/PRD.md` (v1.1, sections 26A/26B win) is
the product spec; this is the engineering split.

## Import direction rule

```
ui (app/, components/)  ->  lib/server  ->  modules  ->  lib/contracts + lib/db
```

- **ui** never imports a module (`lib/demo`, `lib/recipes`, ...) directly; it
  calls `lib/server` actions.
- **Client components** import server actions ONLY from their "use server"
  module directly (e.g. `@/lib/server/actions`, `@/lib/server/opportunities`)
  — never the broad `lib/server` barrel (`lib/server/index.ts` is for Server
  Components and scripts). Enforced by `npm run check:boundary`.
- **modules** never import each other's internals; they exchange data only
  through the types in `lib/contracts` and rows in the database.
- **nothing** imports upward. `lib/contracts` is split (hardening P3):
  `lib/contracts/public.ts` has ZERO imports and is the only contract surface
  clients (and `components/ui/primitives.tsx`) may use;
  `lib/contracts/models.ts` re-exports generated Prisma model types and is
  server-only; `lib/contracts/index.ts` re-exports public only.
- There is **no code path around governance**: `lib/server` routes every
  activation through `lib/governance` before touching a connector, and every
  decision through `lib/ledger` (PRD 4.3, 18).

### Inside lib/server (P11 split)

The action slice lives in `lib/server/actions/`. Direction within it:

```
actions/index.ts ("use server" — guard + validate + delegate; STABLE surface)
  -> actions/{draft,approve,reject,edit}.ts   (implementations; start at the
                                               P4 account boundary)
    -> actions/activation-ladder.ts           (shared channel/governance-view/
                                               simulated-ladder helpers)
    -> ../shared.ts, ../draft-templates.ts, ../types.ts  (slice-local helpers)
      -> modules (governance, ledger, measurement, recipes) -> contracts + db
```

Only `index.ts` carries "use server"; every implementation/helper file is
`server-only`. Every guarded action follows the same entry order (see
`lib/server/WIRING.md` + docs/SECURITY.md): `guardMutation` (P7) -> zod
`parseInput` (P5) -> `assertAccountAccess` (P4) -> work.

## Ownership map

| Area | Path(s) | Owns |
| --- | --- | --- |
| Foundation | `prisma/`, `lib/contracts/`, `lib/verticals.ts`, `lib/db.ts`, `components/ui/primitives.tsx`, `package.json`, config files | Schema, shared types (public/models split), vertical pack registry, DB singleton, UI primitives (incl. the pill/badge/chip system — render status pills ONLY via these). **Frozen for module agents.** |
| Demo data | `lib/demo/` | `DemoDataset` generator + mocked connectors (Shopify/Klaviyo/Meta mocks, simulated `SyncRun`s). Fills `prisma/seed.ts` body. Must exercise all 3 recipes and all 3 measurement labels (PRD 25.1). |
| Demo data (LOCAL) | `lib/demo/local/` | Café/bakery demo dataset + mocked connectors for the LOCAL pack (Square-like POS, Mailchimp-like email, Google Business Profile). POS orders reuse `Event`/`purchase` with source `square`; GBP is an `Integration` row. Local audiences are engineered SMALLER than 500 so the before/after path exercises. |
| Recipes | `lib/recipes/` | The three deterministic DTC recipes (`abandoned_checkout_recovery`, `lapsed_winback`, `meta_seed_suppression`). `RecipeInput -> RecipeResult`. No I/O side effects other than reads via `lib/db`. |
| Recipes (LOCAL) | `lib/recipes/local/` | The LOCAL pack recipes (`local_lapsed_regular`, `catering_upsell`; the Meta seed recipe is shared from `lib/recipes/`). Every result MUST carry `coverage: IdentifiedCoverage` (trust rule #9). |
| Governance + Ledger | `lib/governance/`, `lib/ledger/` | Runtime gate (`GovernanceCheckInput -> GovernanceCheckResult`; consent, suppression, budget, discount, margin, approval, banned claims, freshness) and `LedgerWriteFn`. |
| Measurement | `lib/measurement/` | Holdout assignment (>=500, 10%, randomized customer-level, Klaviyo flows only), simulated readouts, `MeasurementReadout`, 26A.1 downgrade rule, 26A.2 windows. |
| Server actions | `lib/server/` (action slice: `lib/server/actions/`) | Next.js server actions / route handlers. The ONLY layer ui calls. Orchestrates modules, enforces governance-before-activation, writes ledger entries. Operator Chat intent router (26A.3), account boundary (`account-context.ts`), zod schemas (`validation.ts`), mutation guards (`rate-limit.ts`, `origin.ts`), and safe errors (`errors.ts`) live here. |
| UI slices | `app/` by route | `app/(onboarding)`, `app/feed`, `app/opportunities/[id]`, `app/approvals`, `app/performance`, `app/ledger`, `app/chat`, `app/settings` (Operating Rules, recipe config, exports). Imports `components/ui/primitives.tsx` + `lib/server` only. |

## Trust rules every module must respect (violations fail review)

1. Exactly three measurement labels — render only via `MeasurementBadge`.
2. Meta is ALWAYS `directional`; `META_DISALLOWED_TERMS` never appear in Meta copy.
3. Holdouts only for Klaviyo flows with eligible audience >= 500; downgrade to
   `before_after_no_control` when activation level is brief/manual (26A.1).
4. Estimates are always `EstimateRange`s — no single points (PRD 16.4).
5. Found-money header only via `isFoundMoneyEligible()` (PRD 16.2).
6. Draft is not activation — approval required before any send/sync (26A.4).
7. Every recommendation carries a full `ExplanationContract` or does not render (PRD 4.4).
8. Alpha has NO LLM calls: templates + deterministic intent routing only.
9. **POS coverage disclosure (LOCAL pack):** local estimates cover identified
   (loyalty-matched) customers only. Every LOCAL card and readout states the
   identified-transaction share via `IdentifiedCoverage`
   (`buildIdentifiedCoverage()` in `lib/verticals.ts`). `catering_upsell` and
   Meta are never found-money eligible; `local_lapsed_regular` follows the
   standard found-money gate.
10. **Vertical routing:** `Account.vertical` selects everything — recipes,
    constitution template, connector set, feed copy — via `VERTICAL_REGISTRY`
    in `lib/verticals.ts`. No module hardcodes vertical checks, and the
    `shopify_dtc` path must behave exactly as before the LOCAL pack existed.

## Schema notes

- SQLite (Alpha) via Prisma 7 + `@prisma/adapter-better-sqlite3`; Postgres-ready.
  D1 (`@prisma/adapter-d1`) on Cloudflare Workers. Full lifecycle + migration
  posture: docs/MIGRATIONS.md.
- Prisma has no enums on SQLite: enum-like columns are `String`, legal values
  are the literal unions in `lib/contracts/public.ts`. Treat those unions as law.
- Generated clients: `lib/generated/prisma/` + `lib/generated/prisma-workerd/`
  (gitignored, never committed; `npm run db:generate`, also runs pre-dev/build).
- `npm run db:push` syncs schema; `npm run seed` seeds; `npm run smoke` smoke-tests.
