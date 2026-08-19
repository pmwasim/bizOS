"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { type ActionState, sendStatementAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

/**
 * Emails the customer their account statement with a PDF attached. The hidden period fields carry
 * the range currently in view, so the email matches the statement on screen; the send is idempotent
 * server-side, so re-sending the same statement to the same address does not deliver twice.
 */
export function SendStatementForm({
  businessId,
  customerId,
  customerEmail,
  customerName,
  startDate,
  endDate,
}: {
  businessId: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
}) {
  const action = sendStatementAction.bind(null, businessId, customerId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="send-panel">
      <div>
        <span className="eyebrow">Statement</span>
        <h2>Email statement to {customerName}</h2>
      </div>
      <ActionMessage error={state.error} />
      {startDate ? <input type="hidden" name="startDate" value={startDate} /> : null}
      {endDate ? <input type="hidden" name="endDate" value={endDate} /> : null}
      <label className="field">
        <span>Email</span>
        <input
          name="recipientEmail"
          type="email"
          defaultValue={customerEmail ?? ""}
          placeholder="customer@example.com"
          required
        />
      </label>
      <label className="field">
        <span>
          Message <em>Optional</em>
        </span>
        <textarea
          name="message"
          rows={3}
          defaultValue={`Hi ${customerName},\n\nPlease find your account statement attached. Let me know if you have any questions.`}
        />
      </label>
      <SubmitButton pendingText="Sending…">
        <Send aria-hidden="true" size={17} /> Send statement
      </SubmitButton>
      <small className="send-note">A PDF copy is attached automatically.</small>
    </form>
  );
}
