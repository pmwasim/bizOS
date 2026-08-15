"use client";

import { useActionState, useState } from "react";

import { type ActionState, createSalesOrderAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

interface CustomerOption {
  id: string;
  name: string;
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

export function SalesOrderForm({
  businessId,
  customers,
  defaultCustomerId,
}: {
  businessId: string;
  customers: CustomerOption[];
  defaultCustomerId?: string | undefined;
}) {
  const action = createSalesOrderAction.bind(null, businessId);
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
        <select name="customerId" defaultValue={defaultCustomerId ?? customers[0]?.id} required>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="lines-editor">
        <h3>Line items</h3>
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
        <SubmitButton pendingText="Saving sales order…">Create sales order</SubmitButton>
      </div>
    </form>
  );
}
