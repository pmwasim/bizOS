"use client";

import { useActionState } from "react";

import { type ActionState, createLeadAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function LeadForm({ businessId }: { businessId: string }) {
  const action = createLeadAction.bind(null, businessId);
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
          Company <em>Optional</em>
        </span>
        <input name="company" />
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
          Source <em>Optional</em>
        </span>
        <input name="source" placeholder="Referral, website, event…" />
      </label>
      <label className="field">
        <span>
          Estimated value <em>Optional</em>
        </span>
        <input name="estimatedValue" type="number" step="0.01" min="0" />
      </label>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" />
      </label>
      <div className="form-actions">
        <SubmitButton pendingText="Saving lead…">Add lead</SubmitButton>
      </div>
    </form>
  );
}
