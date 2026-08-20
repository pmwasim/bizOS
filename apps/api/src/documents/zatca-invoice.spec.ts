import { describe, expect, it } from "vitest";

import { type InvoiceSnapshot } from "./invoice-snapshot.js";
import {
  buildZatcaQrFromSnapshot,
  buildZatcaXmlFromSnapshot,
  isZatcaCountry,
  ZatcaInvoiceError,
  type ZatcaSnapshotContext,
} from "./zatca-invoice.js";

function saSnapshot(overrides: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot {
  return {
    business: {
      name: "Acme Trading",
      legalName: "Acme Trading Co Ltd",
      email: "billing@acme.test",
      phone: "+966500000000",
      address: ["King Fahd Road", "Riyadh 11564"],
      countryCode: "SA",
      taxName: "VAT",
      taxRegistrationNumber: "300000000000003",
    },
    customer: {
      name: "Beta Buyer LLC",
      email: "ap@beta.test",
      phone: null,
      address: ["Jeddah"],
      countryCode: "SA",
    },
    number: "INV-0001",
    issueDate: "2026-08-18",
    dueDate: "2026-09-17",
    poNumber: null,
    projectReference: null,
    currencyCode: "SAR",
    currencyScale: 2,
    subtotalMinor: "10000",
    taxMinor: "1500",
    totalMinor: "11500",
    lines: [
      {
        position: 1,
        description: "Consulting service",
        quantity: "2",
        unitPriceMinor: "5000",
        taxRatePpm: 150_000,
        subtotalMinor: "10000",
        taxMinor: "1500",
        totalMinor: "11500",
      },
    ],
    ...overrides,
  };
}

function context(snapshot: InvoiceSnapshot): ZatcaSnapshotContext {
  return {
    snapshot,
    invoiceUuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f28be",
    invoiceNumber: snapshot.number,
    sellerCountryCode: "SA",
  };
}

/** Decode a ZATCA TLV base64 string into a map of tag → UTF-8 value. */
function decodeTlv(base64: string): Map<number, string> {
  const bytes = Buffer.from(base64, "base64");
  const tags = new Map<number, string>();
  let offset = 0;
  while (offset < bytes.length) {
    const tag = bytes[offset]!;
    const length = bytes[offset + 1]!;
    const value = bytes.subarray(offset + 2, offset + 2 + length).toString("utf8");
    tags.set(tag, value);
    offset += 2 + length;
  }
  return tags;
}

describe("buildZatcaXmlFromSnapshot", () => {
  it("produces UBL with the required elements for a sample SA invoice", () => {
    const xml = buildZatcaXmlFromSnapshot(context(saSnapshot()));

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<cbc:ID>INV-0001</cbc:ID>");
    expect(xml).toContain("<cbc:UUID>3cf5ee18-ee25-44ea-a444-2c37ba7f28be</cbc:UUID>");
    expect(xml).toContain("<cbc:IssueDate>2026-08-18</cbc:IssueDate>");
    expect(xml).toContain("<cbc:IssueTime>00:00:00</cbc:IssueTime>");
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain("<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>");
    // Seller legal name + VAT number.
    expect(xml).toContain("<cbc:RegistrationName>Acme Trading Co Ltd</cbc:RegistrationName>");
    expect(xml).toContain("<cbc:CompanyID>300000000000003</cbc:CompanyID>");
    // Buyer.
    expect(xml).toContain("<cbc:RegistrationName>Beta Buyer LLC</cbc:RegistrationName>");
    // Line item with tax category + rate.
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="PCE">2</cbc:InvoicedQuantity>');
    expect(xml).toContain("<cbc:Name>Consulting service</cbc:Name>");
    expect(xml).toContain("<cbc:ID>S</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>15</cbc:Percent>");
    // Tax subtotal.
    expect(xml).toContain('<cbc:TaxableAmount currencyID="SAR">100.00</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="SAR">15.00</cbc:TaxAmount>');
    // Legal monetary totals.
    expect(xml).toContain(
      '<cbc:TaxInclusiveAmount currencyID="SAR">115.00</cbc:TaxInclusiveAmount>',
    );
    expect(xml).toContain('<cbc:PayableAmount currencyID="SAR">115.00</cbc:PayableAmount>');
  });

  it("groups a mixed standard + zero-rated invoice into two tax subtotals", () => {
    const xml = buildZatcaXmlFromSnapshot(
      context(
        saSnapshot({
          subtotalMinor: "20000",
          taxMinor: "1500",
          totalMinor: "21500",
          lines: [
            {
              position: 1,
              description: "Standard",
              quantity: "2",
              unitPriceMinor: "5000",
              taxRatePpm: 150_000,
              subtotalMinor: "10000",
              taxMinor: "1500",
              totalMinor: "11500",
            },
            {
              position: 2,
              description: "Export (zero rated)",
              quantity: "1",
              unitPriceMinor: "10000",
              taxRatePpm: 0,
              subtotalMinor: "10000",
              taxMinor: "0",
              totalMinor: "10000",
            },
          ],
        }),
      ),
    );
    expect(xml).toContain("<cbc:ID>S</cbc:ID>");
    expect(xml).toContain("<cbc:ID>Z</cbc:ID>");
    const subtotalCount = xml.split("<cac:TaxSubtotal>").length - 1;
    expect(subtotalCount).toBe(2);
  });

  it("throws when the seller has no VAT registration number", () => {
    const snapshot = saSnapshot();
    snapshot.business.taxRegistrationNumber = null;
    expect(() => buildZatcaXmlFromSnapshot(context(snapshot))).toThrow(ZatcaInvoiceError);
  });
});

describe("buildZatcaQrFromSnapshot", () => {
  it("encodes the five mandatory TLV tags with correct values", () => {
    const base64 = buildZatcaQrFromSnapshot(context(saSnapshot()));
    const tags = decodeTlv(base64);

    expect(tags.size).toBe(5);
    expect(tags.get(1)).toBe("Acme Trading Co Ltd"); // seller name (legal)
    expect(tags.get(2)).toBe("300000000000003"); // VAT number
    expect(tags.get(3)).toBe("2026-08-18T00:00:00Z"); // ISO-8601 timestamp
    expect(tags.get(4)).toBe("115.00"); // total incl. VAT
    expect(tags.get(5)).toBe("15.00"); // VAT total
  });

  it("throws when the seller has no VAT registration number", () => {
    const snapshot = saSnapshot();
    snapshot.business.taxRegistrationNumber = null;
    expect(() => buildZatcaQrFromSnapshot(context(snapshot))).toThrow(ZatcaInvoiceError);
  });
});

describe("isZatcaCountry", () => {
  it("recognises SA case- and whitespace-insensitively", () => {
    expect(isZatcaCountry("SA")).toBe(true);
    expect(isZatcaCountry(" sa ")).toBe(true);
    expect(isZatcaCountry("AE")).toBe(false);
    expect(isZatcaCountry(null)).toBe(false);
    expect(isZatcaCountry(undefined)).toBe(false);
  });
});
