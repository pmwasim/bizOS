import { describe, it, expect } from "vitest";
import {
  MultiCountryTaxEngine,
  validateTrn,
  calculateTax,
  validateTaxId,
  isSupportedTaxCountry,
  normalizeTaxId,
  SUPPORTED_TAX_COUNTRIES,
} from "./tax-engine.js";
import { createSupplierRequestSchema } from "./suppliers.js";

describe("tax-engine", () => {
  const engine = new MultiCountryTaxEngine();

  describe("TRN Validation", () => {
    it("validates KSA TRNs (15 digits starting and ending with 3)", () => {
      expect(validateTrn("SA", "310000000000003")).toBe(true);
      expect(validateTrn("SA", "110000000000001")).toBe(false);
      expect(engine.validateTrn("SA", "310000000000003")).toBe(true);
    });

    it("validates UAE TRNs (15 digits)", () => {
      expect(validateTrn("AE", "100000000000003")).toBe(true);
      expect(validateTrn("AE", "123")).toBe(false);
    });

    it("validates India GSTIN (15 chars format)", () => {
      expect(validateTrn("IN", "27AAAAA0000A1Z5")).toBe(true);
      expect(validateTrn("IN", "INVALID")).toBe(false);
    });
  });

  describe("validateTaxId (country-aware party tax IDs)", () => {
    it("lists SA, AE, IN as supported", () => {
      expect([...SUPPORTED_TAX_COUNTRIES]).toEqual(["SA", "AE", "IN"]);
      expect(isSupportedTaxCountry("SA")).toBe(true);
      expect(isSupportedTaxCountry(" ae ")).toBe(true);
      expect(isSupportedTaxCountry("in")).toBe(true);
      expect(isSupportedTaxCountry("US")).toBe(false);
      expect(isSupportedTaxCountry(null)).toBe(false);
      expect(isSupportedTaxCountry(undefined)).toBe(false);
    });

    it("normalizes tax IDs for comparison", () => {
      expect(normalizeTaxId("  27aaaaa0000a1z5 ")).toBe("27AAAAA0000A1Z5");
    });

    it("accepts valid Saudi VAT numbers and rejects invalid ones", () => {
      expect(validateTaxId("SA", "310000000000003").valid).toBe(true);
      const bad = validateTaxId("SA", "110000000000001");
      expect(bad.valid).toBe(false);
      expect(bad.reason).toContain("15 digits");
      expect(validateTaxId("SA", "31000000000003").valid).toBe(false); // 14 digits
    });

    it("accepts valid UAE TRNs and rejects invalid ones", () => {
      expect(validateTaxId("AE", "100000000000003").valid).toBe(true);
      expect(validateTaxId("AE", "12345").valid).toBe(false);
      expect(validateTaxId("AE", "10000000000000A").valid).toBe(false);
    });

    it("accepts valid India GSTINs (case-insensitive) and rejects invalid ones", () => {
      expect(validateTaxId("IN", "27AAAAA0000A1Z5").valid).toBe(true);
      expect(validateTaxId("IN", "27aaaaa0000a1z5").valid).toBe(true); // normalized to upper-case
      expect(validateTaxId("IN", "INVALID").valid).toBe(false);
      expect(validateTaxId("IN", "27AAAAA0000A1X5").valid).toBe(false); // missing mandatory Z
    });

    it("fails closed for unsupported countries", () => {
      const result = validateTaxId("US", "123456789");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not supported");
    });
  });

  describe("createSupplierRequestSchema tax-ID refinement", () => {
    const base = { name: "Acme" };

    it("rejects an invalid tax ID when a supported country is given", () => {
      const parsed = createSupplierRequestSchema.safeParse({
        ...base,
        countryCode: "SA",
        taxId: "110000000000001",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toEqual(["taxId"]);
      }
    });

    it("accepts a valid tax ID for a supported country", () => {
      const parsed = createSupplierRequestSchema.safeParse({
        ...base,
        countryCode: "SA",
        taxId: "310000000000003",
      });
      expect(parsed.success).toBe(true);
    });

    it("does not enforce a format for unsupported countries", () => {
      const parsed = createSupplierRequestSchema.safeParse({
        ...base,
        countryCode: "US",
        taxId: "TAX-12345",
      });
      expect(parsed.success).toBe(true);
    });

    it("does not enforce when no country is provided", () => {
      const parsed = createSupplierRequestSchema.safeParse({ ...base, taxId: "TAX-12345" });
      expect(parsed.success).toBe(true);
    });
  });

  describe("Tax Calculation", () => {
    it("calculates KSA 15% VAT with ZATCA TLV QR code base64", () => {
      const result = calculateTax({
        countryCode: "SA",
        subtotalMinor: 100000,
        currency: "SAR",
        lineItems: [
          { description: "Item 1", quantity: 1, unitPriceMinor: 100000, taxRatePercent: 15 },
        ],
      });

      expect(result.countryCode).toBe("SA");
      expect(result.totalTaxMinor).toBe(15000);
      expect(result.totalAmountMinor).toBe(115000);
      expect(result.taxBreakdown.vatMinor).toBe(15000);
      expect(result.zatcaTlvQrBase64).toBeDefined();
    });

    it("calculates UAE 5% VAT", () => {
      const result = engine.calculateTax({
        countryCode: "AE",
        subtotalMinor: 50000,
        currency: "AED",
        lineItems: [
          { description: "Item 1", quantity: 1, unitPriceMinor: 50000, taxRatePercent: 5 },
        ],
      });

      expect(result.countryCode).toBe("AE");
      expect(result.totalTaxMinor).toBe(2500);
      expect(result.totalAmountMinor).toBe(52500);
    });

    it("calculates India intra-state GST (CGST + SGST)", () => {
      const result = calculateTax({
        countryCode: "IN",
        subtotalMinor: 1000000,
        currency: "INR",
        sellerStateCode: "27",
        buyerStateCode: "27",
        lineItems: [
          { description: "Item 1", quantity: 1, unitPriceMinor: 1000000, taxRatePercent: 18 },
        ],
      });

      expect(result.totalTaxMinor).toBe(180000);
      expect(result.taxBreakdown.cgstMinor).toBe(90000);
      expect(result.taxBreakdown.sgstMinor).toBe(90000);
      expect(result.taxBreakdown.igstMinor).toBeUndefined();
    });

    it("calculates India inter-state GST (IGST)", () => {
      const result = calculateTax({
        countryCode: "IN",
        subtotalMinor: 1000000,
        currency: "INR",
        sellerStateCode: "27",
        buyerStateCode: "07",
        lineItems: [
          { description: "Item 1", quantity: 1, unitPriceMinor: 1000000, taxRatePercent: 18 },
        ],
      });

      expect(result.totalTaxMinor).toBe(180000);
      expect(result.taxBreakdown.igstMinor).toBe(180000);
      expect(result.taxBreakdown.cgstMinor).toBeUndefined();
    });
  });
});
