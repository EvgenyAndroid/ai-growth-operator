# PRD: AI Growth Operator

## Product Requirements Document

## Category Narrative: Agentic CDP For SMB And DTC Brands

## Version: PRD v1.1 (v1 + Build Clarifications patch + Engineering Defaults addendum)

## Source: BRD v3

---

# 1. Product Overview

## 1.1 Product Name

**AI Growth Operator**

## 1.2 Category Narrative

**Agentic CDP for SMB and DTC brands**

## 1.3 Buyer-Facing Promise

Connect your tools. Review what the Operator found. Approve the action. See what changed.

## 1.4 Product Thesis

SMB marketers do not need another place to store customer data. They need a system that turns customer context into action.

The AI Growth Operator connects to the tools an SMB already uses, identifies revenue opportunities, drafts actions, routes them through human approval, activates through existing channels, and measures what changed.

The product is the **system of decision**, not another system of storage.

The Operator does not replace Shopify, Klaviyo, Meta, Google, or GA4. It decides what should happen across them.

## 1.5 MVP v0 Product Loop

MVP v0 proves one loop:

**Find money → draft action → approve → activate → measure → learn**

Everything in the MVP must support this loop.

## 1.6 MVP v0 Wedge

One launch vertical:

**Shopify DTC merchant**

One merchant profile:

**Shopify store + Klaviyo list + Meta Ads account**

Minimum first value requires:

**Shopify + Klaviyo**

Meta unlocks the paid media opportunity. GA4 is recommended but not required.

## 1.7 v0 Opportunity Types

MVP v0 ships exactly three deterministic opportunity recipes:

1. **Abandoned checkout recovery**
2. **Lapsed customer win-back**
3. **High-LTV Meta audience seed + purchaser suppression**

No other opportunity type is required for v0.

## 1.8 Trust Line

**Measured lift, not vendor math — and when we cannot prove it, we say so.**

MVP v0 can claim holdout-verified lift only for eligible Klaviyo lifecycle flows. Meta audience sync is directional only.

---

# 2. Goals And Non-Goals

## 2.1 Product Goals

The MVP must:

1. Deliver the first ranked opportunity within 60 minutes of first OAuth connection.
2. Require only Shopify + Klaviyo for the first magic moment.
3. Generate a ranked opportunity feed with dollar-estimated opportunities where defensible.
4. Draft a Klaviyo recovery or win-back flow.
5. Create a Meta audience sync plan when Meta is connected.
6. Require human approval before any send, sync, spend, suppression change, or public-facing action.
7. Assign holdouts to eligible owned-channel lifecycle flows.
8. Report lift as a range where a valid holdout exists.
9. Clearly label before/after and directional measurement where no holdout exists.
10. Log every decision, approval, action, source, and Operating Rules version.
11. Export customer context, audiences, Operating Rules, and learned preferences.

## 2.2 Business Goals

The MVP should prove:

1. SMB marketers will trust an Operator to identify revenue opportunities.
2. Users will approve drafted actions when the recommendation is clear and safe.
3. The product can create measurable value through existing tools.
4. The product can differentiate from platform-native AI by working across channels and owning the brand-side learning loop.
5. The trust posture — holdouts where possible, honest labels where not — is a market differentiator.

## 2.3 Non-Goals For v0

MVP v0 will not include:

* autonomous campaign launch without approval
* SMS activation
* Google Customer Match
* Google Merchant Center
* GA4-dependent first value
* LLM discoverability
* Share of Prompt monitoring
* campaign publishing outside Klaviyo
* direct paid media budget changes
* clean room workflows
* enterprise identity resolution
* enterprise MDM
* multi-touch attribution
* agency workspace
* broad journey builder
* BI dashboard suite
* full website personalization
* on-site content publishing
* autopilot mode

## 2.4 MVP v1 Candidates

MVP v1 may add:

* LLM Discoverability Readiness Scan
* SMS drafts through connected SMS rail
* Google Customer Match
* Google Merchant Center feed recommendations
* richer Operating Rules templates
* agency workspace
* optional managed-plan performance fee

---

# 3. Target Users And Personas

## 3.1 Primary ICP

Shopify DTC brands with:

* $1M–$50M annual revenue
* 1–10 person marketing team
* active Shopify order history
* active Klaviyo list
* 5,000+ email contacts
* repeat purchase potential
* active or planned Meta spend
* limited analytics and lifecycle bandwidth

## 3.2 Primary Persona: Founder / Owner-Operator

The founder wants revenue, speed, and low risk.

Primary question:

**What should I do this week to grow sales?**

Needs:

* plain English
* clear value
* visible approval gates
* confidence that nothing will break
* proof that the action worked

## 3.3 Secondary Persona: Growth Marketer

The growth marketer owns acquisition, lifecycle, reporting, and experimentation.

Primary question:

**Which audience, offer, and channel should I use next?**

Needs:

* audience logic
* campaign drafts
* performance explanation
* suppression recommendations
* cross-channel context

## 3.4 Secondary Persona: Lifecycle / CRM Marketer

The lifecycle marketer owns email, retention, win-back, and repeat purchase.

Primary question:

**Who should I talk to, what should I say, and when?**

Needs:

* flow drafts
* lifecycle segmentation
* consent-safe activation
* holdout measurement
* non-discount offer recommendations

## 3.5 Future Persona: Agency Operator

The agency operator manages multiple SMB accounts.

Primary question:

**What can I show the client and activate quickly?**

v0 should not build agency workspace, but exportable briefs should be designed to support agency handoff.

---

# 4. Product Principles

## 4.1 Feed First, Not Dashboard First

The user should not land on profiles, sources, destinations, schemas, SQL, or a journey canvas.

The user should land on:

**This week's best growth opportunities.**

## 4.2 One Operator, Many Internal Skills

The user meets one Operator.

Internal skills may include context, opportunity, lifecycle, paid audience, creative, offer, and measurement, but they are not visible as separate agents.

## 4.3 Governance Is Runtime, Not Advice

Every action must pass through the governance runtime before activation.

There must be no code path around:

* consent
* suppression
* budget limits
* discount limits
* margin rules
* approval gates
* banned claims
* freshness checks

## 4.4 Explanation Is The Output Contract

No recommendation renders unless it includes:

* what the Operator found
* why it matters
* what data was used
* how fresh the data is
* what assumptions were made
* what risk exists
* what approval is needed
* how success will be measured

## 4.5 Working Memory, Not A Second Customer System Of Record

The product stores governed working memory.

It does not create a full duplicate customer system of record. It reads from source systems, stores only what is needed to reason, act, audit, and measure, and points back to source wherever possible.

