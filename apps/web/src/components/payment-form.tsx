"use client";

import { useActionState, useState } from "react";

import { type ActionState, recordPaymentAction } from "@/app/actions";
import { ActionMessage } from "@/components/action-message";
import { SubmitButton } from "@/components/submit-button";

interface InvoiceOption {
  id: string;
  number: string;
  customerName: string;
  totalFormatted: string;
}

export function PaymentForm({
  businessId,
  currency,
  defaultInvoiceId,
  defaultAmount,
  invoices = [],
}: {
  businessId: string;
  currency: string;
  defaultInvoiceId?: string | undefined;
  defaultAmount?: string | undefined;
  invoices?: InvoiceOption[] | undefined;
}) {
  const action = recordPaymentAction.bind(null, businessId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [paymentType, setPaymentType] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [selectedInvoice, setSelectedInvoice] = useState<string>(defaultInvoiceId ?? "");

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="form-stack wide">
      <ActionMessage error={state.error} />

      <div className="field">
        <label htmlFor="type-select">Payment Direction</label>
        <div className="choice-row">
          <label className={`choice-card ${paymentType === "INBOUND" ? "active" : ""}`}>
            <input
              type="radio"
              name="type"
              value="INBOUND"
              checked={paymentType === "INBOUND"}
              onChange={() => setPaymentType("INBOUND")}
            />
            <span>Inbound (Received from Customer)</span>
          </label>
          <label className={`choice-card ${paymentType === "OUTBOUND" ? "active" : ""}`}>
            <input
              type="radio"
              name="type"
              value="OUTBOUND"
              checked={paymentType === "OUTBOUND"}
              onChange={() => setPaymentType("OUTBOUND")}
            />
            <span>Outbound (Paid to Supplier / Vendor)</span>
          </label>
        </div>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Payment Date</span>
          <input
            name="paymentDate"
            type="date"
            defaultValue={today}
            required
            aria-label="Payment date"
          />
        </label>

        <label className="field">
          <span>Amount</span>
          <div className="money-input">
            <span>{currency}</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={defaultAmount ?? ""}
              required
              placeholder="0.00"
              aria-label={`Payment amount in ${currency}`}
            />
          </div>
        </label>
      </div>

      <input type="hidden" name="currencyCode" value={currency} />

      {invoices.length > 0 && paymentType === "INBOUND" ? (
        <label className="field">
          <span>
            Allocate to Invoice <em>Optional</em>
          </span>
          <select
            name="invoiceId"
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
          >
            <option value="">-- Do not allocate (Unassigned payment) --</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.number} · {inv.customerName} ({inv.totalFormatted})
              </option>
            ))}
          </select>
          <small>
            Allocating will update the invoice&apos;s paid amount and outstanding balance.
          </small>
        </label>
      ) : defaultInvoiceId ? (
        <input type="hidden" name="invoiceId" value={defaultInvoiceId} />
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>
            Reference / Receipt # <em>Optional</em>
          </span>
          <input
            name="reference"
            placeholder="e.g. Wire-98234, Check #104, Zelle"
            maxLength={120}
          />
        </label>

        <label className="field">
          <span>
            Payment Notes <em>Optional</em>
          </span>
          <input
            name="notes"
            placeholder="e.g. Deposit for visual identity milestone"
            maxLength={500}
          />
        </label>
      </div>

      <div className="form-actions">
        <SubmitButton pendingText="Recording payment…">Record payment</SubmitButton>
      </div>
    </form>
  );
}
