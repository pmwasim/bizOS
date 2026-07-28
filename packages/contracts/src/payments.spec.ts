import { describe, expect, it } from "vitest";

import {
  createCustomerPaymentRequestSchema,
  deriveInvoiceBalanceStatus,
  invoiceBalanceStatusLabel,
  paymentMethodLabel,
} from "./payments.js";

describe("customer payments contracts", () => {
  it("derives unpaid, partial, and paid balance statuses", () => {
    expect(deriveInvoiceBalanceStatus({ totalMinor: "10000", allocatedMinor: "0" })).toBe("UNPAID");
    expect(deriveInvoiceBalanceStatus({ totalMinor: "10000", allocatedMinor: "2500" })).toBe(
      "PARTIALLY_PAID",
    );
    expect(deriveInvoiceBalanceStatus({ totalMinor: "10000", allocatedMinor: "10000" })).toBe(
      "PAID",
    );
    expect(invoiceBalanceStatusLabel("PAID")).toBe("Paid");
  });

  it("accepts a create payment request", () => {
    const parsed = createCustomerPaymentRequestSchema.parse({
      invoiceId: "11111111-1111-4111-8111-111111111111",
      amount: "100.00",
      receivedOn: "2026-07-28",
      method: "BANK_TRANSFER",
      reference: "TRX-1",
      notes: null,
    });
    expect(parsed.method).toBe("BANK_TRANSFER");
    expect(paymentMethodLabel(parsed.method)).toBe("Bank transfer");
  });

  it("rejects a zero amount", () => {
    expect(() =>
      createCustomerPaymentRequestSchema.parse({
        invoiceId: "11111111-1111-4111-8111-111111111111",
        amount: "0",
        receivedOn: "2026-07-28",
        method: "CASH",
      }),
    ).toThrow();
  });
});
