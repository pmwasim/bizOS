"use client";

import { useActionState, useState } from "react";

import { creditNoteReasonLabelByCode } from "@bizo/contracts/credit-notes";

import { type ActionState, createCreditNoteAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

interface CustomerOption {
  id: string;
  name: string;
}

interface InvoiceOption {
  id: string;
  number: string;
}

interface EditorLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
}

function newLine(): EditorLine {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
    taxRatePercent: "15",
  };
}

export function CreditNoteForm({
  businessId,
  customers,
  invoices,
  defaultInvoiceId,
}: {
  businessId: string;
  customers: CustomerOption[];
  invoices: InvoiceOption[];
  defaultInvoiceId?: string | undefined;
}) {
  const action = createCreditNoteAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [lines, setLines] = useState<EditorLine[]>([
    { id: "line-1", description: "", quantity: "1", unitPrice: "0", taxRatePercent: "15" },
  ]);

  const update = (id: string, field: keyof EditorLine, value: string) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  };

  return (
    <form action={formAction} className="form-stack wide">
      <ActionMessage error={state.error} />
      <label className="field">
        <span>Customer</span>
        <select name="customerId" defaultValue={customers[0]?.id} required>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Reference invoice <em>Optional</em>
        </span>
        <select name="referenceInvoiceId" defaultValue={defaultInvoiceId ?? ""}>
          <option value="">No reference invoice</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Reason</span>
        <select name="reason" defaultValue="BILLING_ERROR">
          {Object.entries(creditNoteReasonLabelByCode).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="lines-editor">
        <h3>Credit lines</h3>
        {lines.map((line, index) => (
          <div className="line-row" key={line.id}>
            <input
              name="description"
              value={line.description}
              onChange={(e) => update(line.id, "description", e.target.value)}
              placeholder="Description"
              required
              autoFocus={index === 0}
            />
            <input
              name="quantity"
              value={line.quantity}
              onChange={(e) => update(line.id, "quantity", e.target.value)}
              placeholder="Qty"
              inputMode="decimal"
              required
            />
            <input
              name="unitPrice"
              value={line.unitPrice}
              onChange={(e) => update(line.id, "unitPrice", e.target.value)}
              placeholder="Unit price"
              inputMode="decimal"
              required
            />
            <input
              name="taxRatePercent"
              value={line.taxRatePercent}
              onChange={(e) => update(line.id, "taxRatePercent", e.target.value)}
              placeholder="Tax %"
              inputMode="decimal"
              required
            />
          </div>
        ))}
        <button
          type="button"
          className="button button-quiet"
          onClick={() => setLines((current) => [...current, newLine()])}
        >
          Add line
        </button>
      </div>
      <div className="form-actions">
        <SubmitButton pendingText="Saving credit note…">Create credit note</SubmitButton>
      </div>
    </form>
  );
}
