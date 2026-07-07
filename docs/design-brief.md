# Design Brief — UI reskin (authored by Evgeny, July 2026)

Role: senior product designer + front-end engineer. RESKIN AND ELEVATE the existing UI. Do NOT rebuild, change product logic, routing, data flow, state, business rules, or copy (unless required for visual hierarchy). Do not remove functionality or screens. Improve: visual design, CSS architecture, spacing, layout polish, color system, typography, component styling, interaction states, responsiveness, accessibility, perceived product quality.

Feel: premium, modern, trustworthy, sharp, operator-led, calm, intelligent, commercially useful. NOT childish, generic-AI, legacy martech, BI dashboard, or enterprise CDP. Communicates: "This is the brand's own AI growth operator." Trust line: "Measured lift, not vendor math — and when we cannot prove it, we say so."

Aesthetic references: Linear, Vercel, Stripe, Retool, Notion AI, Mercury, Ramp, modern fintech. Clean, structured, decision-oriented. Avoid loud gradients, cartoon AI visuals, neon, heavy shadows, bloated cards, dashboard clutter.

UX principle: the loop obvious (Find money -> draft -> approve -> activate -> measure -> learn). Opportunity Feed = center of product. Operator Chat supportive, not dominant. Operating workspace, not chatbot wrapper.

## Tokens (CSS variables; adapt into Tailwind theme since repo uses Tailwind)
Base: --color-bg:#F7F8FA; --color-surface:#FFFFFF; --color-surface-soft:#F1F4F8; --color-surface-raised:#FFFFFF; --color-text-primary:#0F172A; --color-text-secondary:#475569; --color-text-muted:#64748B; --color-text-soft:#94A3B8; --color-border:#E2E8F0; --color-border-strong:#CBD5E1;
Primary (deep blue-black): --color-primary:#111827; hover #020617; soft #E5E7EB; muted #334155;
Accent (restrained electric blue, important highlights only): --color-accent:#2563EB; hover #1D4ED8; soft #DBEAFE;
Status: success #059669/soft #D1FAE5; warning #D97706/soft #FEF3C7; danger #DC2626/soft #FEE2E2; info #2563EB/soft #DBEAFE; directional #7C3AED/soft #EDE9FE; neutral-soft #F1F5F9.
Measurement pills: holdout-verified = green; before/after no control = amber; directional = violet/slate; blocked/stale = red; draft/pending = blue or neutral. Directional must NEVER look as strong as holdout-verified.
Spacing tokens: 4/8/12/16/20/24/32/40/48px (--space-1..12).
Typography: Inter, ui-sans-serif, system-ui stack. Page title 28-34px/700; section 18-22px/650; card title 15-18px/650; body 14-15px; supporting 13-14px; meta 12-13px. Tight but readable line-height; editorial and crisp, not oversized.

## Layout
Consistent gutters; strong card hierarchy; persistent left nav (clean, calm, clear active states, subtle borders + soft hovers, no heavy backgrounds); clean top bar with workspace/status + connection pills (Shopify/Klaviyo/Meta connected; GA4 recommended) — reliable, not flashy; clear main-vs-rail separation; no cramped tables or text walls.

## Components
- Opportunity cards = HERO component: clean title, value range, confidence pill, measurement pill, data-as-of meta, recommended action, clear CTA, subtle hover lift, strong-not-loud border; high-priority card may carry a subtle accent bar. No gradient abuse.
- Found-money header: premium, executive-ready — large value range, concise explanation, small trust label, note that directional opportunities are excluded; refined accent treatment.
- Approval cards: operational and safe; statuses (awaiting approval / approved / needs edit / blocked / draft created); CTAs visible, not aggressive.
- Measurement cards: trustworthy; three modes visually distinct; emphasize humility — confidence, window, caveats, next action.
- Operating Rules: control panel, not settings dump; clear editable fields (budget cap, max discount, daily send cap, margin floor, banned claims, suppression defaults); version history as elegant timeline.
- Context Ledger: audit-grade but readable — timeline rows, timestamp, event type, constitution version, measurement mode, expandable detail, muted metadata.
- Operator Chat: constrained assistant; elegant prompt chips; unsupported-v0 responses clear and helpful; not the whole product.

## Interaction + accessibility
Hover/pressed/focus/loading/empty/disabled/skeleton states; restrained 120-180ms transitions; collapsible details; modal/drawer polish where present. Contrast, semantic buttons, visible focus rings (:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }), keyboard nav, aria-labels, form labels, reduced-motion support.

## Responsive
Desktop/laptop/tablet/mobile: collapse side nav, stack cards, rail below main, CTAs visible, no horizontal overflow.

## Architecture + constraints
Repo uses Tailwind 4 — improve Tailwind classes + theme tokens (CSS variables) rather than fighting it. No heavy UI library, no backend deps, don't break click handlers, don't overcomplicate. Quality bar: demo, founder pitch, investor walkthrough, LinkedIn screenshot ready. Looks like a real product, not a wireframe.
