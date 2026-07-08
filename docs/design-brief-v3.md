# Design Brief v3 — "Make it pop" (authored by Evgeny, July 2026)
Second-round eye-candy pass. Supersedes v2 where they conflict; v2 still applies where v3 is silent. NO changes to: logic, routes, state, demo data, product rules, measurement semantics, approval gates, PRD behavior. Not chatbot-first. Concept: **"Revenue cockpit with proof rails"** — the UI visually expresses speed, decisioning, and proof. Diagnosis: clean but too restrained/flat; needs personality, depth, premium hierarchy, wow without noise. Feel: premium, intelligent, calm, visually rich, slightly futuristic, commercially serious, high-trust, screenshot-worthy (Linear polish, Vercel sharpness, Stripe gradients, Ramp/Mercury trust, Retool utility). AVOID: cartoon AI, crypto vibes, neon overload, generic SaaS cards, too much gray, bloated shadows, childish gradients, random blobs.

## Atmosphere tokens (add; keep existing palette foundation)
--glow-blue rgba(37,99,235,.24); --glow-emerald rgba(16,185,129,.22); --glow-violet rgba(124,58,237,.18); --glow-amber rgba(217,119,6,.16);
--gradient-orbit: radial-gradient(circle at 20% 10%, rgba(37,99,235,.16), transparent 34%), radial-gradient(circle at 80% 0%, rgba(16,185,129,.12), transparent 32%), linear-gradient(180deg,#F8FAFC 0%,#F1F5F9 100%);
--gradient-dark-panel: linear-gradient(180deg,#0B1220 0%,#111827 55%,#020617 100%);
--gradient-card-blue: linear-gradient(135deg, rgba(37,99,235,.12), rgba(255,255,255,.8) 42%, rgba(16,185,129,.08));
--gradient-found-money: radial-gradient(circle at 0% 0%, rgba(16,185,129,.20), transparent 35%), linear-gradient(135deg,#FFF 0%,#F8FFFC 52%,#EEFDF7 100%);
Use SELECTIVELY: app bg, login bg, found-money card, sidebar product mark, selected onboarding cards, hero stat cards. Not everywhere.
Utilities to add: .card-premium (white padding-box + 135deg blue->emerald gradient border-box, 1px transparent border, 0 18px 50px rgba(15,23,42,.08)); .glow-verified (0 18px 55px rgba(16,185,129,.16)); .glass-topbar (blur 18px, rgba(255,255,255,.78)); plus gradient-border, glass panel, measurement-pill, connector-status, timeline, skeleton utility classes.

## Typography: premium + editorial
Found-money value 48-64px desktop; page title 34-42; card title 18-21; section labels 11-12 uppercase letter-spaced; body 15-16. Monetary ranges = executive metrics. "Found money" + measurement labels feel designed, not default.

## Ten upgrade areas
1. LOGIN = launch-quality: rich soft atmosphere, radial glows, premium mark, stronger hero type, designed loop pills (small connectors, hover, light dimensionality), elevated sign-in card, better alpha pill, trust callout w/ accent rail + glow; optional mini Opportunity-Feed preview card; optional proof strip (Find money / Draft action / Human approval / Measured outcome). Left side = product narrative, not plain text.
2. APP SHELL = real console: gradient icon tile mark, active nav glow/rail, hover states, demo badge, separators, subtle dark gradient/texture, hierarchy brand>workspace>nav; top bar glassy/sticky, refined connector pills, better GA4 pill, compact spacing, subtle bottom border.
3. FOUND-MONEY CARD = ICONIC (screenshot hero): larger value type, subtle emerald glow, gradient surface, stronger left rail, small glossy/animated dot beside "Found money", trust microcopy, clear directional-excluded note, refined divider, better "Not counted in this total". Reads: "the Operator found money and can prove the limits of the claim."
4. OPPORTUNITY CARDS = decision-oriented: top accent rail by measurement mode (emerald/amber/violet — directional never as strong as verified), premium header, large value range, elegant badge alignment, two-column found/why panels w/ subtle bg, stronger action callout, intentional CTA area, hover lift + border glow, recipe-version/data-as-of meta row.
5. MEASUREMENT PILLS = product primitives: holdout emerald pill + dot + inner glow; before/after amber + caution dot; directional violet muted; confidence high=emerald / medium=blue-amber; blocked/stale=red. The system teaches what can be proven.
6. APPROVAL + ACTIVATION = safe: progress stepper w/ connected line (Governance checked / Holdout assigned / Pushed to Klaviyo / Awaiting final review markers), fallback ladder as controlled delivery system; Approve=dark primary, Edit=neutral, Reject=quiet secondary.
7. PERFORMANCE = premium proof: holdout-verified card authoritative (large range, window, eligible/holdout/exposed, confidence, caveat, next-action card); before/after useful but lesser; directional clearly different, never causal-looking.
8. OPERATING RULES = control room: editable number cards as key controls, version-history timeline, banned-claims chips, approval-requirement cards, "saving creates a new version" callout. Safe autonomy control surface.
9. LEDGER = audit-grade proof rails: event dot, timestamp, title, constitution_version, measurement mode, confidence, expandable reasoning, soft dividers, subtle grouping. Not a log dump.
10. CHAT = premium but secondary: chips, subtle input, response card, ledger-reference treatment, calm unsupported style. Never dominates the feed.

## Micro-interactions (restrained)
Cards lift on hover; pills brighten; sidebar active glows; found-money gradient shifts on hover; tactile pressed buttons; soft pulsing sync states; smooth ledger expand; onboarding selected cards elevate. 140-200ms ease-out, no bounce. Global kill-switch REQUIRED:
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }

## Decorative additions allowed (CSS-only, no logic changes, no image assets)
background orb, mini stat chips, connector pulse dots, measurement legend, proof-rail callout, "Operator confidence" visual meter, CSS empty-state illustrations, icon-like CSS elements, timeline dots, glass panels.

## Responsive + a11y
Eye-candy survives mobile: collapse sidebar, stack cards, scale hero numerals carefully, CTAs visible, no h-overflow, chat below/collapsible. Contrast strong, focus rings visible, semantic buttons, labels, NO color-only status (color + text always).

## Hard limits
Meta never in found-money; directional never looks holdout-verified; Operating Rules never Constitution in UI; smoke-greppable copy stays byte-identical (57 checks; revert tweaks, never edit smoke); no heavy deps, no image assets.
