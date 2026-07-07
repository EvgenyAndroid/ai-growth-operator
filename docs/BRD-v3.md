# BRD v3: AI Growth Operator

## Working Product Name: AI Growth Operator

## Category Narrative: Agentic CDP For SMB And DTC Brands

## Changelog v2 → v3

* Restructured to a fixed 21-section build brief. Cut from 11,248 words to roughly 7,500. v2 was the strategy document; v3 is the build brief.
* Split MVP into v0 and v1. v0 is exactly three opportunity types on Shopify + Klaviyo + Meta Ads. Everything else is v1 or phase expansion, explicitly listed, not silently dropped.
* GA4 demoted from required to recommended. Minimum first value is Shopify + Klaviyo. The first magic moment does not depend on GA4.
* Added Opportunity Recipes: deterministic specs for all three v0 opportunity types, each with source signal, eligibility, exclusions, estimate formula, action, and measurement mode. Recipes are versioned; parameters are configurable with sane defaults.
* Scoped native holdouts to owned-channel lifecycle flows only. Paid media actions are measured directionally in MVP. No holdout-verified claims for Meta sync anywhere in this document.
* Updated the trust line: "Measured lift, not vendor math — and when we cannot prove it, we say so." Added measurement humility notes: messy SMB data, returns and refunds, labeled estimates where proof is unavailable.
* Named the constitution layers: Constitution (internal object), Operating Rules (user-facing), Guardrails (marketing), constitution_version (audit). UX and FR sections now say "Operating Rules" throughout.
* Repositioned LLM discoverability as a P0 beta insight shipping in MVP v1. First version is a Readiness Scan. Full prompt-panel Share of Prompt monitoring is the later evolution, kept as one labeled paragraph.
* Corrected the architecture claim. The product stores governed working memory, not a second customer system of record. No "data does not move" language.
* Rewrote pricing: flat monthly plus action credits; success fee removed from the core motion; an optional performance fee exists only on managed/agency plans. Never priced per contact.
* Added the First 7 Days journey (Day 0/1/3/7). It drives onboarding, lifecycle comms, and the demo script.
* Added composite confidence scoring, folded epics and screens into sequenced v0 build guidance, and updated the Definition of Done to match all of the above.

## 1. Executive Summary

Build an Agentic CDP for SMB marketers, sold as the AI Growth Operator.

It is not a smaller enterprise CDP, not a warehouse-native dashboard, and not a segment builder. It is an always-on operator that connects to the tools an SMB already uses, finds revenue opportunities in the data, drafts the action, gets human approval, activates through the existing channels, and measures what changed. Where it can prove lift with a holdout, it does. Where it cannot, it says so.

The user meets one Operator, not a committee of agents. One feed, one approval queue, one audit trail.

MVP v0 serves one merchant profile deeply: a Shopify DTC brand with a Klaviyo list and a Meta Ads account. v0 ships exactly three opportunity types (abandoned checkout recovery, lapsed customer win-back, high-LTV Meta audience seed), Klaviyo email drafts, Meta audience sync, an approval workflow, a context ledger, holdouts on Klaviyo lifecycle flows, and a plain-English performance summary. That is the whole product at v0, and it is enough to prove the loop.

The hero requirement: the first ranked opportunity, with a dollar estimate attached, appears within 60 minutes of the first OAuth connection, ideally in the same session. Week-one success is one approved action with one measured outcome.

The product promise: "Connect your tools. Review what the Operator found. Approve the action. See what changed."

The core thesis: the old CDP helped marketers activate customer data. The Agentic CDP helps marketers decide what to do next.

## 2. Product Thesis

SMB marketers do not have a data problem in the enterprise sense. They have an action problem. Their customer truth is scattered across Shopify, Klaviyo, Meta, GA4, Stripe, and spreadsheets. Each tool holds a fragment; none of them decides. The common response today is surrender: hand the budget to Meta or Google, turn on the platform's automation, and hope. That default, not another SaaS tool, is the real competitor.

This product is the translation layer between fragmented customer data and measurable marketing action. It is the system of decision, not another system of storage.

"The Operator does not replace Klaviyo, Meta, Shopify, or Google. It decides what should happen across them."

On architecture: the product does not create another full customer system of record. It reads from source systems, stores only the working context needed to reason, act, audit, and measure, and points back to the source wherever possible. The system of record remains the connected platform.

On honesty, the flagship line: **"Measured lift, not vendor math — and when we cannot prove it, we say so."** The agentic-marketing category grades its own homework. This product ships its own audit, and it is candid about the audit's limits.

### Trust Commitments

1. **Per-decision reasoning logs.** The Context Ledger records what the Operator saw, why it acted, and which constitution_version was in force. Every decision is reconstructable.
2. **Native holdouts where the product controls the channel.** Owned-channel lifecycle flows above an audience threshold carry an automatic holdout. Lift reports as a range against it. Paid media reports directionally in MVP (Section 12).
3. **Hard approval gates.** Spend, sends, suppression changes, and anything public-facing require explicit human approval. Enforced by the governance runtime; not configurable away in MVP.
4. **Exportable state.** Customer context, audiences, Operating Rules, and learned preferences export to open formats at any time. No hostage state.
5. **No dark autonomy.** Autopilot, when it eventually exists, is scoped, revocable in one action, and logged. There is no mode where the Operator acts and the owner cannot see it.
6. **Checked claims.** Creative output is checked against connected product data. Unsupported claims are flagged before approval; the brand owns what it publishes, and the product's job is to keep the brand from publishing what its own data cannot support.

