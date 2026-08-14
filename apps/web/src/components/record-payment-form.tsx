"use client";

import { useActionState } from "react";

import { type ActionState, recordPaymentAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function RecordPaymentForm({
  businessId,
  invoiceId,
  defaultAmount,
  currencyCode,
  currencyScale,
}: {
  businessId: string;
  invoiceId: string;
  defaultAmount: string;
  currencyCode: string;
  currencyScale: number;
}) {
  const action = recordPaymentAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form className="stack-form" action={formAction}>
      <ActionMessage error={state.error} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="currencyCode" value={currencyCode} />
      <input type="hidden" name="currencyScale" value={currencyScale} />
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
      {/*
        No payment-method field: the deployed payments table has no method column, so anything
        chosen here would be silently discarded on save. Restoring it needs a migration adding
        the column plus the matching contract field.
      */}
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
