"use client";

/**
 * app/(onboarding)/setup/page.tsx — Screen 2: Business Setup (PRD 6.1 steps
 * 2-3, 7.1; PRD 25.1 vertical packs). Business type + primary goals. The alpha
 * ships two demo launch profiles: Shopify DTC and Local service (café /
 * bakery / studio). The choice sets Account.vertical server-side (cookie via
 * selectBusinessTypeAction) and routes recipes, Operating Rules template,
 * connectors, and feed copy — trust rule #10.
 *
 * Note: goals have no lib/server persistence in the alpha, so selections are
 * kept in localStorage for continuity only.
 */

// Prerendered pages get s-maxage=1y at the edge and Workers deploys do not
// purge the zone cache — render dynamically so deploys are visible immediately.
export const dynamic = "force-dynamic";

import * as React from "react";
import { selectBusinessTypeAction } from "../actions";
import {
  ClientBadge as Badge,
  ClientButton as Button,
  ClientCard as Card,
} from "../client-ui";

const STORAGE_KEY = "ago.business_setup";

/**
 * Brief v3 micro-interactions — "onboarding selected cards elevate": the
 * chosen card lifts (translate + deeper accent glow) over the gradient
 * surface; inactive cards get a quiet hover lift. 150ms ease-out, and the
 * global reduced-motion kill-switch flattens all of it.
 */
const SELECTED_CARD_CLASSES =
  // Brief v4 premium selected card: proof-gradient wash (blue -> white ->
  // a whisper of emerald), accent ring, lift + proof glow, "Selected" pill.
  "relative cursor-pointer rounded-card border border-accent/60 " +
  "bg-gradient-to-br from-accent-soft/45 via-surface to-emerald-50/45 p-4 text-left " +
  "ring-1 ring-accent/50 -translate-y-0.5 " +
  "shadow-[0_2px_4px_rgb(15_23_42/0.06),0_14px_32px_-8px_var(--glow-proof)] " +
  "transition-[box-shadow,border-color,background-color,translate] duration-150 ease-out";

const INACTIVE_CARD_CLASSES =
  "cursor-pointer rounded-card border border-border bg-surface p-4 text-left " +
  "shadow-card transition-[box-shadow,border-color,translate] duration-150 ease-out " +
  "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover";

/** Small padlock for locked (not-in-v0) choices; decorative only. */
function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3 shrink-0 text-ink-soft"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
    </svg>
  );
}

/** Accent-filled "Selected" pill, pinned top-right of the chosen card. */
function SelectedPill() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold leading-5 text-white shadow-[0_1px_2px_rgb(37_99_235/0.35)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
      </svg>
      Selected
    </span>
  );
}

type BusinessType = "shopify_dtc" | "local_service";

const BUSINESS_TYPES: Array<{
  id: BusinessType;
  label: string;
  description: string;
}> = [
  {
    id: "shopify_dtc",
    label: "Shopify DTC brand",
    description:
      "Direct-to-consumer store on Shopify with Klaviyo for email and Meta Ads for acquisition.",
  },
  {
    id: "local_service",
    label: "Local service (café / bakery / studio)",
    description:
      "In-store business on a Square-like POS with Mailchimp for email and a Google Business Profile — driving in-store purchases.",
  },
];

const DTC_GOALS = [
  {
    id: "recover_abandoned_revenue",
    label: "Recover abandoned revenue",
    hint: "Abandoned checkout recovery flows, net of what your current flows already catch.",
  },
  {
    id: "increase_repeat_purchase",
    label: "Increase repeat purchase",
    hint: "Lapsed-customer win-back based on your customers' real reorder cadence.",
  },
  {
    id: "improve_acquisition_quality",
    label: "Improve acquisition quality",
    hint: "High-LTV Meta seed audiences and recent-purchaser suppression (directional only).",
  },
] as const;

const LOCAL_GOALS = [
  {
    id: "bring_back_lapsed_regulars",
    label: "Bring lapsed regulars back",
    hint: "Win-back based on each regular's real visit cadence — identified (loyalty-matched) customers only.",
  },
  {
    id: "grow_catering_orders",
    label: "Grow catering & large orders",
    hint: "Spot identified customers with repeat large POS orders and upsell catering-scale business.",
  },
  {
    id: "improve_acquisition_quality",
    label: "Improve acquisition quality",
    hint: "High-value Meta seed audiences and recent-purchaser suppression (directional only).",
  },
] as const;

