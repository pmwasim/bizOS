"use client";

import { useActionState } from "react";

import { opportunityStageLabelByCode } from "@bizo/contracts/crm";

import { type ActionState, createOpportunityAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function OpportunityForm({
  businessId,
  currencyScale,
}: {
  businessId: string;
  currencyScale: number;
}) {
  const action = createOpportunityAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      {/* The amount is stored in minor units; the action converts using this scale. */}
      <input type="hidden" name="currencyScale" value={currencyScale} />
      <label className="field">
        <span>Name</span>
        <input name="name" required minLength={1} autoFocus />
      </label>
      <label className="field">
        <span>Stage</span>
        <select name="stage" defaultValue="PROSPECTING">
          {Object.entries(opportunityStageLabelByCode).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            Probability (%) <em>Optional</em>
          </span>
          <input name="probability" type="number" min="0" max="100" />
        </label>
        <label className="field">
          <span>
            Amount <em>Optional</em>
          </span>
          <input name="amountMinor" type="number" step="0.01" min="0" />
        </label>
      </div>
      <label className="field">
        <span>
          Expected close date <em>Optional</em>
        </span>
        <input name="expectedCloseDate" type="date" />
      </label>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" />
      </label>
      <div className="form-actions">
        <SubmitButton pendingText="Saving opportunity…">Create opportunity</SubmitButton>
      </div>
    </form>
  );
}