## 3. MVP Wedge

**"MVP proves one loop: find money -> draft action -> approve -> activate -> measure."**

One vertical: Shopify DTC. One merchant profile: a Shopify store with a Klaviyo list and a Meta Ads account.

### MVP v0

* **Connectors:** Shopify, Klaviyo, Meta Ads. GA4 is recommended, not required (see Section 8). Minimum first value is Shopify + Klaviyo alone; Meta unlocks the paid opportunity.
* **Opportunity feed with exactly three opportunity types:**
  1. Abandoned checkout / cart recovery
  2. Lapsed customer win-back / repeat purchase
  3. High-LTV Meta audience seed + purchaser suppression
* **Klaviyo email draft** pushed as a draft flow the merchant reviews and approves.
* **Meta audience sync** (custom audience, lookalike seed, suppression) on approval.
* **Approval workflow** with edit and reject-with-reason.
* **Context Ledger** with constitution_version stamped on every action.
* **Holdouts for Klaviyo lifecycle flows only** (Section 12).
* **Plain-English performance summary.**

These three opportunity types are v2's JTBD 1–3 (recover lost revenue, increase repeat purchase, improve acquisition quality) turned into deterministic recipes (Section 7).

### MVP v1

* LLM discoverability beta (Readiness Scan, Section 14)
* SMS drafts, with quiet hours and consent provenance enforcement
* Google Customer Match
* Google Merchant Center
* Richer constitutions (more vertical templates, more editable rules)
* Optional performance fee for managed/agency plans
* Agency workspace (multi-client)

### Explicit Expansion (not v0, not dropped)

v2's JTBD 4–7 remain on the roadmap as phase expansion:

* **JTBD 4, churn reduction:** risk detection beyond the win-back recipe, retention interventions.
* **JTBD 5, faster campaign launch:** plain-English goal to full campaign brief on demand.
* **JTBD 6, explain performance beyond the v0 summary:** cross-channel diagnosis, budget reallocation advice.
* **JTBD 7, LLM shoppability:** full Share of Prompt monitoring and content workflows beyond the v1 Readiness Scan.

Also expansion: WooCommerce, Mailchimp, Postscript/Attentive, CRM, support/VoC, TikTok/Pinterest/LinkedIn, autopilot mode, publishing workflows.

## 4. ICP

Primary: SMB and mid-market DTC brands with real customer data, active channels, and lean teams.

Launch profile: Shopify merchant, $1M–$50M annual revenue, marketing team of 1–10, active email list of 5,000+ contacts, spends on Meta, runs email campaigns, wants growth but lacks analytical and operational bandwidth.

Avoid in MVP: businesses with no first-party data, pre-traction companies, heavily regulated sectors, enterprise accounts needing clean rooms or MDM, pure media buyers with no commerce data, and anyone expecting autonomous spend without approval.

### Persona Sketches

* **Founder / owner-operator.** Needs revenue, has no time. Asks: "What should I do this week to grow sales?" Wants plain English and confidence nothing will break.
* **SMB growth marketer.** Owns campaigns and reporting. Asks: "Which audience, offer, and channel next?" Does not want to hand-build every audience.
* **Lifecycle / CRM marketer.** Owns email, retention, win-back. Asks: "Who should I talk to, what should I say, and when?"
* **Agency operator.** Runs many SMB accounts. Asks: "What can I show the client and activate quickly?" Needs repeatable detection and client-ready explanations. Served properly at v1 with the agency workspace.
* **Fractional CMO.** Owns strategy, not execution. Asks: "Where is the leverage and how do we prove it?"

## 5. Core Loop

The product does not start with a dashboard. It starts with an opportunity feed.

The loop, which every screen and every requirement serves:

1. **Find money.** Scan connected data against the recipe library; post ranked opportunity cards with dollar estimates.
2. **Draft action.** Turn the selected opportunity into a concrete draft: audience, copy, offer, suppression, measurement plan.
3. **Approve.** Human reviews, edits, approves, or rejects with a reason.
4. **Activate.** Push the approved action to Klaviyo or Meta, or export it as a brief.
5. **Measure.** Read results back; report lift against a holdout where one exists, directionally where it does not.
6. **Learn.** Feed outcomes, edits, dismissals, and rejection reasons back into ranking and drafting.

Opportunities are stateful, not static cards: found → sized → proposed → drafted → approved → launched → measured → learned | dismissed. Dedup keys prevent re-issuing the same card; dismissals capture a reason and start a cooldown; estimates decay and re-verify; the feed caps at roughly 5 active cards; every card shows a data-as-of stamp.

## 6. First 7 Days

The first week is a designed journey, not an accident.