## 4.6 Honest Measurement

The product must never present directional results as verified lift.

All reporting must use one of three labels:

1. **Holdout-verified**
2. **Before/after, no control group**
3. **Directional**

---

# 5. MVP Scope

## 5.1 v0 Must Include

### Connectors

* Shopify
* Klaviyo
* Meta Ads
* GA4 recommended, not required
* Stripe read-only optional

### Core Modules

* onboarding
* Operating Rules setup
* data readiness
* customer context layer
* opportunity engine
* opportunity feed
* Operator chat
* audience builder
* campaign draft review
* approval center
* activation status
* performance summary
* Context Ledger
* export state

### v0 Recipes

* abandoned checkout recovery
* lapsed customer win-back
* high-LTV Meta audience seed + purchaser suppression

### Activation

* Klaviyo email draft fallback ladder
* Meta audience sync
* exportable briefs

### Measurement

* owned-channel holdouts for eligible Klaviyo flows
* before/after with no-control tag for small audiences
* directional Meta reporting

## 5.2 v0 Must Not Include

* live SMS sends
* Google Customer Match
* LLM discoverability
* autonomous budget changes
* autonomous sends
* direct website publishing
* Share of Prompt tracking
* full campaign builder outside the three recipes
* direct attribution claims for Meta sync

---

# 6. Core User Flows

## 6.1 First-Time Onboarding Flow

### User Story

As a Shopify DTC merchant, I want to connect my existing tools and receive my first revenue opportunity quickly, so I can see value without configuring a CDP.

### Flow

1. User creates account.
2. User selects business type: Shopify DTC.
3. User selects primary goals:

   * recover abandoned revenue
   * increase repeat purchase
   * improve acquisition quality
4. User selects Operating Rules template: Shopify DTC.
5. User edits three required numbers:

   * monthly budget cap
   * maximum discount
   * daily send cap
6. User connects Shopify.
7. User connects Klaviyo.
8. System begins sync and displays readiness.
9. System generates first opportunity.
10. User lands on Opportunity Feed with found-money header.

### Acceptance Criteria

* User can complete onboarding in one sitting.
* Shopify + Klaviyo are sufficient for first opportunity.
* First ranked opportunity appears within 60 minutes of first OAuth.
* If no opportunity is available, the Operator explains why and recommends the nearest next action.
* GA4 absence does not block first value.

---

## 6.2 Abandoned Checkout Recovery Flow

### User Story

As a merchant, I want the Operator to find abandoned checkout revenue and draft a recovery flow, so I can recover demand without manually building the segment and copy.

### Flow

1. Operator detects eligible abandoned checkouts.
2. Opportunity card appears with value range.
3. User opens opportunity detail.
4. Operator shows:

   * audience
   * exclusions
   * copy draft
   * offer logic
   * measurement plan
   * confidence
   * data freshness
5. User edits or approves.
6. Governance runtime checks Operating Rules.
7. If eligible audience ≥500, holdout is assigned.
8. Draft is pushed to Klaviyo using highest available activation level.
9. System logs all steps in Context Ledger.
10. Measurement summary appears after launch.

### Acceptance Criteria

* Opportunity excludes purchasers, unsubscribed users, suppressed users, and users in active recovery flows.
* Value is shown as a range.
* Holdout is assigned only if eligible audience ≥500.
* If audience <500, report is tagged "before/after, no control group."
* No send occurs without explicit approval.
* Klaviyo activation uses fallback ladder if full draft flow creation is unavailable.

---

## 6.3 Lapsed Customer Win-Back Flow

### User Story

As a lifecycle marketer, I want the Operator to identify lapsed customers and draft a win-back flow, so I can increase repeat purchase without manually calculating purchase cadence.

### Flow

1. Operator calculates customer purchase cadence.
2. Operator identifies customers past their expected reorder window.
3. Opportunity card appears with estimated value range.
4. User reviews draft win-back flow.
5. Operator recommends non-discount angle first.
6. Offer is checked against Operating Rules.
7. User approves.
8. Klaviyo draft is created or exported through fallback ladder.
9. Measurement is assigned based on audience size.

### Acceptance Criteria

* Personal median purchase interval is used only when customer has enough purchase history.
* Category median is used when personal cadence is unavailable.
* One-time or seasonal products are flagged.
* Products unlikely to repeat are excluded unless merchant overrides.
* Measurement mode is clearly labeled.
* Report nets refunds where data allows.

---

## 6.4 High-LTV Meta Audience Flow

### User Story

As a growth marketer, I want to sync my best customers and suppress recent purchasers in Meta, so my acquisition and retargeting are guided by brand-side customer value, not only platform signals.

### Flow

1. Operator identifies top customers by revenue, frequency, and recency.
2. Operator excludes refund-heavy customers from seed.
3. Operator builds recent purchaser suppression audience.
4. User reviews audience sizes and rules.
5. Governance runtime checks consent and destination compatibility.
6. User approves sync.
7. Audiences are pushed to Meta.
8. System reports match status and directional downstream performance.

### Acceptance Criteria

* No recovered revenue estimate is shown.
* No holdout claim is shown.
* Measurement label is always "directional."
* User sees audience size, match status, sync status, and downstream context.
* Product never claims Meta incrementality in v0.

---

## 6.5 Performance Review Flow

### User Story

As a marketer, I want to know what happened after an action launched, so I can decide whether to continue, change, or stop the flow.

### Flow

1. Operator reads performance from connected sources.
2. Performance screen shows:

   * what happened
   * measurement mode
   * revenue or outcome
   * confidence
   * data freshness
   * what to do next
3. If holdout exists, lift is shown as a range.
4. If no holdout exists, before/after or directional label appears prominently.
5. Operator recommends next action.

### Acceptance Criteria

* Holdout-verified lift is shown only when valid holdout exists.
* Small-audience flows show "no control group."
* Meta shows directional downstream reporting only.
* Performance summary is plain English by default.
* Raw metrics may be available behind expansion but are not the default view.

---

# 7. Screens And UX Requirements

## 7.1 Screen List

v0 must include:

1. Login / Signup
2. Business Setup
3. Operating Rules Picker
4. Operating Rules Editor
5. Connect Data Sources
6. Data Readiness
7. Opportunity Feed
8. Opportunity Detail
9. Operator Chat
10. Audience Builder
11. Campaign Draft Review
12. Approval Center
13. Activation Status
14. Performance Summary
15. Context Ledger / Audit Log
16. Export State

## 7.2 Opportunity Feed

### Purpose

Show the merchant the best active growth opportunities.

### Requirements

The feed must show:

