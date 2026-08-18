"use client";

import { useActionState, useState } from "react";
import { Plus, Receipt, X, FileText, CheckCircle } from "lucide-react";

import { type CreditNote, creditNoteReasonLabel } from "@bizo/contracts/credit-notes";
import { type Customer } from "@bizo/contracts/customers";
import { type Invoice } from "@bizo/contracts/invoices";
import { type ActionState, createCreditNoteAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

import { formatMoney } from "@/lib/display";

function formatCreditNoteTotals(
  creditNotes: CreditNote[],
  fallbackCurrency: string,
  fallbackScale: number,
): string {
  const totalsByCurrency = new Map<string, { minor: number; scale: number }>();
  for (const creditNote of creditNotes) {
    const key = `${creditNote.currencyCode}:${creditNote.currencyScale}`;
    const current = totalsByCurrency.get(key);
    totalsByCurrency.set(key, {
      minor: (current?.minor ?? 0) + Number(creditNote.totalMinor),
      scale: creditNote.currencyScale,
    });
  }

  if (totalsByCurrency.size === 0) {
    return formatMoney("0", fallbackCurrency, fallbackScale);
  }

  return Array.from(totalsByCurrency, ([key, total]) => {
    const currency = key.split(":", 1)[0]!;
    return formatMoney(String(total.minor), currency, total.scale);
  }).join(" · ");
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
}

export function CreditNotesClientView({
  businessId,
  initialCreditNotes,
  customers,
  invoices,
  currency,
  currencyScale,
}: {
  businessId: string;
  initialCreditNotes: CreditNote[];
  customers: Customer[];
  invoices: Invoice[];
  currency: string;
  currencyScale: number;
}) {
  const creditNotes = initialCreditNotes;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    createCreditNoteAction.bind(null, businessId),
    {},
  );

  // Form State
  const [lines, setLines] = useState<LineItem[]>([
    {
      id: "line-1",
      description: "Credit Adjustment",
      quantity: "1",
      unitPrice: "100.00",
      taxRatePercent: "0",
    },
  ]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        taxRatePercent: "0",
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length > 1) {
      setLines((prev) => prev.filter((l) => l.id !== id));
    }
  }

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  const issuedCount = creditNotes.filter((cn) => cn.status === "ISSUED").length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Credit Notes & Adjustments</h1>
          <p>Issue invoice-linked or standalone credit notes to adjust customer accounts.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> New Credit Note
        </button>
      </header>

      {/* Summary Metrics */}
      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr 1fr", margin: "1rem 0 2rem" }}>
        <a>
          <Receipt size={28} />
          <span>Total Credit Notes</span>
          <strong>{creditNotes.length}</strong>
        </a>
        <a>
          <FileText size={28} />
          <span>Active Issued</span>
          <strong>{issuedCount}</strong>
        </a>
        <a>
          <CheckCircle size={28} />
          <span>Total Credit Amount</span>
          <strong>{formatCreditNoteTotals(creditNotes, currency, currencyScale)}</strong>
        </a>
      </div>

      {/* Table / List */}
      {creditNotes.length ? (
        <div className="data-list">
          <div
            className="data-row"
            style={{
              fontWeight: 800,
              background: "var(--surface-subtle)",
              borderBottom: "2px solid var(--border)",
            }}
          >
            <span style={{ width: "140px" }}>Credit Note #</span>
            <span className="grow">Customer & Reference</span>
            <span style={{ width: "130px" }}>Reason</span>
            <span style={{ width: "110px" }}>Issue Date</span>
            <span style={{ width: "120px", textAlign: "right" }}>Total Amount</span>
            <span style={{ width: "110px", textAlign: "right" }}>Status</span>
          </div>
          {creditNotes.map((note) => (
            <div className="data-row" key={note.id}>
              <strong style={{ width: "140px" }}>{note.number}</strong>
              <span className="grow">
                <strong>{note.customer.name}</strong>
                <small>
                  {note.referenceInvoice
                    ? `Ref Invoice: ${note.referenceInvoice.number}`
                    : "Standalone Credit"}
                </small>
              </span>
              <span style={{ width: "130px" }}>{creditNoteReasonLabel(note.reason)}</span>
              <span className="row-date" style={{ width: "110px" }}>
                {note.issueDate}
              </span>
              <strong style={{ width: "120px", textAlign: "right" }}>
                {formatMoney(note.totalMinor, note.currencyCode, note.currencyScale)}
              </strong>
              <span style={{ width: "110px", textAlign: "right" }}>
                <span className={`status status-${note.status.toLowerCase()}`}>{note.status}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Receipt size={30} aria-hidden="true" />
          <h2>No credit notes created yet</h2>
          <p>Click "New Credit Note" to issue your first credit note or customer adjustment.</p>
        </div>
      )}

      {/* Modal / Form */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              padding: "2rem",
              maxWidth: "650px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Create New Credit Note</h2>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: "0.4rem 0.6rem", minHeight: "auto" }}
              >
                <X size={18} />
              </button>
            </div>

            <ActionMessage error={state.error} />

            <form action={formAction} className="form-stack">
              <label className="field">
                <span>Customer</span>
                <select name="customerId" defaultValue={customers[0]?.id ?? ""} required>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Reference Invoice (Optional)</span>
                  <select name="referenceInvoiceId" defaultValue="">
                    <option value="">-- None (Standalone) --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.number} ({inv.customer.name})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Reason</span>
                  <select name="reason" defaultValue="BILLING_ERROR">
                    <option value="RETURNED_GOODS">Returned Goods</option>
                    <option value="BILLING_ERROR">Billing Error</option>
                    <option value="DISCOUNT">Discount</option>
                    <option value="CANCELLATION">Cancellation</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Issue Date</span>
                <input
                  name="issueDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>

              <div
                className="panel"
                style={{
                  padding: "0.75rem",
                  background: "var(--surface-subtle)",
                  borderRadius: "0.5rem",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Credit Line Items</span>
                {lines.map((l) => (
                  <div
                    key={l.id}
                    className="field-grid"
                    style={{
                      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <input
                      name="description"
                      placeholder="Description"
                      value={l.description}
                      onChange={(e) => updateLine(l.id, "description", e.target.value)}
                      required
                    />
                    <input
                      name="quantity"
                      placeholder="Qty"
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.id, "quantity", e.target.value)}
                      required
                    />
                    <input
                      name="unitPrice"
                      placeholder="Unit Price"
                      type="number"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.id, "unitPrice", e.target.value)}
                      required
                    />
                    <input
                      name="taxRatePercent"
                      placeholder="Tax %"
                      type="number"
                      value={l.taxRatePercent}
                      onChange={(e) => updateLine(l.id, "taxRatePercent", e.target.value)}
                    />
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => removeLine(l.id)}
                      disabled={lines.length === 1}
                      style={{ padding: "0.4rem" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={addLine}
                  style={{ marginTop: "0.75rem", fontSize: "0.8rem", minHeight: "36px" }}
                >
                  + Add Line Item
                </button>
              </div>

              <label className="field">
                <span>Notes / Reason Description</span>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Additional notes for customer credit..."
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1rem",
                }}
              >
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <SubmitButton pendingText="Creating...">Save Credit Note (Draft)</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
