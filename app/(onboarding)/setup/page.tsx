"use client";

/**
 * app/(onboarding)/setup/page.tsx — Screen 2: Business Setup (PRD 6.1 steps
 * 2-3, 7.1). Business type + primary goals. v0 ships one launch profile
 * (Shopify DTC merchant with Klaviyo and Meta Ads), so other types are
 * visible but not selectable.
 *
 * Note: lib/server exposes no persistence for business type / goals in the
 * alpha, so selections are kept in localStorage for continuity only.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClientBadge as Badge,
  ClientButton as Button,
  ClientCard as Card,
} from "../client-ui";

const STORAGE_KEY = "ago.business_setup";

const GOALS = [
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

type GoalId = (typeof GOALS)[number]["id"];

interface StoredSetup {
  businessType: string;
  goals: GoalId[];
}

export default function BusinessSetupPage() {
  const router = useRouter();
  // Selections are recorded to localStorage on continue (see handleContinue);
  // the alpha does not restore them on revisit — the default is deterministic.
  const [goals, setGoals] = React.useState<GoalId[]>([
    "recover_abandoned_revenue",
  ]);
  const [touched, setTouched] = React.useState(false);

  function toggleGoal(goal: GoalId) {
    setTouched(true);
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((g) => g !== goal)
        : [...current, goal],
    );
  }

  function handleContinue() {
    const payload: StoredSetup = { businessType: "shopify_dtc", goals };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage may be unavailable; continuing is more important
    }
    router.push("/rules");
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
          v0 supports one launch profile.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            role="radio"
            aria-checked="true"
            className="rounded-lg border-2 border-stone-900 bg-stone-50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-900">
                Shopify DTC
              </span>
              <Badge tone="positive">Selected</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Direct-to-consumer store on Shopify with Klaviyo for email and
              Meta Ads for acquisition.
            </p>
          </div>
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
              Other business types come after the Shopify DTC launch profile
              proves out.
            </p>
          </div>
        </div>
      </Card>

      <Card as="section">
        <h2 className="text-base font-semibold text-stone-900">Primary goals</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Pick at least one. Each maps to one of the three v0 recipes.
        </p>
        <div className="mt-4 space-y-3">
          {GOALS.map((goal) => {
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
        <Button onClick={handleContinue} disabled={goals.length === 0}>
          Continue to Operating Rules
        </Button>
      </div>
    </div>
  );
}
