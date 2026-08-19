import { describe, expect, it } from "vitest";

import {
  deriveSettlementStatus,
  invoicePaymentSummarySchema,
  recordPaymentRequestSchema,
  settlementStatusLabel,
} from "./payments.js";

const invoiceId = "11111111-1111-4111-8111-111111111111";
const purchaseOrderId = "22222222-2222-4222-8222-222222222222";

const validRequest = {
  type: "INBOUND" as const,
  paymentDate: "2026-08-07",
  amountMinor: "10000",
  currencyCode: "SAR",
  reference: null,
  notes: null,
  allocations: [
    {
      documentId: invoiceId,
      amountMinor: "10000",
    },
  ],
};

describe("recordPaymentRequestSchema", () => {
  it("accepts integer minor-unit amounts with exactly one allocation target", () => {
    expect(recordPaymentRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it.each(["0", "10.5", "01", "-1"])("rejects invalid payment amount %s", (amountMinor) => {
    expect(
      recordPaymentRequestSchema.safeParse({
        ...validRequest,
        amountMinor,
      }).success,
    ).toBe(false);
  });

  it("rejects allocations without a target", () => {
    expect(
      recordPaymentRequestSchema.safeParse({
        ...validRequest,
        allocations: [{ amountMinor: "10000" }],
      }).success,
    ).toBe(false);
  });

  it("rejects allocations with both an invoice and purchase order target", () => {
    expect(
      recordPaymentRequestSchema.safeParse({
        ...validRequest,
        allocations: [
          {
            documentId: invoiceId,
            purchaseOrderId,
            amountMinor: "10000",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects zero and fractional allocation amounts", () => {
    for (const amountMinor of ["0", "1.5"]) {
      expect(
        recordPaymentRequestSchema.safeParse({
          ...validRequest,
          allocations: [{ documentId: invoiceId, amountMinor }],
        }).success,
      ).toBe(false);
    }
  });
});

describe("deriveSettlementStatus", () => {
  it("returns UNPAID when nothing is paid", () => {
    expect(deriveSettlementStatus(0n, 10000n)).toBe("UNPAID");
  });

  it("returns PARTIALLY_PAID when some but not all is paid", () => {
    expect(deriveSettlementStatus(4000n, 10000n)).toBe("PARTIALLY_PAID");
  });

  it("returns PAID once paid reaches or exceeds the total", () => {
    expect(deriveSettlementStatus(10000n, 10000n)).toBe("PAID");
    expect(deriveSettlementStatus(12000n, 10000n)).toBe("PAID");
  });

  it("exposes human-readable labels", () => {
    expect(settlementStatusLabel("PARTIALLY_PAID")).toBe("Partially paid");
  });
});

describe("invoicePaymentSummarySchema", () => {
  const summary = {
    id: invoiceId,
    number: "INV-001",
    totalMinor: "10000",
    paidMinor: "4000",
    outstandingMinor: "6000",
    settlementStatus: "PARTIALLY_PAID" as const,
    currencyCode: "SAR",
    currencyScale: 2,
  };

  it("accepts a summary carrying a derived settlement status", () => {
    expect(invoicePaymentSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects an unknown settlement status", () => {
    expect(
      invoicePaymentSummarySchema.safeParse({ ...summary, settlementStatus: "OVERPAID" }).success,
    ).toBe(false);
  });
});
