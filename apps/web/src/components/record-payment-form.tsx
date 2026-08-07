"use client";

import { useActionState } from "react";

import { paymentMethodLabel, type PaymentMethod } from "@bizo/contracts/payments";

import { type ActionState, recordPaymentAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

const METHODS: PaymentMethod[] = ["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "OTHER"];

export function RecordPaymentForm({
  businessId,
  invoiceId,
  defaultAmount,
  currencyCode,
}: {
  businessId: string;
  invoiceId: string;
  defaultAmount: string;
  currencyCode: string;
}) {
  const action = recordPaymentAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form className="stack-form" action={formAction}>
      <ActionMessage error={state.error} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label>
        Amount ({currencyCode})
        <input
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={defaultAmount}
          required
        />
      </label>
      <label>
        Received on
        <input name="receivedOn" type="date" defaultValue={today} required />
      </label>
      <label>
        Method
        <select name="method" defaultValue="BANK_TRANSFER" required>
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabel(method)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reference
        <input name="reference" type="text" maxLength={120} placeholder="Optional bank reference" />
      </label>
      <label>
        Notes
        <textarea name="notes" rows={3} maxLength={2000} placeholder="Optional notes" />
      </label>
      <SubmitButton pendingText="Saving…">Record payment</SubmitButton>
    </form>
  );
}
