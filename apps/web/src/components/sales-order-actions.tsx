"use client";

import { useActionState } from "react";

import { type ActionState, cancelSalesOrderAction, confirmSalesOrderAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SalesOrderActions({
  businessId,
  salesOrderId,
  status,
}: {
  businessId: string;
  salesOrderId: string;
  status: string;
}) {
  const confirm = confirmSalesOrderAction.bind(null, businessId, salesOrderId);
  const cancel = cancelSalesOrderAction.bind(null, businessId, salesOrderId);
  const [confirmState, confirmAction] = useActionState<ActionState, FormData>(confirm, {});
  const [cancelState, cancelAction] = useActionState<ActionState, FormData>(cancel, {});

  if (status !== "DRAFT" && status !== "CONFIRMED") return null;

  return (
    <section className="panel">
      <h2>Status</h2>
      {status === "DRAFT" ? (
        <form action={confirmAction} className="form-stack">
          <ActionMessage error={confirmState.error} />
          <p>Confirm this order once the customer has agreed to it.</p>
          <SubmitButton>Confirm sales order</SubmitButton>
        </form>
      ) : null}
      <form
        action={cancelAction}
        className="form-stack"
        style={{ marginTop: "1rem" }}
        onSubmit={(event) => {
          if (!window.confirm("Cancel this sales order?")) {
            event.preventDefault();
          }
        }}
      >
        <ActionMessage error={cancelState.error} />
        <SubmitButton>Cancel sales order</SubmitButton>
      </form>
    </section>
  );
}
