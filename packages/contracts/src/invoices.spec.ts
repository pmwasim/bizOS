import { describe, expect, it } from "vitest";

import {
  createInvoiceFromQuotationRequestSchema,
  invoiceStatusLabel,
  invoiceStatusLabelByCode,
  invoiceStatusSchema,
  updateInvoiceRequestSchema,
} from "./invoices.js";

describe("invoice contracts", () => {
  it("exposes plain-language status labels for every status", () => {
    for (const status of invoiceStatusSchema.options) {
      expect(invoiceStatusLabel(status)).toBe(invoiceStatusLabelByCode[status]);
      expect(invoiceStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("requires a quotation id to create an invoice", () => {
    expect(
      createInvoiceFromQuotationRequestSchema.safeParse({
        quotationId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
      }).success,
    ).toBe(true);
    expect(createInvoiceFromQuotationRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty invoice line updates", () => {
    expect(
      updateInvoiceRequestSchema.safeParse({
        lines: [],
      }).success,
    ).toBe(false);
  });
});
