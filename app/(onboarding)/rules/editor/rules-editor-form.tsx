"use client";

/**
 * app/(onboarding)/rules/editor/rules-editor-form.tsx — THE THREE NUMBERS
 * form (PRD 12.3). Client component so validation errors from the server
 * action render inline via useActionState.
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
    <label className="block rounded-lg border border-stone-200 bg-white p-4">
      <span className="block text-sm font-semibold text-stone-900">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-stone-500">{hint}</span>
      <span className="mt-3 flex items-baseline gap-2">
        {prefix ? (
          <span className="text-lg font-semibold text-stone-400">{prefix}</span>
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
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-xl font-semibold tracking-tight text-stone-900 focus:border-stone-900 focus:outline-none"
        />
        {suffix ? (
          <span className="text-sm font-medium text-stone-400">{suffix}</span>
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
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
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