* found-money header
* maximum of ~5 active cards
* data-as-of timestamp on every card
* confidence label
* measurement mode
* recommended action
* CTA
* dismissal option
* dismissal reason capture

### Card Fields

Each opportunity card must include:

* title
* estimated value range or directional label
* confidence
* data-as-of
* what was found
* why it matters
* recommended action
* measurement mode
* approval needed
* CTA

### Empty State

If no opportunity is found, the Operator must explain:

* what data was checked
* why no opportunity was found
* what connection or data would unlock more opportunities
* next best manual action

---

## 7.3 Opportunity Detail

### Purpose

Allow user to inspect the recommendation before draft or approval.

### Requirements

Must show:

* source signal
* recipe version
* audience size
* inclusion rules
* exclusion rules
* estimate formula
* estimate confidence
* data freshness
* proposed action
* proposed channel
* measurement plan
* Operating Rules version
* risks
* unsupported claim warnings
* CTA to draft action

---

## 7.4 Campaign Draft Review

### Purpose

Allow human approval before activation.

### Requirements

Must show:

* objective
* audience
* channel
* draft copy
* sequence
* timing
* offer logic
* suppression rules
* holdout plan or measurement label
* Operating Rules version
* claim warnings
* edit option
* approve option
* reject option with reason

### Approval Buttons

* Approve
* Edit
* Reject

Reject must require a reason from a short list plus optional free text.

Default rejection reasons:

* not relevant
* too aggressive
* wrong audience
* wrong offer
* not enough value
* timing is wrong
* copy needs work
* do not want discount
* other

---

## 7.5 Performance Summary

### Purpose

Explain what happened after activation.

### Requirements

Default view must answer:

* What happened?
* What was measured?
* Was there a holdout?
* What did the holdout show?
* If no holdout, why not?
* What is the confidence level?
* What should we do next?

### Labels

Every report must show one measurement label:

* Holdout-verified
* Before/after, no control group
* Directional

---

# 8. Data Sources And Freshness

## 8.1 Required v0 Connectors

### Shopify

Used for:

* customers
* orders
* refunds
* products
* checkouts
* purchase history
* abandoned checkout signal

### Klaviyo

Used for:

* profiles
* consent
* lists
* segments
* flows
* campaigns
* engagement
* unsubscribes
* suppression status

### Meta Ads

Used for:

* custom audience creation
* lookalike seed
* suppression audience
* sync status
* match status
* spend context where available
* directional downstream reporting

## 8.2 Recommended v0 Connector

### GA4

Used for:

* enhanced site behavior
* referral context
* future AI-referral visibility
* enhanced performance interpretation

GA4 must not be required for first-session value.

## 8.3 Optional v0 Connector

### Stripe Read-Only

Used for:

* failed payment context
* subscription billing state where relevant
* payment events
* refund reconciliation where available

## 8.4 Default Freshness Thresholds

| Source   | Data Type                  | Default Freshness Threshold |
| -------- | -------------------------- | --------------------------: |
| Shopify  | Orders                     |                     2 hours |
| Shopify  | Checkouts                  |                     2 hours |
| Shopify  | Products                   |                    24 hours |
| Shopify  | Refunds                    |                    24 hours |
| Klaviyo  | Consent / suppression      |                     2 hours |
| Klaviyo  | Profiles / lists           |                     6 hours |
| Klaviyo  | Engagement                 |                    24 hours |
| Klaviyo  | Flow / campaign status     |                     6 hours |
| Meta Ads | Audience sync status       |                    24 hours |
| Meta Ads | Match status               |                    24 hours |
| Meta Ads | Performance                |                    24 hours |
| GA4      | Site behavior              |                 24–48 hours |
| Stripe   | Payments / failed payments |                     6 hours |

## 8.5 Freshness Gate

Launches must be blocked when required source data is stale.

### Block Example

"This action depends on Klaviyo consent data that has not synced in 9 hours. Your Operating Rules require consent data to be fresher than 2 hours before launch. Re-sync Klaviyo to continue."

### Acceptance Criteria

* Every opportunity displays data-as-of.
* Every launch checks source freshness.
* User can re-sync from the blocking message.
* Blocking event is logged in Context Ledger.
* Freshness thresholds are editable in settings, but safe defaults apply.

---

# 9. Data Model

## 9.1 Customer

Required fields:

* customer_id
* source_customer_ids
* email_hash
* consent_email
* consent_provenance
* lifecycle_stage
* first_purchase_date
* last_purchase_date
* total_orders
* total_revenue
* purchase_interval_stats
* refund_rate
* suppression_status
* holdout_memberships
* source_references

Future fields:

* phone_hash
* consent_sms
* predicted_ltv
* churn_risk_score
* preferred_channel
* inferred_timezone

## 9.2 Product

Required fields:

* product_id
* source_product_id
* name
* category
* price
* availability
* product_url
* structured_attributes
* repeat_purchase_flag
* replenishment_window_days
* seasonal_flag

Future fields:

* margin_estimate
* llm_readiness_score
* schema_status

## 9.3 Event

Required fields:

* event_id
* customer_id
* event_type
* event_timestamp
* source
* product_id
* campaign_id
* value
* metadata

v0 event types:

* checkout_started
* purchase
* repeat_purchase
* refund
* email_open
* email_click
* unsubscribe
* audience_synced

## 9.4 Audience

Required fields:

* audience_id
* name
* creation_method
* inclusion_rules
* exclusion_rules
* size
* eligible_channels
* consent_requirements
* last_synced_at
* destination_status

## 9.5 Action

Required fields:

* action_id
* type
* objective
* channel
* audience_id
* status
* created_by
* approved_by
* launched_at
* constitution_version
* holdout_id
* measurement_mode
* expected_outcome
* measured_outcome
* lift_low
* lift_high
* confidence_level
* source_references
* activation_level

Measurement mode values:

* holdout
* before_after_no_control
* directional

Activation level values:

* klaviyo_flow_draft
* klaviyo_campaign_draft
* exportable_brief
* manual_setup_instructions
* meta_audience_sync

## 9.6 Opportunity

Required fields:

* opportunity_id
* dedup_key
* recipe_id
* recipe_version
* title
* category
* estimated_value_low
* estimated_value_high
* estimate_label
* confidence
* data_as_of
* estimate_verified_at
* recommended_action
* status
* dismissed_reason
* cooldown_until
* outcome

Status values:

* found
* sized
* proposed
* drafted
* approved
* launched
* measured
* learned
* dismissed

## 9.7 Constitution / Operating Rules

Required fields:

