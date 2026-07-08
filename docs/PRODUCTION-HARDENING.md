# Production Hardening — status & remaining gates (P14)

Outcome record of the July 2026 hardening pass (spec:
docs/HARDENING-BRIEF.md) plus the checklist of what MUST still happen before
this app handles a single real (non-demo) merchant. Current-state details
live in docs/SECURITY.md; DB lifecycle in docs/MIGRATIONS.md; module
boundaries in docs/CONTRACTS.md.

## What the hardening pass delivered (done, verified in CI)

| Phase | Delivered | Where |
| --- | --- | --- |
| P1 | Deterministic baseline; `prisma generate` on predev/prebuild (both clients) | `package.json` |
| P2 | Server/client boundary: direct "use server" imports only; `server-only` markers | `scripts/check-client-boundary.mjs` |
| P3 | Contracts split: client-safe `public.ts` / server-only `models.ts` | `lib/contracts/` |
| P4 | Account boundary resolver; forged accountIds cannot cross workspaces | `lib/server/account-context.ts` |
| P5 | zod validation at entry of every exported server action | `lib/server/validation.ts` |
| P6 | Security headers incl. enforced CSP; robots noindex | `next.config.ts`, `app/layout.tsx` |
| P7 | Mutation guards: same-origin + rate limit + attempt logging on all 10 high-risk actions | `lib/server/rate-limit.ts`, `origin.ts`, `WIRING.md` |
| P8 | Export privacy guards (hashed identifiers, allowlists, contained filenames) | `lib/server/export.ts` |
| P9 | Focused test suites: recipes, governance, measurement, chat, export privacy, account isolation | `tests/*.test.ts` |
| P10 | CI quality gate (lint, boundary, tsc, build, full smoke, contracts + security tests) | `.github/workflows/ci.yml` |
| P11 | Behavior-preserving splits: action slice + shared ladder helper; `ChoiceChip` pill dedup; zero lint warnings | `lib/server/actions/`, `components/ui/primitives.tsx` |
| P12 | Migration posture documented (db-push alpha vs migrate prod; D1 snapshot flow) | `docs/MIGRATIONS.md` |
| P13 | Central safe error formatter; user-safe errors only; server-side logging | `lib/server/errors.ts` |

## Blocking gates before ANY real-merchant launch

1. **Real authentication + authorization.** Replace the vertical-cookie match
   in `assertAccountAccess` with session -> user -> org membership -> role
   (the seam and required steps are documented at the top of
   `lib/server/account-context.ts`). Nothing else on this list matters until
   this exists.
2. **Distributed rate limiting.** The in-memory limiter is per-process /
   per-isolate. Inject a Cloudflare KV / D1 / Durable-Object (or native
   rate-limiting binding) `RateLimiter` via `setRateLimiter()` at startup —
   the interface seam exists; no call-site changes needed
   (`lib/server/rate-limit.ts`).
3. **Versioned migrations.** Flip from `prisma db push` to `prisma migrate`
   (and `wrangler d1 migrations` for D1) the moment real data exists —
   see docs/MIGRATIONS.md. Private beta targets Postgres (PRD 26B.19).
4. **Nonce-based CSP.** Remove `script-src 'unsafe-inline'` by adding
   per-request nonce middleware (documented in `next.config.ts`). Keep the
   current enforced policy until then — do not regress to report-only.
5. **Real connectors change the threat model.** When Klaviyo/Meta/Shopify
   stop being mocks: encrypted credential storage, per-connector scopes,
   webhook signature verification, and the governance chokepoint re-audited
   against REAL sends (draft-vs-activation invariants must hold with actual
   side effects).
6. **Observability.** Ship server logs somewhere queryable (Workers logpush /
   tail), alert on `[mutation-guard]` denials and `activation_failure` ledger
   entries, and add uptime checks. Error formatting is already centralized.
7. **Export storage.** Exports currently live under `exports/<accountId>/`
   (filesystem, response-only on Workers). Real merchants need R2/S3 with
   signed URLs, retention, and access logging.
8. **PII inventory.** Real customer rows mean a data map, deletion path
   (per-account cascade exists for demo resets — verify it against real
   relations), and a DPA. `emailLower` hashing at export is already enforced.
9. **Dependency + supply-chain hygiene.** Enable Dependabot/`npm audit` in
   CI; pin the patch-package patches review.

## Non-blocking but worth doing

- LLM integration (post-alpha) re-introduces prompt-injection surface: keep
  the deterministic governance chokepoint OUTSIDE the model loop; treat model
  output as untrusted input to `checkAction`, never as an authority.
- `operatorChat`'s draft intent calls `draftAction` internally, so one chat
  request consumes one unit of both budgets — fine at current limits
  (20+30/min); revisit when limits tighten.
- Per-request request-id in logs to correlate guard denials with ledger rows.

## How to verify the posture locally

```bash
npm run test           # lint + build + full smoke + security tests
npm run test:contracts # recipes, governance, measurement, chat invariants
npm run test:security  # export privacy + account isolation
npm run test:quality   # lint + boundary check + tsc
npm run check:accounts # account-boundary acceptance (21 checks)
```

All of the above run in CI on every push/PR (`.github/workflows/ci.yml`).
