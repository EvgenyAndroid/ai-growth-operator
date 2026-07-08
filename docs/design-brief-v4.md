# Design Brief v4 — third-pass premium enhancement (Evgeny, July 2026)
Supersedes v3 where conflicting. Visual identity/layout/interaction ONLY. No logic/data/recipe/measurement/approval/route changes; demo mode stays; not chatbot-first; no heavy deps, external fonts, or image assets. ONE logic-adjacent fix allowed: app/app-shell.tsx — if onboarding path renders {children} twice, fix to render once.
Concept: "Revenue cockpit with proof rails." Money found = tangible; Operator = trusted system; measurement labels = proof infrastructure; approvals = safe. Refs: Linear/Stripe/Vercel/Ramp/Mercury/Retool/Notion-AI/fintech cockpit. AVOID: crypto visuals, AI mascots, neon, SaaS sameness, gray cards, clutter, vague magic, directional-looking-verified.
HIGH-PRIORITY OUTCOME: login + Opportunity Feed screenshots materially more premium.
Weaknesses to fix: document/card feeling, weak visual signature, found-money not iconic enough, feed not center-of-product, static login, sidebar lacks cockpit identity, text-heavy cards not scan-first, content width too constrained, form-like onboarding, ledger/performance/activation need proof-rail feel.

## Tokens (globals.css, verbatim) + classes
--glow-money rgba(16,185,129,.28); --glow-proof rgba(37,99,235,.24); --glow-directional rgba(124,58,237,.18); --glow-warning rgba(217,119,6,.18);
--surface-money: linear-gradient(135deg, rgba(236,253,245,.98) 0%, rgba(255,255,255,.96) 44%, rgba(219,234,254,.74) 100%);
--surface-proof: linear-gradient(135deg, rgba(239,246,255,.96) 0%, rgba(255,255,255,.96) 54%, rgba(236,253,245,.70) 100%);
--mesh-cockpit: radial-gradient(circle at 12% 8%, rgba(37,99,235,.18), transparent 28%), radial-gradient(circle at 86% 10%, rgba(16,185,129,.13), transparent 28%), radial-gradient(circle at 50% -10%, rgba(124,58,237,.08), transparent 30%), linear-gradient(180deg,#f8fafc 0%,#eef3f8 100%);
.money-hero { background: var(--surface-money); box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 24px 80px rgba(16,185,129,.18); }
.proof-card { background: var(--surface-proof); border: 1px solid rgba(148,163,184,.28); box-shadow: 0 18px 48px rgba(15,23,42,.08); }
.card-shine::before { linear-gradient(120deg, transparent 0%, rgba(255,255,255,.42) 42%, transparent 62%); opacity .28; pointer-events none; } — use shine SPARINGLY. Also: subtle grid texture, ring highlights, status glows. CSS-only.

## Areas
APP SHELL: premium cockpit rail — lightweight inline-SVG/CSS nav icons (Feed/Chat/Approvals/Performance/Activation/Ledger/Export + Home), stronger active state (accent rail + blue glow), nav-group separator, bottom sidebar "proof rail" card: "Proof rails active" / "Holdout-verified where controlled. Directional where not." Premium gradient/texture on dark sidebar. Content width max-w-5xl → 6xl/7xl where useful. Better topbar pills + workspace badge. Mobile nav preserved.
LOGIN: SaaS launch screen — richer floating mini console/preview (found-money preview, holdout pill, approval-pending status, tiny proof rail Found→Drafted→Approved→Measured), connector/status chips around preview, mesh/radial atmosphere, visual loop. Communicates in 5s: finds money, drafts, waits for approval, measures honestly. Sign-in card stays elegant, not larger.
FEED (visual hero): wider canvas; two-column desktop — main (found-money + cards) + PRESENTATIONAL right rail "Operator status" (scan complete, Shopify+Klaviyo fresh, Meta directional only, proof mode note, next best action); rail stacks below on mobile.
FOUND-MONEY (iconic, money-hero class): larger bolder tabular value, "eligible only" microcopy, emerald proof glow, rail, 2-3 stat tiles (Eligible opportunities / Verified where possible / Directional excluded), proof label "Not counted: directional Meta opportunity", refined hover.
OPPORTUNITY CARDS (scan-first): header row (title+confidence+measurement), big value, meta strip (recipe version · data as of · type), two compact insight panels (found/why), strong action module, CTA strip (Review & draft / Dismiss), mode accent (emerald/amber/muted violet), CSS-only icons (revenue arrow, proof dot, warning dot, directional diamond).
MEASUREMENT SYSTEM: upgrade MeasurementBadge; holdout strongest, before/after cautionary, directional clearly softer (not bright purple); text never color-alone. Add MeasurementLegend (holdout=controlled proof / before-after=no control group / directional=platform, non-causal) in right rail or performance.
ONBOARDING: guided operator setup — stepper rail, premium selected cards (gradient/border/glow/pill), locked-not-broken disabled cards, CSS status graphics.
PERFORMANCE: proof-led cards — big label, window visible, revenue range prominent, eligible/exposed/holdout stat tiles, caveats visible not scary, next-action panel; directional clearly lesser.
ACTIVATION: controlled launch sequence timeline (existing states only). LEDGER: audit-grade vertical timeline, dots, grouping, expandable. CHAT: operator console, secondary.
PRIMITIVES (only if they reduce duplication): MetricTile, ProofRail, StatusDot, MeasurementLegend, PremiumCallout.

## Constraints
Smoke copy byte-identical (57 checks; revert tweaks, never edit smoke). Meta never in found-money; never "lift" for Meta; Operating Rules never Constitution. Responsive (sidebar collapse, scaled money type, stacked rail, no h-overflow). A11y: contrast, focus rings, semantics, no color-only status, reduced-motion respected. Light microcopy polish for hierarchy only.