* constitution_id
* template_vertical
* version
* monthly_budget_cap
* max_discount_percent
* margin_floor_percent
* daily_send_cap
* frequency_caps
* blackout_dates
* tone_guide
* banned_claims
* suppression_defaults
* approval_requirements
* effective_from
* superseded_by

## 9.8 Holdout

Required fields:

* holdout_id
* action_id
* eligible_audience_size
* holdout_percent
* holdout_size
* assignment_method
* started_at
* exclusion_window
* status
* measured_lift_low
* measured_lift_high
* confidence
* contamination_risk

Assignment method:

* randomized_customer_level

## 9.9 Context Ledger Entry

Required fields:

* ledger_id
* timestamp
* user_id
* account_id
* action_id
* opportunity_id
* skill_invoked
* constitution_version
* source_data_used
* source_freshness
* reasoning_summary
* confidence
* approval_status
* destination
* activation_level
* action_taken
* rollback_path
* measured_outcome
* measurement_mode

---

# 10. Opportunity Recipes

## 10.1 Shared Recipe Requirements

Every recipe must be:

* deterministic
* versioned
* configurable with sane defaults
* logged in opportunity record
* explainable
* governed by Operating Rules
* tied to a measurement mode

Every recipe must produce:

* source signal
* audience
* exclusions
* estimate
* confidence
* recommended action
* measurement plan
* data-as-of
* recipe_version

---

## 10.2 Recipe 1: Abandoned Checkout Recovery

### Source Signal

Shopify `checkout_started` without purchase within X hours.

Default:

* X = 4 hours

### Eligibility

Customer is eligible if:

* checkout_started exists
* no purchase after checkout
* email consent exists or existing Klaviyo profile is eligible
* customer is not suppressed
* customer is not unsubscribed

### Exclusions

Exclude:

* purchased since checkout
* unsubscribed
* suppressed
* already in active abandoned checkout recovery flow
* already assigned to holdout for same action
* manually excluded by merchant
* stale checkout older than configured maximum window

Default max window:

* 14 days

### Estimate Formula

Primary formula:

eligible users × historical recovery rate × average order value

Report as range:

* low = conservative recovery rate × eligible users × AOV
* high = merchant historical recovery rate × eligible users × AOV

### Estimate Fallbacks

If merchant historical recovery rate exists:

* use merchant rate

If merchant history is weak:

* use conservative default benchmark
* label estimate as "modeled estimate"

If no baseline exists:

* show opportunity without dollar headline or show directional value label
* do not include in found-money header unless estimate confidence is Medium or High

### Action

Create recovery flow draft:

* email 1: non-discount reminder
* email 2: benefit / objection handling
* email 3: incentive only if allowed by Operating Rules

### Klaviyo Activation Fallback Ladder

The product must attempt activation in this order:

1. **Level 1: Klaviyo flow draft**

   * create draft flow or flow-like object if API supports it
2. **Level 2: Klaviyo campaign draft**

   * create draft campaign with audience and copy
3. **Level 3: Exportable brief**

   * generate complete build-ready brief
4. **Level 4: Manual setup instructions**

   * step-by-step instructions for building in Klaviyo

The UI must show which activation level was used.

### Measurement

If eligible audience ≥500:

* assign randomized 10% customer-level holdout
* report holdout-verified lift as range

If audience <500:

* before/after, no control group

### Acceptance Criteria

* Detects checkout_started without purchase after default 4 hours.
* Excludes purchasers, unsubscribed, suppressed, and active-flow users.
* Uses estimate fallback rules.
* Shows estimate label: verified, modeled, or directional.
* Creates Klaviyo draft or fallback brief.
* Assigns holdout only when eligible audience ≥500.
* Logs recipe_version and constitution_version.
* Renders full explanation contract.
* Does not send without approval.

---

## 10.3 Recipe 2: Lapsed Customer Win-Back

### Source Signal

Customer is past expected purchase cadence.

Primary logic:

current gap > 1.5× personal median purchase interval

### Minimum Personal Cadence Rule

Use personal cadence only when customer has:

* at least 3 prior purchases
* at least 2 measurable intervals
* no active refund dispute
* no suppression

### Category Fallback

If personal cadence is unavailable:

* use product/category median interval
* if category median is unavailable, use merchant-level repeat purchase interval

### Product-Aware Rules

The recipe must consider:

* replenishment category
* repeat_purchase_flag
* seasonal_flag
* product type
* customer's last purchased product

Exclude products that are unlikely to repeat unless merchant overrides.

Examples of weak repeat categories:

* one-time gift products
* durable goods with long replacement cycles
* seasonal products out of season
* discontinued products
* products with no availability

### Eligibility

Customer is eligible if:

* email consent exists or Klaviyo profile is eligible
* customer has not purchased recently
* customer is past expected reorder window
* customer is not suppressed
* customer is not unsubscribed

### Exclusions

Exclude:

* active win-back flow members
* active recovery flow members
* recent purchasers
* unsubscribed
* suppressed
* refund-heavy customers if refund suggests dissatisfaction
* customers whose last product is discontinued or unavailable

### Estimate Formula

eligible customers × historical win-back rate × average order value

Report as range.

### Estimate Fallbacks

If historical win-back rate exists:

* use merchant historical win-back rate

If not:

* use conservative modeled estimate

If product repeat logic is weak:

* mark confidence Low
* do not lead feed unless no higher-confidence opportunity exists

### Action

Create win-back flow draft:

* non-discount re-engagement first
* product education or replenishment reminder
* offer only if allowed by Operating Rules

### Measurement

If eligible audience ≥500:

* holdout-verified

If audience <500:

* before/after, no control group

### Acceptance Criteria

* Uses personal cadence only when minimum history exists.
* Uses category or merchant fallback when needed.
* Excludes one-time, seasonal, unavailable, or non-repeat products unless overridden.
* Produces value range with confidence label.
* Drafts Klaviyo win-back flow or fallback brief.
* Assigns holdout only when audience ≥500.
* Tags small-audience measurement correctly.
* Logs recipe_version and constitution_version.
* Renders explanation contract.

---

## 10.4 Recipe 3: High-LTV Meta Seed + Purchaser Suppression

### Source Signal

Shopify orders.

### Seed Audience Logic

Build high-LTV seed from top 10–20% of customers by:

* total revenue
* purchase frequency
* recency
* refund-adjusted value

Default percentile:

* top 15%

### Suppression Audience Logic

Build suppression audience from:

* recent purchasers
* configurable window

Default recent purchaser window:

* 30 days

### Exclusions

Exclude from seed:

* refund-heavy customers
* suppressed users
* customers without destination-compatible identifiers
* customers with unclear consent status where consent is required

Exclude from suppression only when:

