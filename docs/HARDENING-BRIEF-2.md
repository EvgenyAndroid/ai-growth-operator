# Hardening Cleanup Pass 2 — surgical (Evgeny's static review of the hardened repo, July 2026)
Verdict on pass 1: landed well — credible security/quality spine. This pass: targeted cleanup only. NO UI redesign, behavior changes, recipe/measurement/approval/demo-data/trust-copy changes, real auth, real connectors, or guardrail weakening.

## 1. Local test gate must match CI
npm test currently omits test:contracts, check:boundary, check:accounts, tsc --noEmit. Add test:all running the full gate (lint, check:boundary, tsc --noEmit, build, smoke.mjs, test:contracts, test:security, check:accounts); make npm test equal it or clearly document; README points to the full gate.

## 2. Narrow the "use server" action surface
lib/server/{opportunities,performance,ledger,chat}.ts mix reads and actions under "use server". Refactor: reads → server-only modules (NOT "use server"); client-callable mutations → narrow "use server" action files (e.g. lib/server/opportunities/read.ts + actions.ts; performance/read.ts; ledger/read.ts; chat/actions.ts). Server components may use reads via barrel; client components import only narrow action modules. Keep routes working; check:boundary passes; no client path to DB/Prisma types.

## 3. Split demo provisioning from reset
createDemoAccount() is broad (reuse/create/reset by params) and barrel-exported. Split: ensureDemoAccount()/getOrCreateDemoAccount() safe read/create for server components (never accepts reset:true); resetDemoWorkspace() = the ONLY reset path, still guardMutation-guarded; selectDemoVertical() (or equivalent) guarded for vertical setup. No broad seed/reset function exported to UI-facing modules. Demo + reset still work; testable.

## 4. Export ID policy
Raw email already never exports; hashes stay hashed. Now: decide internal customer id export policy — prefer external-safe/hashed ids, or make internal ids optional/clearly labeled system ids. Audience exports must not leak member customer IDs via nested JSON. Add/update tests for the ID exposure policy. Document policy in SECURITY.md.

## 5. Release-grade Cloudflare build gate
CI's cloudflare-build is continue-on-error. Add a release path where it is BLOCKING: ci:release workflow/job or npm run test:release; document in PRODUCTION-HARDENING.md. Regular PR CI stays practical.

## 6. CSP TODO visibility
Keep current CSP; make the nonce-based-CSP-before-real-data requirement explicit in SECURITY.md + PRODUCTION-HARDENING.md (+ a comment in next.config.ts). No header regression.

## 7. Trust invariants (do not regress; add tests if refactors touch these paths)
Meta directional only / never in found-money / never lift-family language. Holdout-verified only for eligible Klaviyo lifecycle flows. Brief/manual downgrades measurement. Draft ≠ activation. Approval before sends/syncs/suppression. constitution_version on every action log. No raw PII export. Demo clearly labeled.

## 8. Full gate after changes
db:generate, lint, check:boundary, tsc --noEmit, build, smoke.mjs, test:contracts, test:security, check:accounts — fix root causes; never edit tests to pass unless a test is clearly wrong.

## Context notes
- Narrative guardrail (finding 8): v0 launch wedge = Shopify DTC; local café vertical = demo/expansion proof — keep docs/copy consistent with that framing where touched.
- After this pass the remaining major blocker is real auth + connector credential security, not code quality.
