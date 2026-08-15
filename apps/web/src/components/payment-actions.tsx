"use client";

import { useActionState } from "react";

import { type PaymentType } from "@bizo/contracts/payments";

import { type ActionState, voidPaymentAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function VoidPaymentButton({
  businessId,
  paymentId,
  paymentType,
}: {
  businessId: string;
  paymentId: string;
  paymentType: PaymentType;
}) {
  const action = voidPaymentAction.bind(null, businessId, paymentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  // An OUTBOUND payment is allocated to purchase orders, not invoices, so naming invoices here
  // would describe the wrong financial transition — and a reversal cannot be undone.
  const target = paymentType === "OUTBOUND" ? "purchase order balances" : "invoice balances";

  return (
    <form
      action={formAction}
      className="form-stack"
      onSubmit={(event) => {
        if (!window.confirm(`Void this payment? It will no longer count toward ${target}.`)) {
          event.preventDefault();
        }
      }}
    >
      <ActionMessage error={state.error} />
      {/*
        No reason field: the API models undoing a payment as a status transition to REVERSED and
        stores no reason, so collecting one would promise the user a record that is never kept.
      */}
      <p>Reverses the payment so it no longer counts toward {target}.</p>
      <SubmitButton className="button button-secondary" pendingText="Voiding…">
        Void payment
      </SubmitButton>
    </form>
  );
}
