"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useActionState } from "react";

import { type PaymentType } from "@bizo/contracts/payments";

import {
  type ActionState,
  markPaymentCompletedAction,
  refundPaymentAction,
  reversePaymentAction,
  voidPaymentAction,
} from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function MarkPaymentCompletedButton({
  businessId,
  paymentId,
}: {
  businessId: string;
  paymentId: string;
}) {
  const action = markPaymentCompletedAction.bind(null, businessId, paymentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction}>
      <ActionMessage error={state.error} />
      <SubmitButton className="button button-primary" pendingText="Completing…">
        <CheckCircle2 size={16} aria-hidden="true" /> Mark as Completed
      </SubmitButton>
    </form>
  );
}

/**
 * Void a DRAFT payment — one that never settled anything. Terminal: the API rejects any later edit,
 * completion, reversal, or refund, so this is only offered while the payment is still a draft.
 */
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
        if (!window.confirm("Void this draft payment? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <ActionMessage error={state.error} />
      <p>Discards this draft. A voided payment can never be edited or completed.</p>
      <label className="field">
        <span>Reason (optional)</span>
        <input name="reason" type="text" maxLength={500} />
      </label>
      <SubmitButton className="button button-secondary" pendingText="Voiding…">
        Void payment
      </SubmitButton>
    </form>
  );
}

/**
 * Reverse a COMPLETED payment. Its allocations stop counting toward invoice settlement immediately —
 * the invoice falls back to its own derived status with no compensating writes.
 */
export function ReversePaymentButton({
  businessId,
  paymentId,
  paymentType = "INBOUND",
}: {
  businessId: string;
  paymentId: string;
  paymentType?: PaymentType;
}) {
  const action = reversePaymentAction.bind(null, businessId, paymentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  const target = paymentType === "OUTBOUND" ? "purchase order balances" : "invoice balances";

  return (
    <form
      action={formAction}
      className="form-stack"
      onSubmit={(event) => {
        if (!window.confirm(`Reverse this payment? It will no longer count toward ${target}.`)) {
          event.preventDefault();
        }
      }}
    >
      <ActionMessage error={state.error} />
      <p>Reverses the payment so it no longer counts toward {target}. This cannot be undone.</p>
      <label className="field">
        <span>Reason (optional)</span>
        <input name="reason" type="text" maxLength={500} />
      </label>
      <SubmitButton className="button button-secondary" pendingText="Reversing…">
        <RotateCcw size={16} aria-hidden="true" /> Reverse payment
      </SubmitButton>
    </form>
  );
}

/**
 * Record a refund against a COMPLETED payment — money returned to the customer, captured as a
 * distinct record. The API fails closed if the cumulative refund would exceed the payment amount.
 */
export function RefundPaymentForm({
  businessId,
  paymentId,
  currencyScale,
}: {
  businessId: string;
  paymentId: string;
  currencyScale: number;
}) {
  const action = refundPaymentAction.bind(null, businessId, paymentId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack">
      <ActionMessage error={state.error} />
      <p>Returns money to the customer. Cannot exceed the remaining unrefunded amount.</p>
      <input name="currencyScale" type="hidden" value={currencyScale} />
      <label className="field">
        <span>Refund amount</span>
        <input name="amount" type="text" inputMode="decimal" placeholder="0.00" required />
      </label>
      <label className="field">
        <span>Reason (optional)</span>
        <input name="reason" type="text" maxLength={500} />
      </label>
      <SubmitButton className="button button-secondary" pendingText="Recording…">
        Record refund
      </SubmitButton>
    </form>
  );
}
