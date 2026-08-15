import {
  calculateLine,
  parseDecimalToScaledInteger,
  type CalculatedLine,
} from "@bizo/contracts/money";

export interface DocumentLineInput {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
}

export interface CalculatedDocumentLine extends CalculatedLine {
  description: string;
  position: number;
  quantity: string;
  taxRatePpm: number;
  unitPriceMinor: bigint;
}

export interface CalculatedDocument {
  lines: CalculatedDocumentLine[];
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
}

export function calculateDocumentTotals(
  inputs: DocumentLineInput[],
  currencyScale: number,
): CalculatedDocument {
  let subtotalMinor = 0n;
  let taxMinor = 0n;
  let totalMinor = 0n;

  const lines = inputs.map((line, index) => {
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