* customer lacks destination-compatible identifier

### Estimate Formula

No recovered revenue estimate.

The opportunity card shows:

* seed audience size
* suppression audience size
* expected use case
* directional label

### Action

On approval:

* create Meta custom audience
* create lookalike seed where supported
* create recent purchaser suppression audience
* log destination status

### Measurement

Directional only.

Allowed metrics:

* audience size
* match rate
* audience sync status
* audience accepted / rejected
* campaign/ad set association where available
* spend against campaign/ad set using synced audience
* downstream purchases from customers in synced audience where observable
* repeat purchase or new customer rate after sync
* prior-period comparison, labeled non-causal

Disallowed language:

* lift
* incrementality
* recovered revenue
* causal ROAS
* holdout-verified

### Acceptance Criteria

* Builds high-LTV seed using revenue, frequency, recency, and refund-adjusted value.
* Builds recent purchaser suppression audience.
* Shows audience size and destination compatibility.
* Syncs to Meta only after approval.
* Measurement label is always directional.
* No lift claim appears anywhere.
* Logs sync status and constitution_version.
* Renders explanation contract.

---

# 11. Confidence Scoring

## 11.1 Confidence Inputs

Every opportunity confidence score uses:

* data freshness
* audience size
* consent eligibility
* baseline availability
* direct activation availability
* measurement quality
* source completeness
* recipe maturity
* product repeatability where relevant

## 11.2 Confidence Labels

### High

All or most are true:

* data is fresh
* audience >500
* consent is clear
* direct activation exists
* historical baseline exists
* measurement can be holdout-verified
* source completeness is strong

### Medium

Some gaps exist:

* audience is smaller
* baseline is modeled
* measurement is before/after
* activation fallback is needed
* product repeatability is partial

### Low

Use when:

* beta module
* weak measurement
* directional only
* insufficient history
* high data gaps
* product repeatability unclear

## 11.3 Display Rules

Confidence must appear on:

* opportunity card
* opportunity detail
* approval screen
* performance summary
* Context Ledger

## 11.4 Acceptance Criteria

* Confidence is computed and stored per opportunity.
* Confidence inputs are inspectable.
* Confidence label is not generated by LLM alone.
* Confidence calibration can be audited against realized outcomes.

---

# 12. Operating Rules And Governance

## 12.1 Naming

| Layer             | Name                 |
| ----------------- | -------------------- |
| Internal object   | Constitution         |
| User-facing label | Operating Rules      |
| Marketing phrase  | Guardrails           |
| Audit field       | constitution_version |

## 12.2 v0 Operating Rules Template

v0 ships one template:

**Shopify DTC**

Variant:

**Beauty / wellness banned-claims variant**

## 12.3 Required Setup

During onboarding, user edits three numbers:

1. Monthly budget cap
2. Maximum discount
3. Daily send cap

## 12.4 Default Rules

Operating Rules include:

* discount ceiling
* margin floor
* daily send cap
* frequency caps
* blackout dates
* tone guide
* banned claims
* suppression defaults
* approval requirements

## 12.5 Governance Runtime

The governance runtime must check every action before activation.

It must enforce:

* approval status
* consent
* suppression
* destination compatibility
* discount ceiling
* margin floor
* daily send cap
* banned claims
* tone guide
* frequency caps
* data freshness
* source permissions

## 12.6 Unsupported Claim Checks

Creative output must be checked against product data.

### Claims To Flag

Flag claims such as:

* clinically proven
* cures
* treats
* prevents
* guaranteed
* FDA-approved
* medical-grade
* dermatologist-approved
* safe for all skin types
* best
* #1
* fastest
* permanent
* no side effects
* scientifically proven
* doctor recommended

### Claim Handling

If unsupported claim is detected:

* flag the claim
* explain why it is risky
* show source data checked
* suggest safer alternative
* prevent approval unless user edits or explicitly overrides where override is allowed

### Non-Overrideable Claims

Some claims should be non-overrideable in MVP for high-risk categories:

* cures
* treats disease
* FDA-approved, unless source data confirms
* guaranteed medical outcome

## 12.7 Acceptance Criteria

* Every action passes through governance runtime.
* No code path can activate without governance check.
* constitution_version is stamped on every action.
* Unsupported claims are flagged before approval.
* Non-overrideable claim rules block activation.
* User-facing copy says Operating Rules, not Constitution.

---

# 13. Activation Requirements

## 13.1 Klaviyo Activation

The product must support fallback activation levels.

### Level 1: Klaviyo Flow Draft

Preferred when technically available.

Creates:

* draft flow structure
* audience/segment logic
* email steps
* timing
* suppression logic
* holdout assignment metadata where supported

### Level 2: Klaviyo Campaign Draft

Used when flow draft is unavailable.

Creates:

* campaign draft
* audience/segment
* copy
* offer
* suppression rules
* recommended timing

### Level 3: Exportable Brief

Used when API cannot create draft.

Includes:

* audience logic
* segment build instructions
* email copy
* subject lines
* preview text
* timing
* offer
* suppression
* holdout plan
* measurement setup

### Level 4: Manual Setup Instructions

Used when no write access exists.

Includes:

* step-by-step Klaviyo setup
* copy blocks
* segment logic
* testing checklist

## 13.2 Meta Activation

On approval, product syncs:

* high-LTV custom audience
* lookalike seed where supported
* recent purchaser suppression audience

If sync fails:

* show reason
* retry
* offer exportable audience brief
* log failure

## 13.3 Exportable Brief

Exportable brief is a first-class deliverable.

It must include:

* objective
* audience definition
* inclusion rules
* exclusion rules
* copy
* offer
* timing
* suppression
* measurement plan
* confidence
* data-as-of
* Operating Rules version

## 13.4 Acceptance Criteria

* Klaviyo fallback ladder is implemented.
* UI shows activation level used.
* Meta sync requires approval.
* Failed activation produces clear explanation.
* Exportable brief is always available.
* Activation attempts are logged.

---

# 14. Measurement And Prove-It Engine

## 14.1 Measurement Modes

Every action must have exactly one measurement mode:

1. **Holdout-verified**
2. **Before/after, no control group**
3. **Directional**

## 14.2 Holdout Eligibility

Holdouts apply only to:

* Klaviyo email flows
* recurring lifecycle campaigns
* Operator-created flows
* eligible audience ≥500

## 14.3 Holdout Assignment

Default:

* 10% holdout
* randomized customer-level assignment
* assigned at launch time
* stored per customer
* visible in Context Ledger

## 14.4 Holdout Contamination Rules

The product must assess contamination risk.

### Clean Holdout Requirement

