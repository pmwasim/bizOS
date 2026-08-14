import { describe, it, expect } from "vitest";
import { MultiCountryTaxEngine, validateTrn, calculateTax } from "./tax-engine.js";

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
