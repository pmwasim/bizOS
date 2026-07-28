"use client";

import { useActionState } from "react";

import { type ActionState, voidPaymentAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function VoidPaymentButton({
  businessId,
  paymentId,
}: {
  businessId: string;
  paymentId: string;
}) {
  const action = voidPaymentAction.bind(null, businessId, paymentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className="form-stack"
      onSubmit={(event) => {
        if (
          !window.confirm("Void this payment? It will no longer count toward invoice balances.")
        ) {
          event.preventDefault();
        }
      }}
    >
      <ActionMessage error={state.error} />
      <label>
        Reason
        <input name="reason" type="text" maxLength={500} placeholder="Optional reason" />
      </label>
      <SubmitButton className="button button-secondary" pendingText="Voiding…">
        Void payment
      </SubmitButton>
    </form>
  );
}
