"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { type ActionState, sendQuotationAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SendQuotationForm({
  businessId,
  customerEmail,
  customerName,
  quotationId,
  sent,
}: {
  businessId: string;
  customerEmail: string | null;
  customerName: string;
  quotationId: string;
  sent: boolean;
}) {
  const action = sendQuotationAction.bind(null, businessId, quotationId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="send-panel">
      <div>
        <span className="eyebrow">{sent ? "Send again" : "Ready to send"}</span>
        <h2>{sent ? "Resend this quotation" : `Send to ${customerName}`}</h2>
      </div>
      <ActionMessage error={state.error} />
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
          defaultValue={`Hi ${customerName},\n\nPlease find our quotation attached. Let me know if you have any questions.`}
        />
      </label>
      <SubmitButton pendingText="Sending…">
        <Send aria-hidden="true" size={17} /> {sent ? "Send again" : "Send quotation"}
      </SubmitButton>
      <small className="send-note">A PDF copy will be attached automatically.</small>
    </form>
  );
}
