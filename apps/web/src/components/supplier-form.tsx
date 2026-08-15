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
      <label className="field">
        <span>
          Tax ID <em>Optional</em>
        </span>
        <input name="taxId" />
      </label>
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
