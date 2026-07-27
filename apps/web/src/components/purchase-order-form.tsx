"use client";

import { useActionState } from "react";

import { type ActionState, createPurchaseOrderAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

export function PurchaseOrderForm({
  businessId,
  customers,
  quotations,
  defaultCustomerId,
  defaultQuotationId,
}: {
  businessId: string;
  customers: Array<{ id: string; name: string }>;
  quotations: Array<{ id: string; number: string; customerId: string }>;
  defaultCustomerId?: string;
  defaultQuotationId?: string;
}) {
  const action = createPurchaseOrderAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="form-stack wide">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Customer</span>
        <select name="customerId" required defaultValue={defaultCustomerId ?? ""}>
          <option value="" disabled>
            Select a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Purchase order number</span>
        <input name="poNumber" required maxLength={80} autoFocus placeholder="PO-1042" />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            PO date <em>Optional</em>
          </span>
          <input name="poDate" type="date" />
        </label>
        <label className="field">
          <span>
            Project or job reference <em>Optional</em>
          </span>
          <input name="projectReference" maxLength={120} placeholder="Site A / Job 12" />
        </label>
      </div>
      <label className="field">
        <span>
          Linked quotation <em>Optional</em>
        </span>
        <select name="quotationId" defaultValue={defaultQuotationId ?? ""}>
          <option value="">Link later</option>
          {quotations.map((quotation) => (
            <option key={quotation.id} value={quotation.id}>
              {quotation.number}
            </option>
          ))}
        </select>
      </label>
      <div className="field-grid">
        <label className="field">
          <span>
            Amount <em>Optional</em>
          </span>
          <input name="amount" inputMode="decimal" placeholder="0.00" />
        </label>
        <label className="field">
          <span>
            Currency <em>Optional</em>
          </span>
          <input name="currencyCode" maxLength={3} placeholder="SAR" />
        </label>
      </div>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" rows={3} maxLength={2000} />
      </label>
      <SubmitButton>Save purchase order</SubmitButton>
    </form>
  );
}
