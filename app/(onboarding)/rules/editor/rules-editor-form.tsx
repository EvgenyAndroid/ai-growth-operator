"use client";

/**
 * app/(onboarding)/rules/editor/rules-editor-form.tsx — THE THREE NUMBERS
 * form (PRD 12.3). Client component so validation errors from the server
 * action render inline via useActionState.
 *
 * Visual: brief v3 area 8 "control room" — THE THREE NUMBERS as key-control
 * cards: each number is its own elevated card with an accent top rail that
 * brightens on focus, hover/focus lift, and large tabular numerals. The
 * inputs stay bottom-pinned (mt-auto) inside equal-height cards so the three
 * value rows align across the grid regardless of hint length.
 */

import * as React from "react";
import { useActionState } from "react";
import { saveRulesAction, type SaveRulesFormState } from "../../actions";
import { SubmitButton } from "../../submit-button";

const INITIAL_STATE: SaveRulesFormState = { error: null };

function NumberField({
  name,
  label,
  hint,
  defaultValue,
  prefix,
  suffix,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  prefix?: string;
  suffix?: string;
  min: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card transition-[border-color,box-shadow,translate] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-within:-translate-y-0.5 focus-within:border-accent/50 focus-within:shadow-[0_2px_6px_rgb(15_23_42/0.06),0_14px_36px_-10px_var(--color-accent-glow)]">
      {/* Key-control top rail — brightens while the control is focused. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-accent/70 via-accent/25 to-transparent opacity-50 transition-opacity duration-150 group-focus-within:opacity-100"
      />
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{hint}</span>
      <span className="mt-auto flex items-baseline gap-2 pt-4">
        {prefix ? (
          <span className="text-xl font-semibold text-ink-soft">{prefix}</span>
        ) : null}
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          required
          min={min}
          max={max}
          step={step ?? 1}
          inputMode="numeric"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-3xl font-semibold tracking-tight text-ink tabular-nums shadow-[inset_0_1px_2px_rgb(15_23_42/0.03)] transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
        />
        {suffix ? (
          <span className="text-xs font-medium whitespace-nowrap text-ink-soft">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function RulesEditorForm({
  accountId,
  defaults,
}: {
  accountId: string;
  defaults: {
    monthlyBudgetCap: number;
    maxDiscountPercent: number;
    dailySendCap: number;
  };
}) {
  const [state, formAction] = useActionState(saveRulesAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          name="monthlyBudgetCap"
          label="Monthly budget cap"
          hint="Ceiling on spend the Operator may propose per month."
          defaultValue={defaults.monthlyBudgetCap}
          prefix="$"
          min={0}
          step={50}
        />
        <NumberField
          name="maxDiscountPercent"
          label="Maximum discount"
          hint="No draft will ever offer more than this."
          defaultValue={defaults.maxDiscountPercent}
          suffix="%"
          min={0}
          max={100}
        />
        <NumberField
          name="dailySendCap"
          label="Daily send cap"
          hint="Launches above this audience size are blocked by governance."
          defaultValue={defaults.dailySendCap}
          suffix="emails / day"
          min={0}
          step={50}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-danger-soft/60 px-3 py-2 text-sm font-medium text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving Operating Rules…">
          Save and connect data sources
        </SubmitButton>
      </div>
    </form>
  );
}
