/**
 * The immutable view a payment-receipt PDF is rendered from.
 *
 * A receipt is derived on read: there is no stored receipt document, so this snapshot is assembled
 * at render time from the recorded payment, the business header, and the customer inferred from the
 * invoice(s) the payment settled. Every money field is integer minor units encoded as a string
 * (ADR-0008).
 *
 * `method` carries a human label for the payment (received vs. sent) rather than a stored
 * cash/bank/card value — the {@link Payment} model persists a direction (`type`), not a tender
 * method, so the receipt reports what the record actually knows.
 */
export interface ReceiptSnapshot {
  business: {
    address: string[];
    email: string | null;
    legalName: string | null;
    name: string;
    phone: string | null;
    taxName: string;
    taxRegistrationNumber: string | null;
  };
  /** Null when the payment settled nothing that carries a customer (a purely on-account receipt). */
  customer: {
    address: string[];
    email: string | null;
    name: string;
    phone: string | null;
  } | null;
  currencyCode: string;
  currencyScale: number;
  /** A short, human-facing receipt number derived from the payment's public id. */
  receiptNumber: string;
  reference: string | null;
  paymentDate: string;
  /** Human label for the payment direction/type (e.g. "Payment received"). */
  method: string;
  /** Human label for the payment status (e.g. "Completed"). */
  status: string;
  notes: string | null;
  /** The full amount tendered. */
  amountMinor: string;
  /** How much of the amount was applied to invoices/purchase orders. */
  allocatedMinor: string;
  /** Amount left on account when the payment exceeds what it settled; "0" when fully applied. */
  unallocatedMinor: string;
  allocations: Array<{
    kind: "INVOICE" | "PURCHASE_ORDER" | "UNASSIGNED";
    reference: string;
    amountMinor: string;
    /** Remaining balance on the settled invoice after all completed payments; null when not derivable. */
    remainingMinor: string | null;
  }>;
}
