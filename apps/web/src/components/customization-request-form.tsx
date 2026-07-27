"use client";

import { useActionState } from "react";

import { type ActionState, createCustomizationRequestAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function CustomizationRequestForm({ businessId }: { businessId: string }) {
  const action = createCustomizationRequestAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="settings-form">
      <ActionMessage error={state.error} />
      <section className="settings-section">
        <div>
          <h2>Describe your process</h2>
          <p>Help us understand how your business operates today.</p>
        </div>
        <div className="form-stack">
          <label className="field">
            <span>Stated business process</span>
            <textarea
              name="statedProcess"
              rows={5}
              required
              placeholder="Example: We send a quotation, collect a purchase order, then invoice after delivery."
            />
          </label>
          <label className="field">
            <span>Requested changes</span>
            <textarea
              name="requestedChanges"
              rows={5}
              required
              placeholder="Example: Add a custom invoice prefix and require manager approval before sending."
            />
          </label>
          <label className="field">
            <span>Urgency</span>
            <select name="urgency" defaultValue="MEDIUM" required>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label className="field">
            <span>
              Notes <em>Optional</em>
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Anything else we should know before reviewing your request."
            />
          </label>
          <label className="field checkbox-row">
            <input name="consentToReview" type="checkbox" required />
            <span>
              I consent to a configuration review. bizOS will store this request and our team may
              follow up about the requested changes.
            </span>
          </label>
        </div>
      </section>
      <SubmitButton>Submit customization request</SubmitButton>
    </form>
  );
}
