"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { type Invoice } from "@bizo/contracts/invoices";
import { formatScaledInteger } from "@bizo/contracts/money";

import { type ActionState, updateInvoiceAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";
import { estimateQuotationTotal } from "@/lib/display";

interface EditorLine {
  description: string;
  id: string;
  quantity: string;
  taxRatePercent: string;
  unitPrice: string;
}

function toEditorLines(invoice: Invoice): EditorLine[] {
  return invoice.lines.map((line) => ({
    id: `line-${line.position}`,
    description: line.description,
    quantity: line.quantity,
    unitPrice: formatScaledInteger(BigInt(line.unitPriceMinor), invoice.currencyScale),
    taxRatePercent: formatScaledInteger(BigInt(line.taxRatePpm), 4).replace(/\.?0+$/, "") || "0",
  }));
}

export function InvoiceEditor({
  businessId,
  currency,
  invoice,
  locale,
}: {
  businessId: string;
  currency: string;
  invoice: Invoice;
  locale: string;
}) {
  const action = updateInvoiceAction.bind(null, businessId, invoice.id);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [lines, setLines] = useState<EditorLine[]>(() => toEditorLines(invoice));
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [currency, locale],
  );
  const total = estimateQuotationTotal(lines);

  function update(id: string, field: keyof EditorLine, value: string) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "1",
        unitPrice: "",
        taxRatePercent: lines[0]?.taxRatePercent ?? "0",
      },
    ]);
  }

  return (
    <form action={formAction} className="quote-editor">
      <ActionMessage error={state.error} />
      <div className="detail-grid">
        <label className="field">
          <span>Issue date</span>
          <input name="issueDate" type="date" defaultValue={invoice.issueDate} required />
        </label>
        <label className="field">
          <span>Due date</span>
          <input name="dueDate" type="date" defaultValue={invoice.dueDate} required />
        </label>
      </div>
      <label className="field">
        <span>
          Notes <em>Optional</em>
        </span>
        <textarea name="notes" rows={3} defaultValue={invoice.notes ?? ""} maxLength={2000} />
      </label>
      <div className="line-header" aria-hidden="true">
        <span>What are you billing?</span>
        <span>Qty</span>
        <span>Price</span>
        <span>Tax %</span>
        <span />
      </div>
      <div className="quote-lines">
        {lines.map((line, index) => (
          <fieldset className="quote-line" key={line.id}>
            <legend className="sr-only">Item {index + 1}</legend>
            <label>
              <span className="mobile-field-label">Description</span>
              <input
                value={line.description}
                onChange={(event) => update(line.id, "description", event.target.value)}
                placeholder="e.g. Website design"
                required
                maxLength={500}
              />
            </label>
            <label>
              <span className="mobile-field-label">Quantity</span>
              <input
                value={line.quantity}
                onChange={(event) => update(line.id, "quantity", event.target.value)}
                inputMode="decimal"
                required
                aria-label={`Item ${index + 1} quantity`}
              />
            </label>
            <label>
              <span className="mobile-field-label">Price</span>
              <div className="money-input">
                <span>{currency}</span>
                <input
                  value={line.unitPrice}
                  onChange={(event) => update(line.id, "unitPrice", event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                  aria-label={`Item ${index + 1} price in ${currency}`}
                />
              </div>
            </label>
            <label>
              <span className="mobile-field-label">Tax %</span>
              <input
                value={line.taxRatePercent}
                onChange={(event) => update(line.id, "taxRatePercent", event.target.value)}
                inputMode="decimal"
                aria-label={`Item ${index + 1} tax percent`}
                required
              />
            </label>
            <button
              className="icon-button"
              type="button"
              onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
              disabled={lines.length === 1}
              aria-label={`Remove item ${index + 1}`}
            >
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </fieldset>
        ))}
      </div>
      <button className="add-line" type="button" onClick={addLine}>
        <Plus aria-hidden="true" size={17} /> Add another item
      </button>
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(lines.map(({ id: _id, ...line }) => line))}
      />
      <div className="quote-summary">
        <span>Estimated total</span>
        <strong>{formatter.format(total)}</strong>
        <small>Final totals are checked when you save.</small>
      </div>
      <div className="form-actions quote-actions">
        <SubmitButton pendingText="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}
