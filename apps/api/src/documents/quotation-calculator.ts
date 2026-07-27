import {
  calculateLine,
  parseDecimalToScaledInteger,
  type CalculatedLine,
} from "@bizo/contracts/money";
import { type SaveQuotationRequest } from "@bizo/contracts/quotations";

export interface CalculatedQuotationLine extends CalculatedLine {
  description: string;
  position: number;
  quantity: string;
  taxRatePpm: number;
  unitPriceMinor: bigint;
}

export interface CalculatedQuotation {
  lines: CalculatedQuotationLine[];
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
}

export function calculateQuotation(
  input: SaveQuotationRequest,
  currencyScale: number,
): CalculatedQuotation {
  let subtotalMinor = 0n;
  let taxMinor = 0n;
  let totalMinor = 0n;

  const lines = input.lines.map((line, index) => {
    const calculated = calculateLine(
      line.quantity,
      line.unitPrice,
      currencyScale,
      line.taxRatePercent,
    );
    subtotalMinor += calculated.subtotalMinor;
    taxMinor += calculated.taxMinor;
    totalMinor += calculated.totalMinor;

    return {
      ...calculated,
      description: line.description,
      position: index + 1,
      quantity: line.quantity,
      unitPriceMinor: parseDecimalToScaledInteger(line.unitPrice, currencyScale),
      taxRatePpm: Number(parseDecimalToScaledInteger(line.taxRatePercent, 4)),
    };
  });

  return { lines, subtotalMinor, taxMinor, totalMinor };
}
