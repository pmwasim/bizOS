"use client";

import { useActionState } from "react";

import {
  type ActionState,
  archiveInvoiceAction,
  createInvoiceFromQuotationAction,
  markInvoiceReadyAction,
} from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function CreateInvoiceFromQuotationButton({
  businessId,
  quotationId,
}: {
  businessId: string;
  quotationId: string;
}) {
  const action = createInvoiceFromQuotationAction.bind(null, businessId, quotationId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction}>
      <ActionMessage error={state.error} />
      <SubmitButton pendingText="Creating…">Create invoice</SubmitButton>
    </form>
  );
}

export function MarkInvoiceReadyButton({
  businessId,
  invoiceId,
}: {
  businessId: string;
  invoiceId: string;
}) {
  const action = markInvoiceReadyAction.bind(null, businessId, invoiceId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction}>
      <ActionMessage error={state.error} />
      <SubmitButton className="button button-secondary" pendingText="Updating…">
        Mark ready to send
      </SubmitButton>
    </form>
  );
}

export function ArchiveInvoiceButton({
  businessId,
  invoiceId,
}: {
  businessId: string;
  invoiceId: string;
}) {
  const action = archiveInvoiceAction.bind(null, businessId, invoiceId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction}>
      <ActionMessage error={state.error} />
      <SubmitButton className="button button-secondary" pendingText="Archiving…">
        Archive invoice
      </SubmitButton>
    </form>
  );
}
