/**
 * lib/recipes/local/drafts.ts — deterministic Mailchimp-style template copy
 * for the LOCAL recipes (PRD 25.1: NO LLM, parameterized templates only).
 *
 * Consumed by lib/server/draft-templates.ts through the existing draft ladder:
 *  - local_lapsed_regular -> campaign-draft level, 2-step win-back email
 *  - catering_upsell      -> exportable-brief level, single personal outreach
 *    email the owner sends individually
 *
 * Copy law (belt; governance claims gate is suspenders):
 *  - no phrase from DEFAULT_BANNED_CLAIMS (mind "best", "guaranteed", and the
 *    bakery-trap "treats" — the claims scanner matches substrings in copy)
 *  - offer steps never exceed the Operating Rules discount ceiling (PRD 12.4)
 *  - offer_stance === "avoid_discounts" (26B.18) swaps offers for
 *    non-discount angles; the non-discount angle always comes first (PRD 6.3)
 */

/** Structurally identical to lib/server DraftCopyStep (import direction: server -> modules). */
export interface LocalDraftStep {
  step: number;
  channel: "email" | "meta_audience";
  subject?: string;
  previewText?: string;
  body: string;
  /** Present only on offer steps; always <= Operating Rules discount ceiling. */
  offerPercent?: number;
  sendDelayHours?: number;
}

export interface LocalDraftParams {
  brandName: string;
  /** Operating Rules discount ceiling (Constitution.maxDiscountPercent). */
  maxDiscountPercent: number;
  /** 26B.18 learned preference — true when the merchant avoids discounts. */
  avoidDiscounts: boolean;
}

const DEFAULT_OFFER_PERCENT = 10;

function offerPercentFor(params: LocalDraftParams): number {
  return Math.min(DEFAULT_OFFER_PERCENT, Math.floor(params.maxDiscountPercent));
}

/** local_lapsed_regular — Mailchimp-style 2-step win-back campaign draft. */
export function buildLocalLapsedRegularSteps(
  params: LocalDraftParams,
): LocalDraftStep[] {
  const { brandName, avoidDiscounts } = params;
  const offerPercent = offerPercentFor(params);
  const steps: LocalDraftStep[] = [
    // PRD 6.3 — non-discount angle FIRST.
    {
      step: 1,
      channel: "email",
      sendDelayHours: 0,
      subject: `We've missed you at ${brandName}`,
      previewText: "Your usual is still here — and a few things are new.",
      body: `Hi {{first_name}},\n\nIt's been a little while since your last visit, and we wanted to say we've missed seeing you. Your usual order is still on the menu, and a few new bakes have joined it since you were last in.\n\nStop by whenever it suits — we'll have the coffee ready.\n\n— Everyone at ${brandName}`,
    },
  ];
  if (!avoidDiscounts && offerPercent > 0) {
    steps.push({
      step: 2,
      channel: "email",
      sendDelayHours: 96,
      subject: `A little welcome-back from ${brandName}`,
      previewText: `${offerPercent}% off your next visit, on us.`,
      offerPercent,
      body: `Hi {{first_name}},\n\nConsider this a small nudge: show this email (or mention code {{offer_code}}) on your next visit and we'll take ${offerPercent}% off your order. Valid for the next 14 days.\n\nSee you soon,\n— Everyone at ${brandName}`,
    });
  } else {
    steps.push({
      step: 2,
      channel: "email",
      sendDelayHours: 96,
      subject: `New at ${brandName} since your last visit`,
      previewText: "A quick look at what's fresh out of the oven.",
      body: `Hi {{first_name}},\n\nA few things have changed since your last visit — new seasonal bakes, a rotating single-origin coffee, and weekend specials. Here's what regulars have been ordering lately:\n\n{{whats_new_block}}\n\nHope to see you soon,\n— Everyone at ${brandName}`,
    });
  }
  return steps;
}

/**
 * catering_upsell — single-step personal outreach email BRIEF (exportable
 * brief level: the owner personalizes and sends each note individually;
 * nothing is automated and no holdout can be enforced at this level, 26A.1).
 */
export function buildCateringUpsellBrief(
  params: LocalDraftParams,
): LocalDraftStep[] {
  const { brandName } = params;
  return [
    {
      step: 1,
      channel: "email",
      sendDelayHours: 0,
      subject: `Catering from ${brandName}?`,
      previewText: "A personal note — no automation, no pressure.",
      body: `Hi {{first_name}},\n\nThis is {{owner_name}} from ${brandName} — thank you for the larger orders you've placed with us recently ({{recent_large_orders}}). Orders that size usually mean an office, a team, or an event on the other end, so I wanted to reach out personally.\n\nWe do simple catering: trays of what you already order, delivered or ready for pickup, with per-person pricing that works out kinder than register prices. If that would ever make your day easier, just reply to this note and I'll put a menu together for you.\n\nAnd if I've misread the situation — no worries at all, and thank you for being such a great customer.\n\nWarmly,\n{{owner_name}}\n${brandName}`,
    },
  ];
}
