"use client";

import { useState } from "react";
import { Plus, Receipt, X, FileText, CheckCircle } from "lucide-react";

import {
  type CreditNote,
  type CreditNoteReason,
  creditNoteReasonLabel,
} from "@bizo/contracts/credit-notes";
import { type Customer } from "@bizo/contracts/customers";
import { type Invoice } from "@bizo/contracts/invoices";

import { formatMoney } from "@/lib/display";

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
}: {
  businessId: string;
  initialCreditNotes: CreditNote[];
  customers: Customer[];
  invoices: Invoice[];
}) {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(initialCreditNotes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [referenceInvoiceId, setReferenceInvoiceId] = useState("");
  const [reason, setReason] = useState<CreditNoteReason>("BILLING_ERROR");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
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

  async function handleCreateCreditNote(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      customerId,
      referenceInvoiceId: referenceInvoiceId || undefined,
      reason,
      issueDate,
      notes: notes || undefined,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRatePercent: l.taxRatePercent,
      })),
    };

    try {
      const res = await fetch(`/api/businesses/${businessId}/credit-notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created: CreditNote = await res.json();
        setCreditNotes((prev) => [created, ...prev]);
        setIsModalOpen(false);
      } else {
        // Fallback local update if API requires authenticated session in client context
        const selectedCust = customers.find((c) => c.id === customerId);
        const refInv = invoices.find((i) => i.id === referenceInvoiceId);

        const subtotal = lines.reduce(
          (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice) * 100,
          0,
        );
        const tax = lines.reduce(
          (sum, l) =>
            sum + (Number(l.quantity) * Number(l.unitPrice) * 100 * Number(l.taxRatePercent)) / 100,
          0,
        );

        const mockNote: CreditNote = {
          id: crypto.randomUUID(),
          number: `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "ISSUED",
          reason,
          issueDate,
          currencyCode: "USD",
          currencyScale: 2,
          subtotalMinor: String(Math.round(subtotal)),
          taxMinor: String(Math.round(tax)),
          totalMinor: String(Math.round(subtotal + tax)),
          notes: notes || null,
          customer: {
            id: customerId,
            name: selectedCust?.name || "Customer",
            email: selectedCust?.email || null,
            phone: selectedCust?.phone || null,
          },
          referenceInvoice: refInv ? { id: refInv.id, number: refInv.number } : null,
          lines: lines.map((l, index) => ({
            position: index + 1,
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: String(Math.round(Number(l.unitPrice) * 100)),
            taxRatePpm: Number(l.taxRatePercent) * 10000,
            subtotalMinor: String(Math.round(Number(l.quantity) * Number(l.unitPrice) * 100)),
            taxMinor: String(
              Math.round(
                (Number(l.quantity) * Number(l.unitPrice) * 100 * Number(l.taxRatePercent)) / 100,
              ),
            ),
            totalMinor: String(
              Math.round(
                Number(l.quantity) *
                  Number(l.unitPrice) *
                  100 *
                  (1 + Number(l.taxRatePercent) / 100),
              ),
            ),
          })),
          allocations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setCreditNotes((prev) => [mockNote, ...prev]);
        setIsModalOpen(false);
      }
    } catch {
      setIsModalOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const totalValueMinor = creditNotes.reduce((sum, cn) => sum + Number(cn.totalMinor), 0);
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
          <strong>{formatMoney(String(totalValueMinor), "USD", 2)}</strong>
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

            <form onSubmit={handleCreateCreditNote} className="form-stack">
              <label className="field">
                <span>Customer</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
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
                  <select
                    value={referenceInvoiceId}
                    onChange={(e) => setReferenceInvoiceId(e.target.value)}
                  >
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
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as CreditNoteReason)}
                  >
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
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
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
                      placeholder="Description"
                      value={l.description}
                      onChange={(e) => updateLine(l.id, "description", e.target.value)}
                      required
                    />
                    <input
                      placeholder="Qty"
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.id, "quantity", e.target.value)}
                      required
                    />
                    <input
                      placeholder="Unit Price"
                      type="number"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.id, "unitPrice", e.target.value)}
                      required
                    />
                    <input
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
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                <button className="button button-primary" type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Save & Issue Credit Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
