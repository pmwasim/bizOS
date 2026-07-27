import { describe, expect, it } from "vitest";

import { PdfService } from "./pdf.service.js";
import { type QuotationSnapshot } from "./quotation-snapshot.js";

const snapshot: QuotationSnapshot = {
  business: {
    name: "Acme Services",
    legalName: "Acme Services LLC",
    email: "hello@acme.test",
    phone: "+966 50 000 0000",
    address: ["Riyadh", "Saudi Arabia"],
    taxName: "VAT",
    taxRegistrationNumber: "300000000000003",
  },
  customer: {
    name: "Example Customer",
    email: "customer@example.test",
    phone: null,
    address: ["King Fahd Road", "Riyadh"],
  },
  number: "Q-0001",
  issueDate: "2026-07-27",
  validUntil: "2026-08-26",
  currencyCode: "SAR",
  currencyScale: 2,
  subtotalMinor: "10000",
  taxMinor: "1500",
  totalMinor: "11500",
  lines: [
    {
      position: 1,
      description: "Professional services",
      quantity: "1",
      unitPriceMinor: "10000",
      taxRatePpm: 150000,
      subtotalMinor: "10000",
      taxMinor: "1500",
      totalMinor: "11500",
    },
  ],
};

describe("PdfService", () => {
  it("renders a non-empty PDF from the immutable quotation snapshot", async () => {
    const result = await new PdfService().renderQuotation(snapshot);

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });
});
