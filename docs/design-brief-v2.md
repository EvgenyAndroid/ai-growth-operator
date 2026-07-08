# Design Brief v2 — "Premium growth cockpit" (authored by Evgeny, July 2026)
Supersedes design-brief.md where they conflict. Visual + UX ELEVATION PASS ONLY: no logic/route/state/data-model/demo-logic changes; no screens removed; not chatbot-first.

DIAGNOSIS: current UI clean but too plain — functional alpha, not premium product. Target feel: Linear, Vercel, Stripe, Mercury, Ramp, Retool, Notion AI — a growth command center, not a spreadsheet/legacy CDP/basic form app. Good enough for founder demo, investor walkthrough, deck, LinkedIn screenshots.

THEME: calm, confident, analytical, beautiful. Subtle visual drama: soft radial background glows, accent bars on priority cards, refined shadows, gradient borders, elevated + glassy panels, layered card depth, better badges/pills, clear separation of system status vs opportunity value vs action controls. AVOID: childish AI visuals, rainbow gradients, neon, dashboard clutter, huge empty whitespace, gray-on-gray, basic form-card look, blue pills everywhere, crypto-dashboard or AI-toy look.

## Tokens (add/refine; Tailwind theme since repo uses Tailwind 4)
--bg-app #F6F8FB; --bg-page #F8FAFC; --surface #FFF; --surface-soft #F1F5F9; --surface-raised #FFF; --surface-glass rgba(255,255,255,.78); ink-900 #07111F / 800 #0F172A / 700 #1E293B / 600 #334155 / 500 #64748B / 400 #94A3B8; borders #E2E8F0 / #CBD5E1; --primary #0B1220 hover #020617 soft #E2E8F0; --accent #2563EB hover #1D4ED8 soft #DBEAFE glow rgba(37,99,235,.22); verified #059669/#D1FAE5; warning #D97706/#FEF3C7; danger #DC2626/#FEE2E2; directional #7C3AED/#EDE9FE; shadows sm 0 1px 2px rgba(15,23,42,.06) / md 0 8px 24px .08 / lg 0 24px 60px .12; radius 8/12/18/24. Spacing 4..48 scale. Inter system stack. Type: hero 40-52, page title 30-38, section 18-22, card 16-19, body 14-16, meta 12-13 uppercase-where-useful; tighter headings, stronger contrast — typography must feel DESIGNED. Compact and premium, not sparse.

## Page direction
1. LOGIN/LANDING: refined radial glow bg, premium hero composition, wordmark treatment, glass/raised sign-in card, stronger trust callout (accent border), loop as elegant pill sequence, demo banner refined but clear.
2. ONBOARDING: guided product setup, not form wizard. Selected cards: subtle gradient surface + stronger border + soft blue glow + selected pill top-right. Polished inactive cards; better stepper active treatment.
3. APP SHELL: premium operator console. Sidebar: semi-dark option or refined light w/ strong hierarchy, product mark, demo badge, better active states; icons only if dependency-free. Top bar: elevated status pills, connected states, GA4 recommended, clear separation from content.
4. OPPORTUNITY FEED (most important): found-money card = hero object — white elevated card, subtle emerald left rail, faint green glow, LARGE value range, small "Found money" label, trust microcopy, directional-excluded note. Opportunity cards = operator recommendations: priority accent line, strong title, value range, confidence pill, measurement pill, data-as-of, two-column "what was found / why it matters", recommended-action callout, CTA, hover lift. Measurement pills: holdout=emerald, before/after=amber, directional=violet/slate — difference OBVIOUS; directional never as strong as verified.
5. OPPORTUNITY DETAIL: executive-ready recommendation — structured sections, soft panels/accordions, recipe version, confidence inputs, measurement plan, Operating Rules version, risks.
6. DRAFT REVIEW: safe pre-launch approval room — sequence/email step cards, offer logic, claim-check box, Approve draft (primary) / Edit (secondary) / Reject (tertiary, reason UI). No accidental actions.
7. APPROVAL CENTER: operations queue — compact rows: destination, measurement mode, confidence, Operating Rules version, status (awaiting/approved/blocked/draft created/needs edit), CTA.
8. ACTIVATION: progress timeline/stepper of the EXISTING states (draft prepared → governance checked → holdout assigned → pushed/level); fallback level as small badge; Meta: identifiers hashed, audience sent, match rate. Visualize existing data only — invent no states.
9. PERFORMANCE: strong measurement cards; holdout-verified card most authoritative; show window, eligible, holdout, exposed, revenue range, confidence, caveats, next action; directional never equally strong.
10. OPERATING RULES: modern control panel — editable numbers, banned claims, tone guide, suppression defaults, version history as subtle timeline. UI says Operating Rules, never Constitution.
11. LEDGER: audit timeline — event dot, timestamp, title, constitution_version, measurement mode, expandable reasoning. Audit-grade, not debug log.
12. OPERATOR CHAT: compact assistant panel, elegant prompt chips, calm unsupported responses. The feed is the product.

## Interaction + a11y + responsive
Hover/active/pressed, card elevation on hover, loading/syncing microstates, empty/blocked states, skeletons, modal/drawer transitions, collapsible ledger rows; 140-180ms; reduced-motion respected; focus-visible 2px accent ring; contrast, semantic buttons, labels, keyboard nav. 1440/laptop/tablet/mobile: collapse sidebar, stack cards, right rail below, CTAs visible, no h-overflow.

## Copy
Slight microcopy polish allowed BUT: the 57-check smoke suite greps rendered copy — any tweak that breaks an assertion must be reverted (never edit the smoke). Keep verbatim: AI Growth Operator, Opportunity Feed, Found money, Operating Rules, Holdout-verified, Before/after no control group, Directional only, Data as of, Measured lift not vendor math, when we cannot prove it we say so. No AI hype.

## DO NOT
No logic rebuild, no demo-mode/warning removal, no approval-gate removal, Meta never holdout-verified-looking, Meta never in found-money, no heavy dependencies, no chatbot-first.