A holdout is clean only if held-out users are excluded from the Operator-created flow.

### Contamination Risk Checks

The product must check whether held-out users may still be reached by:

* existing Klaviyo abandoned cart flows
* existing Klaviyo win-back flows
* Shopify native abandoned checkout emails
* active Meta retargeting audiences
* other active campaigns using same audience
* manual sends
* duplicate profiles

### MVP Rule

MVP must guarantee clean exclusion from the Operator-created flow.

If other active campaigns may reach holdout users, the report must show:

**Contamination risk detected. Holdout excludes customers from this Operator-created flow, but other active campaigns may still reach them. Interpret lift range with caution.**

## 14.5 Lift Calculation

Report as range, never point estimate.

Inputs:

* eligible audience
* holdout audience
* exposed audience
* purchases
* revenue
* refunds where available
* measurement window

Output:

* measured_lift_low
* measured_lift_high
* confidence
* caveats

## 14.6 Before/After Measurement

Used when:

* audience <500
* holdout cannot be assigned
* contamination risk is too high

Must show:

**Before/after, no control group**

## 14.7 Directional Measurement

Used for:

* Meta audience sync
* beta modules
* any action where causal control is not available

Must never use lift language.

## 14.8 Acceptance Criteria

* Holdouts are assigned only to eligible Klaviyo flows.
* Held-out customers are excluded from Operator-created flow.
* Contamination risk is checked and disclosed.
* Lift reports as range.
* No point lift claim is displayed.
* Meta never shows holdout or lift language.
* Reports net refunds where data allows.
* Reports clearly state when lift cannot be proven.

---

# 15. Meta Directional Reporting

## 15.1 Purpose

Meta reporting helps the merchant understand whether audience sync was accepted and whether downstream performance appears directionally useful.

It is not causal measurement in v0.

## 15.2 Allowed Metrics

Show:

* audience created
* audience size
* match rate
* sync status
* last synced
* audience used in campaign/ad set where visible
* spend context where visible
* downstream purchases from synced audience where observable
* repeat purchase or new customer rate after sync
* prior-period comparison, labeled non-causal

## 15.3 Required Labels

Every Meta report must show:

**Directional reporting only. This is not holdout-verified lift.**

## 15.4 Disallowed Metrics / Language

Do not show:

* lift
* incrementality
* recovered revenue
* causal ROAS
* verified impact
* holdout-verified result

## 15.5 Acceptance Criteria

* Directional label appears on card, approval screen, and performance summary.
* Meta opportunity does not appear in found-money header.
* No recovered revenue estimate is attached to Meta sync.
* Sync status and match rate are visible.
* Any downstream performance is labeled non-causal.

---

# 16. Estimation Logic

## 16.1 Estimate Types

Each value estimate must be labeled:

* merchant historical
* modeled estimate
* directional
* unavailable

## 16.2 Found-Money Header Rules

Found-money header may include only:

* abandoned checkout recovery with Medium or High confidence
* lapsed customer win-back with Medium or High confidence

Do not include:

* Meta directional opportunity
* Low confidence opportunity
* beta opportunity
* no-baseline estimate unless explicitly labeled separately

## 16.3 Estimate Fallback Hierarchy

Use:

1. merchant-specific historical rate
2. category/product-specific historical rate
3. conservative modeled default
4. directional label without dollar value

## 16.4 Estimate Range

All estimates must be ranges.

No single-point estimate is allowed.

## 16.5 Acceptance Criteria

* Estimate type is stored.
* Estimate type is displayed.
* Low-confidence estimates do not inflate found-money header.
* Directional Meta opportunities do not show recovered revenue.
* If no baseline exists, UI says so.

---

# 17. Operator Chat

## 17.1 Purpose

Operator Chat gives the user a natural-language interface over the same deterministic system.

It must not invent opportunity types outside v0.

## 17.2 Supported v0 Questions

The Operator must handle:

* What should I do this week to grow revenue?
* Recover abandoned carts.
* Build a win-back campaign for lapsed customers.
* Create a Meta lookalike from my best customers.
* What did the holdout show?
* What can I do without offering a discount?
* Draft a campaign but do not launch it.
* Why is this opportunity confidence Medium?
* Why can't you prove lift for Meta?

## 17.3 Chat Output Contract

Every answer that recommends action must include:

* what was found
* why it matters
* data used
* data freshness
* assumptions
* risk
* approval needed
* measurement plan

## 17.4 Acceptance Criteria

* Chat cannot bypass approval.
* Chat cannot bypass governance.
* Chat cannot create unsupported metrics.
* Chat cannot claim capabilities outside v0 without labeling as not available.
* Chat responses cite source data internally through Context Ledger references.

---

# 18. Context Ledger And Audit

## 18.1 Purpose

The Context Ledger makes every Operator decision reconstructable.

## 18.2 Ledger Events

Log:

* data sync
* opportunity found
* opportunity sized
* opportunity drafted
* user edit
* approval
* rejection
* dismissal
* activation attempt
* activation success
* activation failure
* holdout assignment
* measurement readback
* performance summary
* Operating Rules edit
* export

## 18.3 Ledger Entry Must Include

* timestamp
* user
* account
* source data
* source freshness
* skill invoked
* recipe version
* constitution_version
* reasoning summary
* confidence
* approval status
* destination
* action taken
* measurement mode
* outcome

## 18.4 Acceptance Criteria

* Every rendered recommendation has ledger entry.
* Every activation has ledger entry.
* Every measurement has ledger entry.
* User can inspect audit history.
* Export includes ledger references.

---

# 19. Export Requirements

## 19.1 Exportable State

User must be able to export:

* customer context
* audiences
* Operating Rules
* learned preferences
* opportunity history
* campaign/action history
* measurement summaries

## 19.2 Formats

Supported initial formats:

* CSV for tabular data
* JSON for structured objects
* PDF or Markdown for briefs and summaries

## 19.3 Acceptance Criteria

* Export is available from settings.
* Export includes timestamp.
* Export includes account identifier.
* Export includes constitution_version where relevant.
* Export does not expose raw PII unnecessarily.
* Hashed identifiers remain hashed where appropriate.

---

# 20. Demo Mode Requirements

## 20.1 Purpose

Claude Code should build a demo-mode path so product flows can be tested before live integrations are fully wired.

## 20.2 Demo Mode Must Include

* sample Shopify data
* sample Klaviyo data
* sample Meta audience data
* three opportunity recipes
* opportunity feed
* campaign review
* approval simulation
* holdout simulation
* performance summary simulation
* Context Ledger simulation

## 20.3 Demo Mode Rules

Demo mode must be clearly labeled.

