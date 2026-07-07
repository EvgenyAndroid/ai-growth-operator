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

import * as React from "react";
import { selectBusinessTypeAction } from "../actions";
import {
  ClientBadge as Badge,
  ClientButton as Button,
  ClientCard as Card,
} from "../client-ui";

const STORAGE_KEY = "ago.business_setup";

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
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Tell the Operator about your business
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          This sets which opportunity recipes run and how they are framed.
        </p>
      </div>

      <Card as="section">
        <h2 className="text-base font-semibold text-stone-900">Business type</h2>
        <p className="mt-0.5 text-sm text-stone-500">
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
                className={
                  selected
                    ? "rounded-lg border-2 border-stone-900 bg-stone-50 p-4 text-left"
                    : "rounded-lg border border-stone-200 p-4 text-left hover:border-stone-400"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      selected
                        ? "text-sm font-semibold text-stone-900"
                        : "text-sm font-semibold text-stone-700"
                    }
                  >
                    {type.label}
                  </span>
                  {selected ? <Badge tone="positive">Selected</Badge> : null}
                </div>
                <p
                  className={
                    selected
                      ? "mt-1 text-sm leading-6 text-stone-600"
                      : "mt-1 text-sm leading-6 text-stone-500"
                  }
                >
                  {type.description}
                </p>
              </button>
            );
          })}
          <div
            role="radio"
            aria-checked="false"
            aria-disabled="true"
            className="rounded-lg border border-dashed border-stone-300 p-4 opacity-60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-700">
                Marketplace / B2B / other
              </span>
              <Badge tone="neutral">Not in v0</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Other business types come after these launch profiles prove out.
            </p>
          </div>
        </div>
        {businessType === "local_service" ? (
          <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
            <span className="font-semibold text-stone-800">
              How local numbers work:{" "}
            </span>
            estimates cover identified (loyalty-matched) customers only — every
            opportunity card and readout states the identified-transaction
            share. Unidentified walk-in sales are never counted.
          </p>
        ) : null}
      </Card>

      <Card as="section">
        <h2 className="text-base font-semibold text-stone-900">Primary goals</h2>
        <p className="mt-0.5 text-sm text-stone-500">
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
                    ? "flex cursor-pointer items-start gap-3 rounded-lg border-2 border-stone-900 bg-stone-50 p-4"
                    : "flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 hover:border-stone-400"
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleGoal(goal.id)}
                  className="mt-1 h-4 w-4 accent-stone-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-900">
                    {goal.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-6 text-stone-500">
                    {goal.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {goalError ? (
          <p className="mt-3 text-sm font-medium text-rose-700">
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
