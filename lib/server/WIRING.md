# WIRING.md — P7 mutation-guard wiring contract

Written by the P6/P7 (headers + rate-limit) agent. The guards-validation
agent owns the action files and performs the wiring; the audit agent
verifies it happened. This file describes the exact one-line call.

## What exists (new files, no action files touched)

- `lib/server/rate-limit.ts` — `RateLimiter` interface, in-memory
  fixed-window default, no-op fallback (`RATE_LIMIT_DISABLED=1` or
  `setRateLimiter(createNoopRateLimiter())`), Cloudflare KV/D1/DO adapter
  seam (`setRateLimiter`), per-action rules (`RATE_LIMIT_RULES`,
  `DEFAULT_MUTATION_RULE`), and the composed guard **`guardMutation`**.
- `lib/server/origin.ts` — `checkSameOrigin()` (non-throwing) and
  `assertSameOrigin(action)` (throwing), browser-standard CSRF posture.

`guardMutation(action)` composes: same-origin check → rate limit →
mutation-attempt logging (`[mutation-guard] <action> <outcome> key=<ip>`).
Fail-closed (throws a user-safe `Error`) on cross-origin or over-limit;
**skips silently when there is no request scope**, so seed/smoke/tests that
call actions in-process keep working unchanged (this is why smoke stays at
57/57 without assertion edits).

## The one-line call to wire (audit agent: verify these)

In each action module, import once:

```ts
import { guardMutation } from "./rate-limit"; // from lib/server/*
// or: import { guardMutation } from "@/lib/server/rate-limit";
```

Then as the FIRST line of each high-risk action body (before validation and
account-boundary checks, so abusive traffic is shed cheapest-first):

```ts
await guardMutation("<actionName>");
```

Required wiring (action → file):

(File locations updated by hardening pass 2, item 2: reads moved to
`server-only` read modules; every guarded mutation lives in a narrow
"use server" action file.)

| Action                | File                                    | Call                                          |
| --------------------- | --------------------------------------- | --------------------------------------------- |
| `draftAction`         | `lib/server/actions/index.ts`           | `await guardMutation("draftAction");`         |
| `approveAction`       | `lib/server/actions/index.ts`           | `await guardMutation("approveAction");`       |
| `rejectAction`        | `lib/server/actions/index.ts`           | `await guardMutation("rejectAction");`        |
| `recordDraftEdit`     | `lib/server/actions/index.ts`           | `await guardMutation("recordDraftEdit");`     |
| `dismissOpportunity`  | `lib/server/opportunities/actions.ts`   | `await guardMutation("dismissOpportunity");`  |
| `exportState`         | `lib/server/export.ts`                  | `await guardMutation("exportState");`         |
| `operatorChat`        | `lib/server/chat/actions.ts`            | `await guardMutation("operatorChat");`        |
| `saveOperatingRules`  | `lib/server/onboarding/actions.ts`      | `await guardMutation("saveOperatingRules");`  |
| `resyncConnection`    | `lib/server/onboarding/actions.ts`      | `await guardMutation("resyncConnection");`    |
| `resetDemoWorkspace`  | `lib/server/onboarding/actions.ts`      | `await guardMutation("resetDemoWorkspace");`  |
| `selectDemoVertical`  | `lib/server/onboarding/actions.ts`      | `await guardMutation("selectDemoVertical");`  |

`resetDemoWorkspace` moved from `app/(onboarding)/actions.ts` into
`lib/server/onboarding/actions.ts` in pass 2 (item 3) — the app-layer wrapper
now only redirects; exactly ONE `guardMutation("resetDemoWorkspace")` runs
per request. `selectDemoVertical` (Business Setup) was added to the guarded
set in the same pass.

Notes for the wiring agent:

- The string argument keys both the per-action rule lookup
  (`RATE_LIMIT_RULES`) and the log line — use the exact action name.
- If the P4 account guard has its own wrapper, calling
  `await guardMutation(name)` as that wrapper's first statement is
  equivalent and preferred (one line covers every guarded action).
- Do NOT wire into pure read paths that render pages (`listOpportunities`,
  `getPerformance`, audits): the composed guard is for mutations/expensive
  ops; reads get the P4 account boundary only. If a read is later deemed
  abuse-prone, pass an explicit rule:
  `await guardMutation("getPerformance", { rule: { max: 60, windowMs: 60_000 } })`.
- Limits are deliberately generous (default 30/min; see `RATE_LIMIT_RULES`
  for `resetDemoWorkspace` 5/min, `resyncConnection`/`exportState` 10/min,
  `operatorChat` 20/min) — the demo must stay usable.
- Error messages thrown by the guard are user-safe; additionally, Next
  redacts thrown Error messages from server actions in production, so
  nothing internal can leak either way.
- Production TODO (documented in `rate-limit.ts` header): inject a
  KV/D1/Durable-Object-backed `RateLimiter` via `setRateLimiter()` at
  startup; the in-memory default is single-process/per-isolate best-effort.