* **Day 0.** User connects Shopify + Klaviyo. The first opportunity appears in the same session: abandoned checkout recovery, with a dollar estimate. The Operator drafts the recovery flow.
* **Day 1.** User approves the Klaviyo draft. If the eligible audience is 500 or more, a 10% holdout is assigned automatically and shown on the approval screen.
* **Day 3.** First early read: sends, opens, clicks, early recovered orders, clearly labeled as early.
* **Day 7.** First performance summary in plain English, the next recommended action, and the Meta audience opportunity (if Meta is connected, the sync draft; if not, the connect prompt with the sized reason to connect).

This journey drives onboarding, lifecycle comms, and the demo script. If any step cannot happen for a given account (audience too small, no abandoned checkouts), the Operator says why and shows the nearest available opportunity instead.

The reference first-run flow: sign up, select business type, pick Operating Rules and edit three numbers, connect Shopify, connect Klaviyo, watch data readiness build, and see the first opportunity card in the same session. Review it, edit the offer (the governance runtime confirms it clears the discount ceiling and margin floor), approve, and the flow lands in Klaviyo as a draft with the holdout already assigned and shown.

## 7. Opportunity Recipes

Recipes make v3 buildable. Each v0 opportunity type is a deterministic recipe: a versioned spec the Opportunity Engine executes, not a vibe the model improvises. Recipes are versioned; every opportunity records the recipe version that produced it. Recipe parameters (the X hours, percentiles, and thresholds below) are configurable per account with sane defaults.

### Recipe 1: Abandoned Checkout Recovery

