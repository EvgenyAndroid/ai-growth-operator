# AI Growth Operator

Agentic CDP for SMB and DTC brands. The system of decision, not another system of storage.

**Spec:** docs/PRD.md (PRD v1.1 — authoritative, incl. §26A Build Clarifications + §26B Engineering Defaults). Strategy: docs/BRD-v3.md.

**Status:** Alpha (PRD §25.1) — demo mode, mocked connectors, deterministic recipes, simulated activation + holdouts. No LLM calls in alpha: recipes are deterministic and Operator Chat is a constrained command interface (PRD §26A.3).

**Stack:** Next.js (App Router, TypeScript) + Prisma + Tailwind. Alpha runs SQLite for zero-setup local dev; the schema is Postgres-compatible and private beta flips the Prisma datasource to Postgres (PRD §26B.19).

Core loop: **Find money → draft action → approve → activate → measure → learn.**

Measured lift, not vendor math — and when we cannot prove it, we say so.
