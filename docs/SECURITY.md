# Security Posture — MVP v0 ALPHA (hardening P14)

What protects this app today, exactly where each protection lives, and what
is deliberately NOT protected yet because the alpha is a demo. The production
gap list lives in docs/PRODUCTION-HARDENING.md; this file describes the
current state.

## Threat model in one paragraph

The alpha is a **public demo workspace with simulated data and mocked
connectors**. There are no users, no sessions, no real customer PII beyond
the deterministic seed, and no external sends/syncs/spend (activation is
simulated, PRD 25.1). The realistic threats are: forged/curious requests
poking other accounts, malformed or oversized inputs, cross-site request
forgery, abusive traffic against mutating endpoints, and data leaking through
exports or error messages. Each has a dedicated, tested control below.

## Auth limitations (read this first)

**There is no real authentication.** "Enter the demo" is the only login. The
account boundary is real, but identity is not:

- `userId` / `approver` fields are self-reported display strings (validated
  for shape, never trusted as identity).
- Anyone who can reach the app can use the demo workspaces.
- The production seam — session -> user -> org membership -> role — is
  documented at the top of `lib/server/account-context.ts` and is a blocking
  TODO before any non-demo launch.

## The account boundary (P4)

`lib/server/account-context.ts` is the single resolver. Every account-scoped
server action calls `assertAccountAccess(accountId)` before touching data:
the id must exist, be a **demo** account, and (inside a request scope) match
the demo account of the visitor's active vertical (`ago_vertical` cookie).
Forged accountIds cannot read or mutate across workspaces — proven by
`tests/account-isolation.test.ts` and `npm run check:accounts`. Not-found and
forbidden responses are identical, so ids cannot be probed.

## Demo provisioning vs reset (pass 2, item 3)

Provisioning intent is split so no broad "seed/reset by params" function is
reachable from UI-facing modules:

- `ensureDemoAccount` (`lib/server/onboarding/read.ts`) — the safe
  reuse-or-first-create resolver server components call on render. It has NO
  reset parameter; a forged `reset: true` is stripped at validation.
- `resetDemoWorkspace` (`lib/server/onboarding/actions.ts`) — the ONLY reset
  path, `guardMutation`-guarded (5/min).
- `selectDemoVertical` (`lib/server/onboarding/actions.ts`) — guarded
  Business Setup mutation (vertical cookie + workspace provisioning).

Pinned by `tests/demo-provisioning.test.ts` (`npm run test:security`).

## The mutation-guard pattern (P7)

Every high-risk action starts with the same composed one-liner (wiring table:
`lib/server/WIRING.md`):

```ts
await guardMutation("<actionName>"); // 1. same-origin check  2. rate limit  3. attempt log
```

then zod validation, then the account boundary — abusive traffic is shed
cheapest-first. Guarded actions: draftAction, approveAction, rejectAction,
recordDraftEdit (all in `lib/server/actions/index.ts`), dismissOpportunity
(`lib/server/opportunities/actions.ts`), exportState, operatorChat
(`lib/server/chat/actions.ts`), saveOperatingRules, resyncConnection,
resetDemoWorkspace, selectDemoVertical (all in
`lib/server/onboarding/actions.ts`). The rate limiter (`lib/server/rate-limit.ts`) is an
interface with an in-memory fixed-window default and a `setRateLimiter()`
seam for a KV/D1/Durable-Object backend (production TODO). The origin check
(`lib/server/origin.ts`) fails closed on `Origin: null`, malformed origins,
and host mismatches; it skips only when there is no request scope at all
(seed/smoke/tests running actions in-process).

## Input validation (P5)

`lib/server/validation.ts` holds a zod schema for **every exported server
action**; each action validates at entry via `parseInput(...)`. Rules applied
uniformly: bounded-length ids with a strict charset; trimmed text with hard
max lengths; finite bounded numbers; enums checked against the contract
unions (kept exhaustive at compile time); capped arrays; unknown fields
stripped; `safeParse` with one user-safe error naming only the field — never
echoing payloads, never surfacing stack traces.

## Server/client boundary (P2/P3, narrowed in pass 2)

