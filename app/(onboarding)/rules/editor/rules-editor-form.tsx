"use client";

/**
 * app/(onboarding)/rules/editor/rules-editor-form.tsx — THE THREE NUMBERS
 * form (PRD 12.3). Client component so validation errors from the server
 * action render inline via useActionState.
 *
 * Visual: a single segmented control panel (design brief "Operating Rules —
 * control panel, not settings dump") — three number tiles in one bordered
 * surface, large tabular numerals, accent focus treatment.
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
    <label className="block bg-surface p-5 transition-colors duration-150 focus-within:bg-accent-soft/15">
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{hint}</span>
      <span className="mt-4 flex items-baseline gap-2">
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
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-2xl font-semibold tracking-tight text-ink tabular-nums shadow-[inset_0_1px_2px_rgb(15_23_42/0.03)] transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20"
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
      <div className="grid gap-px overflow-hidden rounded-card border border-border bg-border shadow-card sm:grid-cols-3">
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
