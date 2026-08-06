import { describe, expect, it } from "vitest";

import { recordPaymentRequestSchema } from "./payments.js";

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
