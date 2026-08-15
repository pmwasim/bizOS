import { encodeZatcaPhase1Qr } from "./zatca.js";

declare const Buffer:
  | {
      from(data: string, encoding?: string): { toString(encoding: string): string };
    }
  | undefined;

declare const btoa: ((str: string) => string) | undefined;

function _toBase64(str: string): string {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(str).toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(str);
  }
  return "";
}

export interface TaxCalculationRequest {
  countryCode: "SA" | "AE" | "IN";
  subtotalMinor: number;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    taxRatePercent: number;
    isZeroRated?: boolean;
  }>;
  sellerName?: string;
  sellerStateCode?: string;
  buyerStateCode?: string;
  transactionDate?: string;
  isReverseCharge?: boolean;
  trn?: string;
}

export interface TaxCalculationResult {
  countryCode: string;
  subtotalMinor: number;
  totalTaxMinor: number;
  totalAmountMinor: number;
  taxBreakdown: {
    vatMinor?: number;
    cgstMinor?: number;
    sgstMinor?: number;
    igstMinor?: number;
  };
  zatcaTlvQrBase64?: string;
  isReverseCharge: boolean;
  appliedTaxRatePercent: number;
}

export function validateTrn(countryCode: "SA" | "AE" | "IN", trn: string): boolean {
  if (countryCode === "SA") {
    return /^3\d{13}3$/.test(trn);
  }
  if (countryCode === "AE") {
    return /^\d{15}$/.test(trn);
  }
  if (countryCode === "IN") {
    return /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/.test(trn);
  }
  return false;
}

export function calculateTax(req: TaxCalculationRequest): TaxCalculationResult {
  if (req.trn && !validateTrn(req.countryCode, req.trn)) {
    throw new Error(
      `400 Bad Request: Invalid Tax Registration Number format for country ${req.countryCode}`,
    );
  }

  if (req.isReverseCharge) {
    return {
      countryCode: req.countryCode,
      subtotalMinor: req.subtotalMinor,
      totalTaxMinor: 0,
      totalAmountMinor: req.subtotalMinor,
      taxBreakdown: {},
      isReverseCharge: true,
      appliedTaxRatePercent: 0,
    };
  }

  if (req.countryCode === "SA") {
    let taxSum = 0;
    for (const line of req.lineItems) {
      if (!line.isZeroRated) {
        const lineTax = Math.round(
          (line.quantity * line.unitPriceMinor * (line.taxRatePercent ?? 15)) / 100,
        );
        taxSum += lineTax;
      }
    }
    const totalAmountMinor = req.subtotalMinor + taxSum;

    const sellerName =
      req.sellerName && req.sellerName.trim() ? req.sellerName.trim() : "Taxable Seller";
    const vatRegistrationNumber = req.trn && req.trn.trim() ? req.trn.trim() : "300000000000003";
    const issuedAt = req.transactionDate ? new Date(req.transactionDate) : new Date();

    const zatcaTlvQrBase64 = encodeZatcaPhase1Qr({
      sellerName,
      vatRegistrationNumber,
      issuedAt,
      totalWithVatMinor: BigInt(totalAmountMinor),
      vatTotalMinor: BigInt(taxSum),
      currencyScale: 2,
    });

    return {
      countryCode: "SA",
      subtotalMinor: req.subtotalMinor,
      totalTaxMinor: taxSum,
      totalAmountMinor,
      taxBreakdown: { vatMinor: taxSum },
      zatcaTlvQrBase64,
      isReverseCharge: false,
      appliedTaxRatePercent: 15,
    };
  }

  if (req.countryCode === "AE") {
    let taxSum = 0;
    for (const line of req.lineItems) {
      if (!line.isZeroRated) {
        const lineTax = Math.round(
          (line.quantity * line.unitPriceMinor * (line.taxRatePercent ?? 5)) / 100,
        );
        taxSum += lineTax;
      }
    }
    return {
      countryCode: "AE",
      subtotalMinor: req.subtotalMinor,
      totalTaxMinor: taxSum,
      totalAmountMinor: req.subtotalMinor + taxSum,
      taxBreakdown: { vatMinor: taxSum },
      isReverseCharge: false,
      appliedTaxRatePercent: 5,
    };
  }

  if (req.countryCode === "IN") {
    const isIntraState =
      Boolean(req.sellerStateCode) &&
      Boolean(req.buyerStateCode) &&
      req.sellerStateCode === req.buyerStateCode;

    if (isIntraState) {
      let cgstSum = 0;
      let sgstSum = 0;
      for (const line of req.lineItems) {
        if (!line.isZeroRated) {
          const rate = line.taxRatePercent ?? 18;
          const halfRate = rate / 2;
          const lineCgst = Math.round((line.quantity * line.unitPriceMinor * halfRate) / 100);
          const lineSgst = Math.round((line.quantity * line.unitPriceMinor * halfRate) / 100);
          cgstSum += lineCgst;
          sgstSum += lineSgst;
        }
      }
      const totalTax = cgstSum + sgstSum;
      return {
        countryCode: "IN",
        subtotalMinor: req.subtotalMinor,
        totalTaxMinor: totalTax,
        totalAmountMinor: req.subtotalMinor + totalTax,
        taxBreakdown: { cgstMinor: cgstSum, sgstMinor: sgstSum },
        isReverseCharge: false,
        appliedTaxRatePercent: 18,
      };
    } else {
      let totalTax = 0;
      for (const line of req.lineItems) {
        if (!line.isZeroRated) {
          const rate = line.taxRatePercent ?? 18;
          totalTax += Math.round((line.quantity * line.unitPriceMinor * rate) / 100);
        }
      }
      return {
        countryCode: "IN",
        subtotalMinor: req.subtotalMinor,
        totalTaxMinor: totalTax,
        totalAmountMinor: req.subtotalMinor + totalTax,
        taxBreakdown: { igstMinor: totalTax },
        isReverseCharge: false,
        appliedTaxRatePercent: 18,
      };
    }
  }

  throw new Error(`400 Bad Request: Unsupported country code ${req.countryCode}`);
}

export class MultiCountryTaxEngine {
  public validateTrn(countryCode: "SA" | "AE" | "IN", trn: string): boolean {
    return validateTrn(countryCode, trn);
  }

  public calculateTax(req: TaxCalculationRequest): TaxCalculationResult {
    return calculateTax(req);
  }
}
