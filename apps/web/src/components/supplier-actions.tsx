"use client";

import { useActionState } from "react";

import { type ActionState, deactivateSupplierAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function SupplierActions({
  businessId,
  supplierId,
}: {
  businessId: string;
  supplierId: string;
}) {
  const deactivate = deactivateSupplierAction.bind(null, businessId, supplierId);
  const [state, action] = useActionState<ActionState, FormData>(deactivate, {});

  return (
    <section className="panel danger-panel">
      <h2>Deactivate</h2>
      <p>Deactivated suppliers stay on record but drop out of new purchase workflows.</p>
      <form
        action={action}
        className="form-stack"
        onSubmit={(event) => {
          if (!window.confirm("Deactivate this supplier?")) {
            event.preventDefault();
          }
        }}
      >
        <ActionMessage error={state.error} />
        <SubmitButton>Deactivate supplier</SubmitButton>
      </form>
    </section>
  );
}
