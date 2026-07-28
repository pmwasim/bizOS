"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";

import { type ActionState, sendInvoiceAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SendInvoiceForm({
  businessId,
  customerEmail,
  customerName,
  invoiceId,
  sendFailed,
  sent,
}: {
  businessId: string;
  customerEmail: string | null;
  customerName: string;
  invoiceId: string;
  sendFailed: boolean;
  sent: boolean;
}) {
  const action = sendInvoiceAction.bind(null, businessId, invoiceId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const retry = sent || sendFailed;
  return (
    <form action={formAction} className="send-panel">
      <div>
        <span className="eyebrow">{retry ? "Send again" : "Ready to send"}</span>
        <h2>{retry ? "Resend this invoice" : `Send to ${customerName}`}</h2>
      </div>
      <ActionMessage error={state.error} />
      {sendFailed ? (
        <p className="send-note">The last email attempt failed. The invoice was not marked sent.</p>
      ) : null}
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
          defaultValue={`Hi ${customerName},\n\nPlease find our invoice attached. Let me know if you have any questions.`}
        />
      </label>
      <SubmitButton pendingText="Sending…">
        <Send aria-hidden="true" size={17} /> {retry ? "Send again" : "Send invoice"}
      </SubmitButton>
      <small className="send-note">A PDF copy will be attached automatically.</small>
    </form>
  );
}