No demo result may appear as real customer data.

## 20.4 Acceptance Criteria

* User can toggle demo workspace.
* Demo workspace shows Day 0 magic moment.
* Demo data exercises all three recipes.
* Demo measurement includes one holdout example, one no-control example, and one directional Meta example.

---

# 21. Analytics And Product Metrics

## 21.1 Business Metrics

Track:

* time-to-first-opportunity
* found-money-shown
* week-one success rate
* opportunity-to-action rate
* approval rate
* time to first launch
* holdout-verified recovered revenue
* before/after outcomes
* directional Meta sync outcomes
* retention
* expansion

## 21.2 Usage Metrics

Track:

* weekly active users
* opportunities viewed
* opportunities approved
* opportunities rejected
* opportunities dismissed
* dismissal reasons
* chat sessions
* drafts generated
* launches
* audiences synced
* reports generated
* exports

## 21.3 Agent Quality Metrics

Track:

* recommendation acceptance rate
* user edit rate
* unsupported claim flag rate
* false-positive opportunity rate
* confidence calibration
* flows failing to beat holdout
* activation failure rate
* stale-data block rate

---

# 22. Error States

## 22.1 Connector Error

Show:

* connector name
* issue
* last successful sync
* suggested fix
* retry button

## 22.2 Stale Data Error

Show:

* stale source
* required freshness threshold
* current freshness
* re-sync action

## 22.3 Insufficient Audience Error

Show:

* audience size
* threshold
* fallback measurement mode
* reason no holdout applies

## 22.4 Activation Error

Show:

* destination
* failure reason
* fallback option
* exportable brief

## 22.5 Unsupported Claim Error

Show:

* flagged claim
* source checked
* risk explanation
* safer alternative
* edit action

---

# 23. Security, Privacy, And Compliance

## 23.1 Security

Must support:

* OAuth where available
* encrypted credentials
* least-privilege access
* role-based access
* audit logs
* secure token storage
* account-level separation

## 23.2 Privacy

Must support:

* PII minimization
* hashed identifiers for ad platforms
* user-controlled deletion
* exportable state
* consent-aware activation
* retention policy

## 23.3 Consent

Must store consent provenance:

* source
* method
* timestamp
* identifier
* channel

## 23.4 Suppression

Suppression must be checked before:

* draft approval
* send
* audience sync
* export brief generation

---

# 24. Technical Architecture Guidance

## 24.1 Suggested Services

Build modular services:

1. Auth Service
2. Account Service
3. Connector Service
4. Sync Service
5. Context Service
6. Opportunity Engine
7. Recipe Service
8. Governance Runtime
9. Drafting Service
10. Activation Service
11. Measurement Service
12. Ledger Service
13. Export Service
14. Operator Chat Service

## 24.2 Suggested Front-End Modules

Build UI modules:

* onboarding wizard
* connection cards
* readiness panel
* opportunity feed
* opportunity card
* opportunity detail
* review screen
* approval center
* performance summary
* audit log
* export panel
* Operator chat

## 24.3 Implementation Principle

Steps 1–4 must be treated as critical path:

1. onboarding
2. connectors / demo data
3. context layer
4. opportunity feed

These deliver the Day 0 magic moment.

---

# 25. Release Plan

## 25.1 Alpha

Alpha can use:

* demo data
* mocked connectors
* deterministic recipes
* simulated Klaviyo activation
* simulated Meta sync
* simulated holdout

Alpha must prove UX loop.

## 25.2 Private Beta

Private beta requires:

* real Shopify connection
* real Klaviyo connection
* real opportunity detection
* Klaviyo fallback activation
* real Context Ledger
* real approval workflow

## 25.3 Production MVP

Production MVP requires:

* real Shopify
* real Klaviyo
* real Meta audience sync
* real measurement readback
* holdout logic
* freshness gates
* export state
* security baseline

---

# 26. Definition Of Done

MVP v0 is complete when:

1. User can onboard by picking Operating Rules and editing three numbers.
2. User can connect Shopify and Klaviyo.
3. First value does not require GA4.
4. First ranked opportunity appears within 60 minutes of first OAuth.
5. Opportunity feed leads with found-money header when estimates are defensible.
6. Three v0 recipes run on versioned specs.
7. Each recipe supports configurable parameters with sane defaults.
8. Opportunities have dedup, cooldown, lifecycle state, confidence, data-as-of, and recipe_version.
9. Operator drafts Klaviyo email flows or uses fallback ladder.
10. Operator prepares Meta audience sync on approval.
11. User can approve, edit, reject, and dismiss with reason.
12. Every eligible Klaviyo lifecycle flow gets randomized customer-level holdout.
13. Smaller owned-channel audiences show "before/after, no control group."
14. Meta actions show "directional" only.
15. Holdout contamination risk is checked and disclosed.
16. Every action logs constitution_version.
17. Every recommendation follows explanation contract.
18. Governance runtime blocks stale data, unsupported claims, suppression violations, consent issues, and approval bypasses.
19. Launches are blocked on stale source sync.
20. Performance summary explains what happened, why, confidence, and next action.
21. Product says clearly when it cannot prove lift.
22. Customer context, audiences, Operating Rules, learned preferences, and summaries export to open formats.
23. Demo mode can exercise the full product loop.

Measured lift, not vendor math — and when we cannot prove it, we say so.

---

# 26A. PRD v1.1 Patch: Build Clarifications

1. Holdout-verified measurement is available only when the product can assign and enforce holdout exclusion inside the activation path. If activation falls back to exportable brief or manual setup instructions, measurement downgrades to "before/after, no control group" unless holdout implementation can be verified.

2. Every performance summary must state the measurement window. Default windows: abandoned checkout recovery early read at 3 days, primary read at 7 days, long read at 14 days; lapsed customer win-back early read at 7 days, primary read at 21 days, long read at 30 days; Meta audience sync directional read at 7, 14, and 30 days.

3. v0 Operator Chat is a constrained command interface over the three v0 recipes. It may explain, draft, and route approved actions for abandoned checkout recovery, lapsed customer win-back, Meta audience seed/suppression, confidence, and measurement. Unsupported requests must be labeled as unavailable in v0. Any unsupported ask should return: "That is not available in v0. I can help with abandoned checkout recovery, lapsed customer win-back, Meta audience seed/suppression, or performance explanation."

4. Creating a draft is not activation. Customer-facing sends, audience syncs, suppression changes, budget changes, and public-facing actions require explicit approval.

5. Active-flow exclusions should use Klaviyo flow membership where available. If unavailable, use recent flow/campaign event history as proxy. If neither is available, flag contamination risk and lower confidence.