- The "use server" surface is deliberately NARROW (hardening pass 2, item 2):
  reads (`lib/server/{opportunities,performance,ledger,onboarding}/read.ts`)
  are `server-only` modules — they are called by server components but are
  never client-invocable action endpoints. Client-callable mutations live in
  dedicated action files: `lib/server/actions` (draft/approve/reject/edit),
  `lib/server/opportunities/actions.ts` (dismiss), `lib/server/chat/actions.ts`
  (operatorChat), `lib/server/export.ts` (exportState), and
  `lib/server/onboarding/actions.ts` (rules/resync/reset/vertical).
- Client components import server actions **only** from those narrow
  "use server" modules, never the broad `lib/server` barrel (the barrel stays
  server-component-safe and re-exports both reads and actions for pages).
- `lib/db.ts`, generated Prisma clients, and `lib/contracts/models.ts` are
  `server-only` and can never enter a client bundle.
- `lib/contracts/public.ts` (zero imports, client-safe) is the only contract
  surface the UI sees; `components/ui/primitives.tsx` uses it exclusively.
- Enforced statically on every CI run by `npm run check:boundary`
  (`scripts/check-client-boundary.mjs` walks the transitive runtime import
  graph of every client component).

## Security headers (P6)

Set globally in `next.config.ts`: an enforced CSP (self-only for scripts/
styles/images/fonts/connect, `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri`/`form-action` pinned to self; `'unsafe-inline'` relaxations for
Next hydration are documented inline with the nonce-CSP production TODO),
plus `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone,
geolocation, payment all denied), `X-Frame-Options: DENY`, and `X-Robots-Tag:
noindex, nofollow` (mirrored by robots metadata in `app/layout.tsx` — the
demo must stay out of search indexes).

**Nonce-CSP requirement (explicit): the `script-src 'unsafe-inline'`
relaxation is acceptable ONLY while every byte in this app is simulated demo
data. Before the app touches any real (non-demo) merchant data, the CSP must
move to per-request nonces — this is a blocking production gate
(docs/PRODUCTION-HARDENING.md #4), not a nice-to-have. Until then the current
enforced policy must not regress (no report-only, no dropped directives).**

## Export privacy (P8) and the export ID policy (pass 2, item 4)

`lib/server/export.ts` never exports raw PII: customer identifiers leave only
as hashes; `email`/`emailLower` never appear in CSV or JSON output; audience
exports do not leak member customer ids; filenames are allowlist + server
clock only (a hostile `requestedBy` cannot influence the path) and are
contained under `exports/<accountId>/`; object types and formats are
allowlisted at entry (rejects create no ExportJob row and echo nothing);
completed jobs are recorded on `ExportJob` and ledgered with the constitution
version.

**ID policy.** What an internal database id may look like outside the app is
a policy, not an accident:

- Internal ids (cuids) are opaque, non-PII **system identifiers**. They
  export ONLY under clearly labeled `*system_id` column names (`system_id`,
  `ledger_system_id`, `action_system_id`) so a consumer can never mistake
  them for customer identity or an external-system key.
- `email_hash` is the ONLY customer-level identifier that exports. Raw email
  / `emailLower` never leave (hashes stay hashed).
- **Audience member customer ids never export** — not as columns (rows drop
  `inclusionRules`) and not via nested JSON: every exported JSON column runs
  through `scrubNestedJson`, which strips member-id-shaped keys
  (`customerIds`, `member_customer_ids`, ...) and email-shaped keys that are
  not explicit hashes, at any nesting depth.

All of this is pinned by `tests/export-privacy.test.ts`
(`npm run test:security`).

## Error handling (P13)

`lib/server/errors.ts`: only messages explicitly marked user-safe
(`UserFacingError`) reach the UI or the Context Ledger; everything else
collapses to a generic message while the real cause goes to the server log
(`logServerError`). Next.js additionally redacts thrown server-action errors
in production. No stack traces, driver errors, paths, or SQL ever render.

## Trust-rule invariants with security weight

Enforced by the governance runtime (`lib/governance`) and pinned by
`npm run test:contracts`: nothing sends/syncs/spends without explicit
approval; draft is never activation (26A.4); Meta is always directional
(never lift/incrementality language); Meta audience sync requires the 26A.8
identifier-rights confirmation; suppressed and non-consented customers are
blocked at draft AND approval; every action logs `constitution_version`;
alpha makes **no LLM calls** (templates + deterministic routing only), so
there is no prompt-injection surface.

## Reporting

This is a demo alpha; there is no bug-bounty process. Issues go to the repo
owner directly.