const GOALS_BY_TYPE = {
  shopify_dtc: DTC_GOALS,
  local_service: LOCAL_GOALS,
} as const;

interface StoredSetup {
  businessType: BusinessType;
  goals: string[];
}

export default function BusinessSetupPage() {
  // Selections are recorded to localStorage on continue (see handleContinue);
  // the alpha does not restore them on revisit — the default is deterministic.
  const [businessType, setBusinessType] =
    React.useState<BusinessType>("shopify_dtc");
  const [goals, setGoals] = React.useState<string[]>([DTC_GOALS[0].id]);
  const [touched, setTouched] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const goalOptions = GOALS_BY_TYPE[businessType];

  function selectBusinessType(next: BusinessType) {
    if (next === businessType) return;
    setBusinessType(next);
    // Goals map to the selected vertical's recipes — reset to its default.
    setGoals([GOALS_BY_TYPE[next][0].id]);
    setTouched(false);
  }

  function toggleGoal(goal: string) {
    setTouched(true);
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((g) => g !== goal)
        : [...current, goal],
    );
  }

  function handleContinue() {
    const payload: StoredSetup = { businessType, goals };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage may be unavailable; continuing is more important
    }
    // Server action: sets the vertical cookie, provisions the matching demo
    // workspace, and redirects to /rules.
    startTransition(() => {
      void selectBusinessTypeAction(businessType);
    });
  }

  const goalError = touched && goals.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          Tell the Operator about your business
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          This sets which opportunity recipes run and how they are framed.
        </p>
      </div>

      <Card as="section">
        <h2 className="text-base font-semibold text-ink">Business type</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          The alpha ships two demo launch profiles.
        </p>
        <div
          role="radiogroup"
          aria-label="Business type"
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          {BUSINESS_TYPES.map((type) => {
            const selected = businessType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectBusinessType(type.id)}
                className={selected ? SELECTED_CARD_CLASSES : INACTIVE_CARD_CLASSES}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      selected
                        ? "text-sm font-semibold text-ink"
                        : "text-sm font-semibold text-ink-secondary"
                    }
                  >
                    {type.label}
                  </span>
                  {selected ? <SelectedPill /> : null}
                </div>
                <p
                  className={
                    selected
                      ? "mt-1 text-sm leading-6 text-ink-secondary"
                      : "mt-1 text-sm leading-6 text-ink-muted"
                  }
                >
                  {type.description}
                </p>
              </button>
            );
          })}
          {/* Locked, not broken (brief v4): a calm solid surface with a
              padlock — reads "coming later", never "error". */}
          <div
            role="radio"
            aria-checked="false"
            aria-disabled="true"
            className="rounded-card border border-border bg-surface-soft/60 p-4 select-none shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface"
                >
                  <LockIcon />
                </span>
                Marketplace / B2B / other
              </span>
              <Badge tone="neutral">Not in v0</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Other business types come after these launch profiles prove out.
            </p>
          </div>
        </div>
        {businessType === "local_service" ? (
          <p className="mt-3 rounded-md border border-border bg-neutral-soft px-3 py-2 text-xs leading-5 text-ink-secondary">
            <span className="font-semibold text-ink">
              How local numbers work:{" "}
            </span>
            estimates cover identified (loyalty-matched) customers only — every
            opportunity card and readout states the identified-transaction
            share. Unidentified walk-in sales are never counted.
          </p>
        ) : null}
      </Card>

      <Card as="section">
        <h2 className="text-base font-semibold text-ink">Primary goals</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Pick at least one. Each maps to one of the three recipes in this
          profile.
        </p>
        <div className="mt-4 space-y-3">
          {goalOptions.map((goal) => {
            const checked = goals.includes(goal.id);
            return (
              <label
                key={goal.id}
                className={
                  checked
                    ? `flex items-start gap-3 ${SELECTED_CARD_CLASSES}`
                    : `flex items-start gap-3 ${INACTIVE_CARD_CLASSES}`
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGoal(goal.id)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {goal.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-6 text-ink-muted">
                    {goal.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {goalError ? (
          <p className="mt-3 text-sm font-medium text-red-700">
            Select at least one goal to continue.
          </p>
        ) : null}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          onClick={handleContinue}
          disabled={goals.length === 0 || pending}
        >
          {pending ? "Setting up your workspace…" : "Continue to Operating Rules"}
        </Button>
      </div>
    </div>
  );
}