6. Modeled default recovery and win-back rates must be conservative, configurable, and labeled as assumptions. Merchant-specific history replaces modeled defaults when sufficient data exists. Do not hardcode industry benchmarks as truth; ship them as editable system defaults.

7. Product repeatability must be editable by the merchant. The system may infer repeatable, replenishable, seasonal, one-time/gift, or unknown, but the user can override.

8. Meta audience creation must require confirmation that the merchant has the right to use customer identifiers for ad-platform audience creation. Identifiers must be hashed where required, and the destination-compatibility check must be logged.

9. Add technical entities for Integration, SyncRun, RecipeConfig, Draft, Approval, MeasurementWindow, and ExportJob. Integration: source, OAuth status, scopes, last sync, freshness threshold, error state. SyncRun: source, started_at, completed_at, status, records read, errors. RecipeConfig: account-level recipe parameters and overrides. Draft: copy, sequence, activation target, current version, edits. Approval: approver, status, timestamp, changes requested. MeasurementWindow: start, end, mode, attribution/lookback assumptions. ExportJob: object type, requested_by, format, status. Without these, engineering will overload Action, Opportunity, and Ledger.

10. If no opportunity is found in the first session, the Operator must show what was checked (orders checked, checkouts checked, eligible audience after consent/suppression), why no opportunity qualified, the closest next action (e.g. lapsed customer scan), and what connection would unlock more opportunities (e.g. connect Meta).

Priority note: the feed is the product; Operator Chat is an assist layer. The build order in Section 27 (chat at step 10 of 11) reflects this — the product must work without chat.

---

# 26B. PRD v1.1 Addendum: Engineering Defaults

These defaults are adopted unless explicitly overridden at build kickoff. Where they conflict with earlier sections, this addendum and the Section 26A patch win.

11. Found-money estimates must be net of existing automation. Onboarding scans and classifies the merchant's existing Klaviyo flows (recovery and win-back detection). Recipe estimates cover only the residual population not already reached by an active equivalent flow, and card copy frames value as "beyond what your current flows already recover." An estimate that double-counts revenue the merchant's existing abandoned-cart flow would recover anyway destroys trust with exactly the most sophisticated users.

12. v0 identity join rule: lowercase-email exact match between Shopify customers and Klaviyo profiles. No fuzzy matching in v0. Unmatched records remain channel-local. Holdout exclusion is enforced on this join key — a held-out customer must be excludable in Klaviyo by this key or the holdout is not clean.

13. The Customer model adds consent_ads (or opt_out_of_sharing) with provenance, parallel to consent_email. Recipe 3 eligibility reads this field for audience-sync eligibility.

14. Holdout assignment is independent per flow. Customers may hold membership in multiple concurrent holdouts (holdout_memberships already supports this). Lift reports list cross-flow interaction in caveats.

15. Time-to-first-opportunity is met via a priority sync window: the last 90 days of orders, checkouts, and profiles sync first and power the first opportunity; deep history backfills in the background; estimates re-verify when backfill completes (estimate_verified_at records this).

16. dedup_key = account_id + recipe_id: one active opportunity card per recipe per account in v0. Re-detection updates the existing card in place rather than issuing a new one.

17. Expect Klaviyo activation Level 1 (flow-draft creation) to be unavailable in the public API at build time; plan Level 2 (campaign draft) and Level 3 (exportable brief) as the launch reality. Verify current API capabilities at kickoff before scheduling any Level 1 work.

18. Add a Preferences entity for learned merchant preferences (offer stance such as "never discounts", tone corrections, rejection patterns). It is fed by rejection reasons and edits, informs opportunity ranking, and backs the "learned preferences" export in Section 19.

19. v0 architecture is a modular monolith: one deployable (e.g. Next.js + Postgres + a background job queue + one LLM API), where the Section 24.1 services are internal modules with clean interfaces, not separate deployables. Fourteen microservices is not an MVP architecture. Confirm stack at build kickoff.

---

# 27. Claude Code Build Prompt

Apply the Section 26A Build Clarifications patch and the Section 26B Engineering Defaults addendum; where they conflict with earlier sections, they win.

Use this PRD to implement the AI Growth Operator MVP v0.

Build a production-oriented MVP with a demo-mode path. Do not build a traditional CDP dashboard. Build the opportunity feed first.

The product must support one launch profile: Shopify DTC merchant with Klaviyo and Meta Ads. First value must require only Shopify + Klaviyo. GA4 is recommended but not required.

Implement the core loop:

Find money → draft action → approve → activate → measure → learn.

Build exactly three opportunity recipes:

1. abandoned checkout recovery
2. lapsed customer win-back
3. high-LTV Meta audience seed + purchaser suppression

Recipes must be deterministic, versioned, configurable, explainable, and logged.

Build one user-facing Operator. Internal skills can be modular services, but the UI must present one Operator, one feed, one approval queue, and one audit trail.

Build governance as runtime middleware. Every activation must pass through governance. There must be no code path around consent, suppression, approval, Operating Rules, claim checks, or freshness gates.

Build explanation as the required output schema. Recommendations that do not include found / why / data / freshness / assumptions / risk / approval / measurement must not render.

Build a Context Ledger. Every recommendation, draft, approval, rejection, activation, measurement, export, and Operating Rules change must be logged with constitution_version.

Build Klaviyo activation fallback levels:

1. flow draft
2. campaign draft
3. exportable brief
4. manual setup instructions

Build Meta audience sync with directional reporting only. Do not use lift, incrementality, recovered revenue, causal ROAS, or holdout language for Meta in v0.

Build holdouts only for eligible Klaviyo lifecycle flows with audience ≥500. Assign 10% randomized customer-level holdout at launch. Show before/after with no-control tag for smaller audiences. Check contamination risk and disclose it.

Build freshness thresholds and block launches when required data is stale. Provide re-sync action.

Build estimate fallback logic. Use merchant historical rates where available, then conservative modeled estimates, then directional label without dollar value. Do not include low-confidence or directional opportunities in found-money header.

Build unsupported-claim checks. Flag claims such as clinically proven, cures, treats, guaranteed, FDA-approved, medical-grade, safe for all skin types, best, #1, and similar unsupported claims. Suggest safer copy.

Build demo mode with sample data that exercises all three recipes and all three measurement labels.

Prioritize implementation in this order:

1. onboarding and Operating Rules
2. demo data and connector scaffolding
3. context layer
4. opportunity engine and feed
5. opportunity detail
6. drafting and approval
7. activation fallback ladder
8. measurement and holdouts
9. Context Ledger
10. Operator chat
11. export state

Definition of done is the PRD Section 26.