* **Source signal:** Shopify `checkout_started` without a purchase within X hours (default 4).
* **Eligibility:** email consent or an existing Klaviyo profile.
* **Exclusions:** purchased since the checkout; suppressed; unsubscribed; already in an active recovery flow.
* **Estimate formula:** eligible users × historical recovery rate × average order value. Reported as a range.
* **Action:** Klaviyo draft flow (non-discount reminder first; incentive step stays inside the Operating Rules' discount ceiling and margin floor).
* **Measurement mode:** 10% holdout if eligible audience ≥ 500; otherwise before/after with an explicit "no control group" tag.

### Recipe 2: Lapsed Customer Win-Back

* **Source signal:** purchase-interval gap versus the customer's own historical cadence: current gap > 1.5× the customer's personal median purchase interval, or > the category median interval for one-time buyers.
* **Eligibility:** email consent or an existing Klaviyo profile.
* **Exclusions:** already in an active recovery or win-back flow; purchased recently; suppressed; unsubscribed.
* **Estimate formula:** eligible customers × historical win-back rate × average order value. Reported as a range.
* **Action:** Klaviyo draft flow.
* **Measurement mode:** 10% holdout if eligible audience ≥ 500; otherwise labeled before/after.

### Recipe 3: High-LTV Meta Seed + Purchaser Suppression

* **Source signal:** Shopify orders.
* **Eligibility:** top 10–20% of customers by revenue, frequency, and recency (configurable percentile).
* **Exclusions:** refund-heavy customers from the seed; recent purchasers for the suppression set.
* **Estimate formula:** none stated as recovered revenue. The card sizes the audience and states the expected use (better lookalike seed, wasted-spend suppression), labeled directional.
* **Action:** Meta custom audience + lookalike seed, plus a suppression audience of recent purchasers, synced on approval.
* **Measurement mode:** directional downstream performance. Not holdout-verified in MVP.

### Confidence Scoring

Every opportunity carries a confidence label computed as a simple composite over: data freshness, audience size, consent eligibility, historical baseline availability, direct activation availability, measurement quality, and source completeness.

* **High:** fresh data, audience > 500, direct channel available, consent clear, historical baseline exists.
* **Medium:** some gaps, or a smaller audience.
* **Low:** directional insight only, weak measurement, or a beta module.

Confidence is shown on the card, on the approval screen, and on the report. It is an input to ranking, alongside estimated value, urgency, ease of execution, risk, and past dismissal reasons for similar opportunities.

## 8. Data Sources

### MVP v0 Connectors

* **Shopify** (required for first value): customers, orders, products, checkouts.
* **Klaviyo** (required for first value): lists, flows, campaigns, engagement, consent.
* **Meta Ads** (the paid opportunity): audiences, campaigns, spend, performance. Optional at connect time; Recipe 3 activates when it is present.
* **GA4** (recommended, not required): enhanced measurement, site behavior, and later AI-referral visibility. The first magic moment must not depend on GA4. If GA4 is absent, the Operator recommends it as the next connection and says what it would add.
* **Stripe, read-only, optional:** payments and failed-payment context.

### MVP v1 Sources

Google Ads (Customer Match), Google Merchant Center, Klaviyo SMS as an activation surface.

### Later

WooCommerce, Mailchimp, Postscript/Attentive, CRM (HubSpot, Pipedrive), support/VoC (Gorgias, Zendesk, Intercom), Google Search Console, site/content crawl, TikTok/Pinterest/LinkedIn.

### Integration Philosophy

Connect and read from source systems; do not require SMBs to centralize data into a new warehouse before value appears. API reads, webhooks where available, periodic sync, source pointers, minimal operational cache, consent-aware activation. Every connector reports sync status and data freshness, because launches gate on freshness: a launch is blocked with a plain explanation and a re-sync action when the relevant source sync is older than its threshold.

## 9. Customer Context Layer

**"The product stores governed working memory, not a second customer system of record."**

The product does not create another full customer system of record. It reads from source systems, stores only the working context needed to reason, act, audit, and measure, and points back to the source wherever possible. Governance is consent flags, Operating Rules, and audit logs, not a catalog.

### Components

1. **Source connectors** with per-source freshness tracking.
2. **Context normalizer** mapping source data into the working model below.
3. **Customer Context Layer**: the minimal, permission-aware working memory.
4. **Context Ledger**: the per-decision audit trail. Each entry records timestamp, user, skill invoked, constitution_version in effect, source data used, reasoning summary, confidence, approval status, destination, action taken, rollback path where possible, and measured outcome.
5. **Opportunity Engine**: executes recipes, owns the opportunity lifecycle, dedup, decay, cooldowns, and the feed cap.
6. **The Operator** and its skills (Section 10).
7. **Governance runtime** (Section 11).
8. **Activation layer**: Klaviyo drafts, Meta audience sync, brief exports; enforces the freshness gate.
9. **Measurement layer**: home of the Prove-It Engine (Section 12).

### v0 Data Model

What v0 actually needs. Later extensions are marked.

* **Customer:** customer_id, source_customer_ids, email_hash, consent_email, consent_provenance (source, method, timestamp per identifier), lifecycle_stage, first/last_purchase_date, total_orders, total_revenue, purchase_interval_stats (personal median), refund_rate, suppression_status, holdout_memberships, source_references. *Later: phone_hash + consent_sms (v1 SMS), predicted_ltv, churn_risk_score, preferred_channel, inferred_timezone (v1 quiet hours).*
* **Product:** product_id, source_product_id, name, category, price, availability, product_url, structured_attributes. *Later: margin_estimate, llm_readiness_score, schema_status (v1 Readiness Scan).*
* **Event:** event_id, customer_id, event_type, event_timestamp, source, product_id, campaign_id, value, metadata. v0 event types: checkout_started, purchase, repeat_purchase, refund, email_open, email_click, unsubscribe, audience_synced. *Later: sms_click, ad_click, ai_referral_visit.*
* **Audience:** audience_id, name, creation_method, inclusion_rules, exclusion_rules, size, eligible_channels, consent_requirements, last_synced_at, destination_status.
* **Action (campaign/flow/sync):** action_id, type, objective, channel, audience_id, status, created_by, approved_by, launched_at, constitution_version, holdout_id (nullable), measurement_mode (holdout | before_after_no_control | directional), expected_outcome, measured_outcome, lift_low/lift_high (holdout mode only), confidence_level, source_references.
* **Opportunity:** opportunity_id, dedup_key, recipe_id, recipe_version, title, category, estimated_value_low/high, confidence, data_as_of, estimate_verified_at, recommended_action, status (found | sized | proposed | drafted | approved | launched | measured | learned | dismissed), dismissed_reason, cooldown_until, outcome.
* **Constitution:** constitution_id, template_vertical, version, monthly_budget_cap, max_discount_percent, margin_floor_percent, daily_send_cap, frequency_caps, blackout_dates, tone_guide, banned_claims, suppression_defaults, approval_requirements, effective_from, superseded_by. *Later: sms_quiet_hours (v1).*
* **Holdout:** holdout_id, action_id, eligible_audience_size, holdout_percent, holdout_size, assignment_method (randomized, customer-level), started_at, exclusion_window, status, measured_lift_low/high, confidence.
* *Later entities: PromptTest and ReadinessScan (v1 discoverability), Lead/Deal (CRM expansion).*

## 10. Operator + Skills

There is one Operator. The SMB owner delegates to a colleague; they do not chair a committee. Internally the Operator is composed of skills: scoped capabilities with defined inputs, outputs, and permissions. Skills are invisible as personalities; the user talks to the Operator, which uses its skills.

v0 skills:

* **Context Skill:** connect tools, validate permissions, build customer context, report data readiness, recommend the next connection.
* **Opportunity Skill:** execute recipes, rank, maintain the lifecycle, learn from dismissal and rejection reasons.
* **Lifecycle Skill:** draft Klaviyo flows, audience logic, timing, suppression rules.
* **Paid Audience Skill:** build Meta seed, lookalike, and suppression audiences; recommend but never execute budget changes.
* **Creative Skill:** draft copy under the Operating Rules' tone guide; check claims against product data and flag anything the data cannot support.
* **Offer Skill:** recommend offer logic against the discount ceiling and margin floor; prefer non-discount alternatives.
* **Measurement Skill:** assign holdouts at launch on eligible lifecycle flows, compute lift as ranges, produce the plain-English summary, label confidence.

*v1 adds the Discoverability Skill (Readiness Scan).*

Two things are deliberately not skills:

* **Governance is the runtime, not a skill.** Every action from every skill passes through the governance runtime on its way to activation: permissions, budgets, consent, frequency, approvals, all read from the active constitution_version. A governance agent among peers is a policy suggestion; a runtime every action travels through is a guarantee.
* **Explanation is the output contract, not a skill.** Every skill output ships in one mandatory format: what was found / why it matters / what data was used and how fresh / what assumptions were made / what risk exists / what approval is needed / how success will be measured. If an output does not carry the contract, it does not render.

## 11. Operating Rules / Constitution

One concept, four names, used consistently:

| Layer | Name |
|---|---|
| Internal object | Constitution |
| User-facing label | Operating Rules |
| Marketing phrase | Guardrails |
| Audit phrase | constitution_version |

The author's framing, verbatim: "Pick your Operating Rules. You can change them anytime. Every Operator action is logged against the version active at the time."

All UX and FR sections in this document say "Operating Rules." The ledger and all audit language keep `constitution_version`.

### What They Are

The Operating Rules are the complete rulebook the Operator runs under: what it may spend, what it may promise, when it may speak, what it must never say. SMB owners will not design an action space from blank settings, so the product ships templates, not settings pages.

v0 ships one template: **Shopify DTC** (with a beauty/wellness banned-claims variant). v1 adds richer constitutions: subscription commerce, local service, small B2B services, and more editable rules including SMS quiet hours with timezone inference.

### Onboarding Model

Pick your Operating Rules, edit three numbers:

1. Monthly budget cap
2. Maximum discount
3. Daily send cap

Everything else starts from the template and is editable later. This is the entire guardrail setup required before the Operator goes to work.

### Versioning

Every edit creates a new version. Every Operator action logs the constitution_version in force in the Context Ledger. When an owner asks "why did the Operator do that in March," the answer includes the exact rulebook active in March.

### Permission Modes

Progressive autonomy, five modes: Observe (monitor and report), Recommend (suggest, no assets), Draft (create audience/copy/offer/plan, no launch), Approve and Execute (launch only after explicit approval), Autopilot with Guardrails (execute within predefined rules; always scoped, revocable in one action, and logged).

MVP default is Draft + Approve and Execute (Modes 3 and 4). Autopilot is not in MVP and is never a default. Hard approval gates on spend, sends, suppression changes, and anything public-facing cannot be configured away in MVP.

## 12. Prove-It Engine

The category's deepest trust problem: the tool that spent the money also reports whether the money worked. This product ships its own audit, and it is honest about the audit's boundaries.

**"Holdout-verified lift is limited to owned-channel lifecycle flows in MVP; paid media actions are measured directionally until stronger incrementality controls are added."**

In MVP, native holdouts apply to owned-channel lifecycle flows where the product can control eligibility and suppression. Paid media actions use directional downstream reporting until incrementality controls are added.

### Holdout Mechanics (owned-channel lifecycle flows only)

* Applies to Klaviyo email flows and recurring lifecycle campaigns the Operator launches.
* Requires eligible audience ≥ 500.
* Assignment is randomized at the customer level at launch time, with clean exclusion windows so held-out customers are not reached by the same flow through another path.
* Default holdout: 10% of the eligible audience, tracked identically.
* Lift reports as a range, never a point. "Recovered $14,200–$17,800 versus holdout" is honest; "$16,000 recovered" is theater.
* Where the eligible audience is under 500, the product falls back to labeled before/after measurement with an explicit "no control group" tag rendered on the report, not in fine print.
* Holdout assignment, size, and duration are logged in the Context Ledger; holdout membership is visible per customer.

### Paid Media In MVP

Meta audience syncs report directional downstream performance: match rates, downstream purchases from synced audiences, spend context where available. No lift claim, no holdout language, anywhere: not on cards, not on approval screens, not in metrics, not in the Definition of Done.

### Measurement Humility

The flagship line: **"Measured lift, not vendor math — and when we cannot prove it, we say so."**

**"When the system cannot prove lift, it says so clearly."**

Holdouts have caveats and the product states them. SMB data is messy. Returns, refunds, shipping delays, and duplicate customer records can distort revenue readings; the product nets refunds where the data allows and labels the residual uncertainty. Where proof is unavailable, numbers ship as labeled estimates, never as verified results. Flows that do not beat their holdout get flagged for revision or retirement, which disciplines the Operator itself.

## 13. Activation Channels

Activate deeply where the wedge merchant lives; export briefs everywhere else.

### MVP v0

1. **Klaviyo email drafts.** The Operator pushes campaigns and flows into Klaviyo as drafts. The merchant reviews and approves. Lifecycle, recovery, and win-back use cases.
2. **Meta audience sync.** Custom audiences, lookalike seeds, and purchaser-suppression audiences pushed on approval.
3. **Exportable briefs.** Any recommendation without a direct rail ships as a complete brief: audience definition, copy, offer logic, suppression rules, measurement plan. The brief is the universal fallback and the agency handoff format, a first-class deliverable, not a degraded mode.

### MVP v1

* **SMS drafts**, only with a connected SMS tool (Klaviyo SMS first). Quiet hours with timezone inference and consent provenance per identifier are enforced by the governance runtime before any SMS capability ships. No SMS capability is simulated when no rail is connected.
* **Google Customer Match** audience sync.
* **Google Merchant Center** feed improvements.

Later: CRM tasks, support/VoC, TikTok/Pinterest/LinkedIn, on-site personalization, publishing workflows.

All launches gate on data freshness: stale source sync blocks the launch with a plain explanation and a re-sync action.

## 14. LLM Discoverability Beta

Positioning: a P0 beta insight, not an activation channel. It ships in MVP v1, clearly labeled beta, scoped to audit and recommendations. Nothing publishes.

### First Version: The Readiness Scan

The Readiness Scan answers "is this brand legible to AI buying surfaces?" using the merchant's own data and site:

* Product schema readiness (structured data completeness per product)
* FAQ gaps
* Comparison content gaps
* Merchant Center completeness
* Brand entity consistency across owned site, feeds, and public profiles
* Product page clarity (can a machine tell what it is, who it is for, why it matters, how to buy)
* A small AI answer visibility **sample**: a handful of representative buyer prompts, run a few times, reported as an illustrative range with a confidence label of Low, never as a tracked metric

Output: a readiness score, a prioritized gap list, and recommendations delivered as briefs. Confidence on all Readiness Scan opportunities is Low or Medium by definition (beta module, directional measurement).

### The Later Evolution

Full Share of Prompt monitoring is the later stage, not MVP machinery. In summary: versioned prompt panels (~50 prompts per category), repeated trials (~3 runs) on a plan-tier cadence, all visibility metrics reported as ranges within a panel version, disclosed model and surface mix, trend lines restarting when a panel changes, sampling disclosed for cost control, and prompt-to-visit / prompt-to-sale tracked directionally where sources permit. That methodology is retained as the roadmap for this module; none of it is v0 or v1 scope beyond the small sample above.

## 15. UX Requirements

All guardrail language in the UI says "Operating Rules."

### Home Screen: Opportunity Feed

Ranked opportunities led by a found-money header: summed estimated recoverable revenue across active opportunities, as a range. Feed rules: maximum ~5 active cards, every card shows data-as-of, stale estimates re-verify before action, dedup on re-detection, dismissal captures a reason and starts a cooldown.

Example card 1:

> **Recover $16,200–$20,600 in abandoned checkout revenue**
> 612 shoppers started checkout in the last 14 days but did not purchase. Data as of 2 hours ago.
> Recommended action: recovery email flow in Klaviyo, non-discount reminder first.
> Measurement: eligible audience is 612, above the 500 threshold, so 10% will be held out automatically. Recovered revenue reports against the holdout, as a range.
> Approval needed: copy, offer, launch timing. Confidence: High. CTA: Review plan.

Example card 2:

> **Your best customers are missing from your Meta lookalike seed**
> Top 15% of customers by revenue, frequency, and recency: 1,840 people. Recent purchasers are not being suppressed.
> Recommended action: sync high-LTV seed + purchaser suppression to Meta.
> Measurement: directional downstream reporting. This action is not holdout-verified.
> Approval needed: audience sync. Confidence: Medium. CTA: Build audience.

Example card 3:

> **Win back $8,400–$11,900 from lapsed customers**
> 486 customers are past 1.5× their own usual reorder gap and have not been contacted by a win-back flow. Data as of today.
> Recommended action: win-back email flow in Klaviyo, non-discount angle first.
> Measurement: eligible audience is 486, below the 500 threshold, so results report as before/after with a "no control group" tag.
> Approval needed: copy, offer. Confidence: Medium. CTA: Review plan.

### Review Screen

Goal, audience, source data used with data-as-of, inclusion and exclusion rules, channel, message, offer, projected impact as a range, measurement plan (holdout plan, "no control group" tag, or "directional" label as applicable), Operating Rules version in effect, confidence, risks, and three buttons: approve, edit, reject with reason capture.

### Operator Chat

Plain-language asks the v0 Operator must handle: "What should I do this week to grow revenue?", "Build a win-back campaign for customers who have not purchased in 90 days.", "Create a Meta lookalike from my best customers.", "What did the holdout show on the cart recovery flow?", "What can I do without offering a discount?", "Draft a campaign but do not launch it." Every answer follows the explanation contract.

### Performance Screen

Answers: What happened? What was the lift against the holdout, or the directional read where no holdout applies? Why? What next? How confident are we? What data was used and how fresh was it? No raw dashboard as the default view.

### The Magic Moment

* First ranked opportunity with a dollar estimate within 60 minutes of first OAuth; target same session.
* First feed leads with found money.
* Week-one success: one approved action, one measured outcome.

## 16. Functional Requirements

**FR1 Onboarding.** Create account; select business type and primary goal; connect Shopify and Klaviyo (Meta optional, GA4 recommended); pick Operating Rules; edit the three numbers (monthly budget cap, max discount, daily send cap); confirm brand voice seeded from the template; set approval mode (default Draft + Approve). Completable in one sitting in service of the 60-minute target.

**FR2 Data connection.** Show connected sources, sync status, last sync and freshness against the launch-gate threshold, available and missing data, permission issues, and the recommended next connection.

**FR3 Customer context.** Build the v0 working memory of Section 9: lifecycle stages, purchase summaries, consent with provenance per identifier, suppression status, source references.

**FR4 Opportunity detection.** Execute the three v0 recipes on their versioned specs. Manage the full lifecycle with dedup, cooldowns, estimate decay and re-verification, max ~5 active cards, data-as-of on every card. Rank on estimated value, urgency, audience size, confidence, ease, available channels, consent eligibility, risk, and past dismissal reasons.

**FR5 Audience builder.** Create audiences from recipe logic and plain-English instructions with transparent rules: size, rule logic, source data, exclusions, consent eligibility, destination compatibility.

**FR6 Drafting.** Produce drafts containing objective, audience, channel, copy, sequence, offer, timing, suppression rules, and a measurement plan that assigns a holdout for eligible Klaviyo lifecycle flows and labels everything else.

**FR7 Activation.** Exactly: email drafts pushed to Klaviyo; Meta custom/lookalike/suppression audience sync; exportable briefs for everything else. Launches blocked on stale source sync with a plain explanation and re-sync action. (v1 adds SMS drafts with a connected tool, Customer Match, Merchant Center.)

**FR8 Approval.** Explicit approval required for campaign launch, audience sync, budget changes, discount offers, suppression changes, and anything public-facing. Reject captures a reason.

**FR9 Guardrails.** The governance runtime enforces, per the active constitution_version: consent with provenance, suppression, budget limits, frequency caps, tone and banned claims, discount ceiling and margin floor, blackout dates, user permissions, channel policies. Every enforcement decision logs the constitution_version applied. (v1 adds SMS quiet hours with timezone inference.)

**FR10 Measurement.** Read performance from source systems. For eligible Klaviyo lifecycle flows: lift vs holdout as a range. Below threshold: before/after with the "no control group" tag. Meta actions: directional downstream reporting, labeled as such. Also: revenue net of refunds where data allows, conversions, repeat purchase, click and conversion rates, audience sync status.

**FR11 Explanation.** Every recommendation and outcome ships in the fixed contract: found / why / data and freshness / assumptions / risk / approval needed / measurement plan. No unexplained output renders.

**FR12 Data freshness.** Data-as-of on every opportunity; per-source freshness thresholds, editable; launches gate on them.

**FR13 Export.** Customer context, audiences, Operating Rules, and learned preferences export to open formats at any time.

Non-functional, compressed: OAuth and encrypted credentials, least privilege, role-based access, audit logs; consent-aware activation, PII minimization, hashed identifiers for ads, retention policies, user-controlled deletion; sync retries, destination failure alerts, rollback or pause where possible; multi-tenant with account-level separation and a modular connector framework.

## 17. Measurement Framework

Three measurement modes, labeled everywhere: **holdout-verified** (Klaviyo lifecycle flows, audience ≥ 500), **before/after, no control group** (small owned-channel audiences), **directional** (paid media, beta modules). No metric may present a directional number as verified lift.

### Business Metrics

* Time-to-first-opportunity (target: under 60 minutes from first OAuth)
* Found-money-shown on first feed
* Week-one success rate: accounts with one approved action and one measured outcome in week one
* Opportunity-to-action rate; approval rate; time to first launch
* Recovered revenue, holdout-verified (owned-channel flows only)
* Lift vs holdout by flow; repeat purchase uplift
* Directional downstream performance of synced Meta audiences
* Retention and expansion

### Product Usage

Weekly actives, opportunities viewed/approved/rejected/dismissed with reasons, chat sessions, drafts, launches, audiences synced, reports generated.

### Agent Quality

* Recommendation acceptance rate and user edit rate
* Rejection and dismissal reasons fed back into ranking
* Unsupported-claim flag rate
* False-positive opportunity rate
* Confidence calibration: do stated High/Medium/Low labels match realized outcomes
* Flows failing to beat their holdout, flagged for revision

Confidence scoring feeds this framework: the composite of Section 7 (freshness, audience size, consent, baseline, activation availability, measurement quality, source completeness) is recorded per opportunity so calibration can be audited.

## 18. Pricing

**Never priced per contact.** SMBs are punished by contact-tier pricing in every tool that holds their list, and they resent it, correctly. Value here comes from actions taken and revenue recovered, not rows stored.

Structure:

* **Starter:** flat monthly fee. Core connectors, opportunity feed, Klaviyo drafts, exportable briefs, performance summaries.
* **Growth:** flat monthly fee + action credits. Everything in Starter plus Meta audience sync at higher volume, v1 modules as they ship (SMS drafts, Customer Match, Readiness Scan), team roles. Overage buys more credits; it never reprices the base.
* **Agency / Pro:** flat monthly fee + client count. Multi-client workspace (v1), client-ready reporting, reusable Operating Rules templates per client, white-label exports.

An optional performance fee on holdout-verified recovered revenue exists only for managed, agency, and enterprise-lite plans, and is not part of the core self-serve motion.

## 19. Risks

1. **Platform-native AI is the real competitor.** The default alternative is "give Meta the money" and let Advantage+ or PMax run, alongside Shopify Sidekick and Klaviyo AI. Counter-position: the platforms' agents optimize the platform's revenue inside the platform's walls and keep the learnings. This product is the brand's own agent: it holds the LTV and margin context the platforms never see, suppresses spend the platforms would never suppress, and its learnings export as the brand's property.
2. **Coopetition.** The rails this product activates through (Meta, Google, Klaviyo, Shopify) are also its fiercest competitors and could restrict APIs. Mitigation: multi-rail value, an owned and exportable learning loop, no capability that depends on data a platform could hold hostage, and graceful degradation of every activation path to an exportable brief.
3. **Over-autonomy distrust.** Mitigation: Draft + Approve defaults, hard gates, no dark autonomy, autopilot deferred past MVP.
4. **Data quality.** SMB data is messy. Mitigation: readiness reports, freshness stamps, confidence labels, launch gating, refund-aware revenue.
5. **Attribution overclaiming.** Mitigation: the three labeled measurement modes; no lift claims outside holdout scope; labeled estimates where proof is unavailable.
6. **API limitations.** Some channels limit creation or sync. Mitigation: the exportable brief as a first-class deliverable.
7. **Channel policy violations.** Mitigation: the governance runtime enforces Operating Rules structurally; consent provenance recorded per identifier; quiet hours enforced before SMS ships.
8. **Generic-AI perception.** Mitigation: differentiation grounded in connected context, deterministic recipes, direct activation, and honest measurement, not copywriting.

One-line differentiation against the rest of the field: traditional CDPs unify and activate data, this product decides what should happen next. Email/SMS platforms send messages, this product decides which message should exist and for whom. BI dashboards explain what happened, this product recommends what to do. Every other vendor grades its own homework; this product ships holdouts where it controls the channel and labels everything else honestly.

## 20. Claude Code Build Guidance

Principles: build the feed first, not a dashboard. One Operator, many skills; skills are internal modules with scoped permissions. Governance is runtime middleware with no code path around it. Explanation is the output schema; outputs missing the contract do not render. The constitution is a versioned configuration object stamped on every ledger entry. Holdout assignment lives inside the flow launcher, not in an analytics afterthought. Treat time-to-first-opportunity as a performance budget. The product stores governed working memory, not a second customer system of record.

### Build Sequence (v0, in order)

1. **Foundation.** Account creation, business profile, Operating Rules picker (Shopify DTC template) with the three-number setup, approval mode default. Screens: Login/Signup, Business Setup, Operating Rules Picker and Editor.
2. **Connectors.** Shopify and Klaviyo first (first value depends on exactly these two), then Meta Ads; GA4 and Stripe read-only as optional connects. Per-source sync status and freshness. Screens: Connect Data Sources, Data Readiness.
3. **Context layer.** v0 entities from Section 9: customer with consent provenance, product, event, audience, action, opportunity, constitution with versioning, holdout, and the Context Ledger with constitution_version on every entry.
4. **Opportunity engine.** The three versioned recipes with configurable parameters and sane defaults; lifecycle state machine, dedup keys, dismissal cooldowns, estimate decay; ranking with confidence composite; found-money header. Screens: Opportunity Feed, Opportunity Detail.
5. **Drafting + approval.** Lifecycle, paid audience, creative, and offer skills producing drafts under the explanation contract; governance runtime in the request path; review screen with Operating Rules version and measurement plan; approve / edit / reject-with-reason. Screens: Campaign Draft Review, Approval Center.
6. **Activation.** Push drafts to Klaviyo, sync audiences to Meta, export briefs; freshness gate on launch. Screen: Activation Status.
7. **Measurement.** Holdout assignment in the launcher for eligible Klaviyo flows (randomized customer-level, exclusion windows); lift as ranges; no-control tags; directional labels on Meta reporting; plain-English summary; next-best-action. Screens: Performance Summary, Audit Log / Context Ledger.
8. **Operator chat.** Natural-language surface over the same skills, source-grounded, contract-formatted. Screen: Operator Chat.

Steps 1–4 deliver the Day 0 magic moment and should be treated as the critical path. Steps 5–7 complete the loop. Step 8 can land in parallel with 5–7.

### v1 Epics (after v0 ships)

Readiness Scan module; SMS drafts with quiet hours + timezone inference; Google Customer Match; Merchant Center; richer Operating Rules templates; agency workspace and client switcher; optional performance fee billing for managed plans.

## 21. Definition Of Done

MVP v0 is complete when:

* A user can onboard by picking Operating Rules and editing three numbers.
* A user can connect Shopify and Klaviyo, and optionally Meta Ads, GA4, and Stripe read-only. First value requires only Shopify + Klaviyo; nothing in the first-session experience depends on GA4.
* The first ranked opportunity with a dollar estimate appears within 60 minutes of first OAuth, and the first feed leads with summed found money.
* The three v0 recipes run on their versioned specs, with configurable parameters, dedup, cooldowns, data-as-of stamps, and confidence labels.
* The Operator drafts Klaviyo email flows and Meta audience syncs; a user can approve, edit, or reject with a reason.
* Every eligible Klaviyo lifecycle flow (audience ≥ 500) gets an automatic randomized 10% holdout assigned at launch; lift reports as a range; smaller audiences carry the rendered "no control group" tag.
* Meta audience actions report directional downstream performance and never claim holdout-verified lift.
* Every action logs its constitution_version, reasoning, approval status, and outcome in the Context Ledger.
* Every recommendation ships the full explanation contract with confidence and data freshness.
* No spend, send, or suppression change executes without explicit approval.
* Launches are blocked on stale source syncs with a plain explanation and a re-sync action.
* The plain-English performance summary answers what happened, why, and what to do next, and says clearly when it cannot prove lift.
* Customer context, audiences, Operating Rules, and learned preferences export to open formats at any time.

Measured lift, not vendor math — and when we cannot prove it, we say so.
