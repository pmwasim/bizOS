"use client";

import { useActionState } from "react";

import { type ActionState, createSupplierAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SupplierForm({ businessId }: { businessId: string }) {
  const action = createSupplierAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Name</span>
        <input name="name" required minLength={1} autoFocus />
      </label>
      <label className="field">
        <span>
          Contact name <em>Optional</em>
        </span>
        <input name="contactName" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            Email <em>Optional</em>
          </span>
          <input name="email" type="email" inputMode="email" autoComplete="email" />
        </label>
        <label className="field">
          <span>
            Phone <em>Optional</em>
          </span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>
            Country <em>Optional</em>
          </span>
          <select name="countryCode" defaultValue="">
            <option value="">Not specified</option>
            <option value="SA">Saudi Arabia (SA)</option>
            <option value="AE">United Arab Emirates (AE)</option>
            <option value="IN">India (IN)</option>
          </select>
        </label>
        <label className="field">
          <span>
            Tax ID <em>Optional</em>
          </span>
          <input
            name="taxId"
            autoComplete="off"
            aria-describedby="taxId-hint"
            placeholder="e.g. 310000000000003"
          />
          <small id="taxId-hint" className="field-hint">
            SA: 15 digits starting and ending with 3. AE: 15 digits. IN: 15-character GSTIN.
          </small>
        </label>
      </div>
      <label className="field">
        <span>
          Payment terms (days) <em>Optional</em>
        </span>
        <input name="paymentTerms" type="number" min="0" max="365" step="1" />
      </label>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" />
      </label>
      <div className="form-actions">
        <SubmitButton pendingText="Saving supplier…">Add supplier</SubmitButton>
      </div>
    </form>
  );
}
