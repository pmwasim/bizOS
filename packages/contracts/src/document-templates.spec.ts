import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOCUMENT_TEMPLATE,
  documentTemplateSchema,
  readableTextColor,
} from "./document-templates.js";

describe("documentTemplateSchema", () => {
  it("fills every field from an empty object so existing businesses keep today's look", () => {
    expect(documentTemplateSchema.parse({})).toEqual(DEFAULT_DOCUMENT_TEMPLATE);
  });

  it("accepts a full custom branding payload", () => {
    const parsed = documentTemplateSchema.parse({
      layout: "STANDARD",
      accentColor: "#0F766E",
      headerText: "Qloudi",
      showTaxRegistration: false,
      quotationFooter: "Prices hold for 30 days.",
      invoiceFooter: "Bank transfer only.",
    });
    expect(parsed.accentColor).toBe("#0F766E");
    expect(parsed.headerText).toBe("Qloudi");
    expect(parsed.showTaxRegistration).toBe(false);
  });

  it("rejects colours that are not 6-digit hex", () => {
    for (const value of ["2457d6", "#fff", "#2457d", "#gggggg", "red"]) {
      expect(documentTemplateSchema.safeParse({ accentColor: value }).success).toBe(false);
    }
  });

  it("rejects an unknown layout name, keeping print formats a closed set", () => {
    expect(documentTemplateSchema.safeParse({ layout: "FANCY" }).success).toBe(false);
  });

  it("rejects unknown keys so branding cannot smuggle in extra fields", () => {
    expect(documentTemplateSchema.safeParse({ totalMinor: "1" }).success).toBe(false);
  });

  it("treats blank footer text as invalid rather than silently empty", () => {
    expect(documentTemplateSchema.safeParse({ quotationFooter: "   " }).success).toBe(false);
  });
});

describe("readableTextColor", () => {
  it("uses white on dark accents and dark ink on light accents", () => {
    expect(readableTextColor("#2457d6")).toBe("#ffffff");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#ffffff")).toBe("#172033");
    expect(readableTextColor("#facc15")).toBe("#172033");
  });
});
