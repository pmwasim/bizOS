"use client";

import { useActionState } from "react";

import { type ActionState, createCustomerAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function CustomerForm({ businessId }: { businessId: string }) {
  const action = createCustomerAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="form-stack wide">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Customer or company name</span>
        <input name="name" required minLength={2} autoFocus placeholder="Acme Studio" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="hello@acme.com"
          />
          <small>We’ll use this when you send the quotation.</small>
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
          Address <em>Optional</em>
        </span>
        <input name="addressLine1" autoComplete="street-address" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            City <em>Optional</em>
          </span>
          <input name="city" autoComplete="address-level2" />
        </label>
        <label className="field">
          <span>
            Country <em>Optional</em>
          </span>
          <select name="countryCode" defaultValue="SA">
            <option value="SA">Saudi Arabia</option>
            <option value="AE">United Arab Emirates</option>
            <option value="GB">United Kingdom</option>
            <option value="US">United States</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <SubmitButton pendingText="Saving customer…">Save and create quotation</SubmitButton>
      </div>
    </form>
  );
}
