import { describe, expect, it } from "vitest";
import {
  calculateLine,
  formatScaledInteger,
  parseDecimalToScaledInteger,
  roundDivide,
} from "./money.js";
import {
  buildZatcaPhase1Tlv,
  encodeZatcaPhase1Qr,
  ZatcaEncodingError,
  type ZatcaPhase1Invoice,
} from "./zatca.js";
import { calculateTax, validateTrn } from "./tax-engine.js";

describe("EMPIRICAL STRESS TEST SUITE: bizOS Domain Logic", () => {
  describe("1. Money Arithmetic & Numeric Precision Stress Tests", () => {
    it("Stress 1.1: Max BigInt string length and overflow bounds", () => {
      // Test 38-digit string (max allowed)
      const valid38 = "9".repeat(38);
      expect(() => parseDecimalToScaledInteger(valid38, 0)).not.toThrow();

      // Test 39-digit string (exceeds limit)
      const invalid39 = "9".repeat(39);
      expect(() => parseDecimalToScaledInteger(invalid39, 0)).toThrow("The amount is too large.");
    });

    it("Stress 1.2: Rounding edge cases with roundDivide", () => {
      // 1 / 2 = 0.5 -> rounds up to 1
      expect(roundDivide(1n, 2n)).toBe(1n);
      // 3 / 2 = 1.5 -> rounds up to 2
      expect(roundDivide(3n, 2n)).toBe(2n);
      // 2 / 3 = 0.666... -> rounds up to 1
      expect(roundDivide(2n, 3n)).toBe(1n);
      // 1 / 3 = 0.333... -> rounds down to 0
      expect(roundDivide(1n, 3n)).toBe(0n);
    });

    it("Stress 1.3: Negative inputs in money functions throw RangeError", () => {
      expect(() => formatScaledInteger(-1n, 2)).toThrow("MVP money values cannot be negative.");
      expect(() => roundDivide(-5n, 2n)).toThrow(
        "Only non-negative values and a positive denominator are supported.",
      );
    });

    it("Stress 1.4: Multi-line tax accumulation vs line-by-line tax rounding", () => {
      // 3 items of price 0.03 SAR with 15% tax
      // Each item: 3 minor units * 15 / 100 = 0.45 minor units -> rounds to 0 tax per line
      const line1 = calculateLine("1.0", "0.03", 2, "15");
      const line2 = calculateLine("1.0", "0.03", 2, "15");
      const line3 = calculateLine("1.0", "0.03", 2, "15");

      expect(line1.taxMinor).toBe(0n);
      expect(line2.taxMinor).toBe(0n);
      expect(line3.taxMinor).toBe(0n);

      const totalLineTax = line1.taxMinor + line2.taxMinor + line3.taxMinor; // 0
      // Sum subtotal = 9 minor units. 9 * 15% = 1.35 minor units -> rounds to 1 tax
      const aggregateTax = roundDivide(9n * 1500n, 10000n);

      // Discrepancy between sum of line taxes (0) vs aggregate subtotal tax (1)
      expect(totalLineTax).not.toBe(aggregateTax);
    });
  });

  describe("2. ZATCA TLV Encoding & Tax Engine Discrepancy Stress Tests", () => {
    it("Stress 2.1: ZATCA TLV Base64 QR encoding in tax-engine.ts", () => {
      const fixedDate = new Date("2026-08-07T12:00:00.000Z");
      const inv: ZatcaPhase1Invoice = {
        sellerName: "Test Seller Co",
        vatRegistrationNumber: "300123456700003",
        issuedAt: fixedDate,
        totalWithVatMinor: 11500n,
        vatTotalMinor: 1500n,
        currencyScale: 2,
      };

      const expectedTlvQr = encodeZatcaPhase1Qr(inv);

      const taxResult = calculateTax({
        countryCode: "SA",
        subtotalMinor: 10000,
        currency: "SAR",
        sellerName: "Test Seller Co",
        lineItems: [
          { description: "Item 1", quantity: 1, unitPriceMinor: 10000, taxRatePercent: 15 },
        ],
        trn: "300123456700003",
        transactionDate: fixedDate.toISOString(),
      });

      expect(taxResult.zatcaTlvQrBase64).toBeDefined();
      expect(taxResult.zatcaTlvQrBase64).toBe(expectedTlvQr);

      // Decoded bytes should start with Tag 1 (seller name), Tag 2 (TRN), etc.
      const rawBuffer = Buffer.from(taxResult.zatcaTlvQrBase64!, "base64");
      expect(rawBuffer[0]).toBe(1); // Tag 1: Seller Name
    });

    it("Stress 2.2: Indian GST CGST/SGST symmetrical tax split", () => {
      const resIntra = calculateTax({
        countryCode: "IN",
        subtotalMinor: 83,
        currency: "INR",
        lineItems: [
          { description: "Service", quantity: 1, unitPriceMinor: 83, taxRatePercent: 18 },
        ],
        sellerStateCode: "27",
        buyerStateCode: "27", // Intra-state
      });

      // Half rate 9% on 83: 83 * 9 / 100 = 7.47 -> rounds to 7 CGST and 7 SGST
      expect(resIntra.taxBreakdown.cgstMinor).toBe(7);
      expect(resIntra.taxBreakdown.sgstMinor).toBe(7);
      expect(resIntra.totalTaxMinor).toBe(14);
      // CGST (7) === SGST (7) — symmetrical CGST/SGST split under Indian GST law!
      expect(resIntra.taxBreakdown.cgstMinor).toBe(resIntra.taxBreakdown.sgstMinor);
    });

    it("Stress 2.3: ZATCA Tag byte length overflow on >255 bytes Arabic text", () => {
      // 130 Arabic characters = 260 UTF-8 bytes (> 255 max byte limit for 1-byte TLV length)
      const longArabicName = "شركة ".repeat(30); // > 255 bytes
      const inv: ZatcaPhase1Invoice = {
        sellerName: longArabicName,
        vatRegistrationNumber: "300123456700003",
        issuedAt: new Date(),
        totalWithVatMinor: "1000",
        vatTotalMinor: "150",
        currencyScale: 2,
      };

      expect(() => buildZatcaPhase1Tlv(inv)).toThrow(ZatcaEncodingError);
    });
  });

  describe("3. TRN Validation Regex Stress Tests", () => {
    it("Stress 3.1: Validates TRNs across SA, AE, IN", () => {
      expect(validateTrn("SA", "300123456700003")).toBe(true);
      expect(validateTrn("SA", "100123456700003")).toBe(false); // Must start with 3
      expect(validateTrn("SA", "300123456700004")).toBe(false); // Must end with 3

      expect(validateTrn("AE", "123456789012345")).toBe(true);
      expect(validateTrn("AE", "12345678901234")).toBe(false); // 14 digits invalid

      expect(validateTrn("IN", "27AAAAA0000A1Z5")).toBe(true);
      expect(validateTrn("IN", "27AAAAA0000A1A5")).toBe(false); // 14th char must be 'Z'
    });
  });
});
