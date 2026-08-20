import { describe, expect, it } from "vitest";

import {
  buildZatcaUblInvoiceXml,
  escapeXml,
  formatTaxPercent,
  ZatcaUblError,
  type ZatcaUblInvoiceInput,
} from "./zatca-ubl.js";

function sampleInput(overrides: Partial<ZatcaUblInvoiceInput> = {}): ZatcaUblInvoiceInput {
  return {
    invoiceNumber: "INV-0001",
    uuid: "3cf5ee18-ee25-44ea-a444-2c37ba7f28be",
    issueDate: "2026-08-18",
    issueTime: "10:30:00",
    invoiceTypeName: "0100000",
    currency: "SAR",
    taxCurrency: "SAR",
    currencyScale: 2,
    seller: {
      registrationName: "Acme Trading Co",
      vatNumber: "300000000000003",
      countryCode: "SA",
      addressLines: ["King Fahd Road", "Building 12"],
      city: "Riyadh",
      postalCode: "11564",
    },
    buyer: {
      registrationName: "Beta Buyer LLC",
      countryCode: "SA",
      city: "Jeddah",
    },
    lines: [
      {
        id: 1,
        name: "Consulting service",
        quantity: "2",
        unitCode: "PCE",
        unitPriceMinor: "5000",
        lineExtensionMinor: "10000",
        taxAmountMinor: "1500",
        taxCategory: "S",
        taxPercent: 15,
      },
    ],
    taxSubtotals: [
      { taxableAmountMinor: "10000", taxAmountMinor: "1500", taxCategory: "S", taxPercent: 15 },
    ],
    lineExtensionMinor: "10000",
    taxExclusiveMinor: "10000",
    taxInclusiveMinor: "11500",
    payableMinor: "11500",
    taxTotalMinor: "1500",
    ...overrides,
  };
}

describe("buildZatcaUblInvoiceXml", () => {
  it("emits a well-formed UBL invoice with all required ZATCA elements", () => {
    const xml = buildZatcaUblInvoiceXml(sampleInput());

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    );
    // Header identifiers.
    expect(xml).toContain("<cbc:ProfileID>reporting:1.0</cbc:ProfileID>");
    expect(xml).toContain("<cbc:ID>INV-0001</cbc:ID>");
    expect(xml).toContain("<cbc:UUID>3cf5ee18-ee25-44ea-a444-2c37ba7f28be</cbc:UUID>");
    expect(xml).toContain("<cbc:IssueDate>2026-08-18</cbc:IssueDate>");
    expect(xml).toContain("<cbc:IssueTime>10:30:00</cbc:IssueTime>");
    expect(xml).toContain('<cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>');
    expect(xml).toContain("<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>");
    expect(xml).toContain("<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>");
    // Seller: name, VAT number, country.
    expect(xml).toContain("<cbc:RegistrationName>Acme Trading Co</cbc:RegistrationName>");
    expect(xml).toContain("<cbc:CompanyID>300000000000003</cbc:CompanyID>");
    expect(xml).toContain(
      "<cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>",
    );
    // Buyer.
    expect(xml).toContain("<cbc:RegistrationName>Beta Buyer LLC</cbc:RegistrationName>");
    // Tax subtotal with category + rate.
    expect(xml).toContain('<cbc:TaxableAmount currencyID="SAR">100.00</cbc:TaxableAmount>');
    expect(xml).toContain("<cbc:ID>S</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>15</cbc:Percent>");
    expect(xml).toContain("<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>");
    // Legal monetary totals.
    expect(xml).toContain(
      '<cbc:LineExtensionAmount currencyID="SAR">100.00</cbc:LineExtensionAmount>',
    );
    expect(xml).toContain(
      '<cbc:TaxExclusiveAmount currencyID="SAR">100.00</cbc:TaxExclusiveAmount>',
    );
    expect(xml).toContain(
      '<cbc:TaxInclusiveAmount currencyID="SAR">115.00</cbc:TaxInclusiveAmount>',
    );
    expect(xml).toContain('<cbc:PayableAmount currencyID="SAR">115.00</cbc:PayableAmount>');
    // Invoice line.
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="PCE">2</cbc:InvoicedQuantity>');
    expect(xml).toContain("<cbc:Name>Consulting service</cbc:Name>");
    expect(xml).toContain('<cbc:PriceAmount currencyID="SAR">50.00</cbc:PriceAmount>');
    expect(xml.endsWith("</Invoice>")).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(buildZatcaUblInvoiceXml(sampleInput())).toBe(buildZatcaUblInvoiceXml(sampleInput()));
  });

  it("escapes XML-significant characters in free-text fields", () => {
    const xml = buildZatcaUblInvoiceXml(
      sampleInput({
        lines: [
          {
            id: 1,
            name: "Tom & Jerry <Ltd>",
            quantity: "1",
            unitPriceMinor: "10000",
            lineExtensionMinor: "10000",
            taxAmountMinor: "1500",
            taxCategory: "S",
            taxPercent: 15,
          },
        ],
      }),
    );
    expect(xml).toContain("<cbc:Name>Tom &amp; Jerry &lt;Ltd&gt;</cbc:Name>");
    expect(xml).not.toContain("Tom & Jerry");
  });

  it("renders a zero-rated line with category Z and percent 0", () => {
    const xml = buildZatcaUblInvoiceXml(
      sampleInput({
        lines: [
          {
            id: 1,
            name: "Export goods",
            quantity: "1",
            unitPriceMinor: "10000",
            lineExtensionMinor: "10000",
            taxAmountMinor: "0",
            taxCategory: "Z",
            taxPercent: 0,
          },
        ],
        taxSubtotals: [
          { taxableAmountMinor: "10000", taxAmountMinor: "0", taxCategory: "Z", taxPercent: 0 },
        ],
        taxInclusiveMinor: "10000",
        payableMinor: "10000",
        taxTotalMinor: "0",
      }),
    );
    expect(xml).toContain("<cbc:ID>Z</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>0</cbc:Percent>");
  });

  it("throws when there are no lines", () => {
    expect(() => buildZatcaUblInvoiceXml(sampleInput({ lines: [] }))).toThrow(ZatcaUblError);
  });

  it("throws when the invoice number is blank", () => {
    expect(() => buildZatcaUblInvoiceXml(sampleInput({ invoiceNumber: "  " }))).toThrow(
      ZatcaUblError,
    );
  });
});

describe("formatTaxPercent", () => {
  it("trims trailing zeros", () => {
    expect(formatTaxPercent(15)).toBe("15");
    expect(formatTaxPercent(5)).toBe("5");
    expect(formatTaxPercent(0)).toBe("0");
    expect(formatTaxPercent(2.5)).toBe("2.5");
  });

  it("rejects negatives", () => {
    expect(() => formatTaxPercent(-1)).toThrow(ZatcaUblError);
  });
});

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
});
