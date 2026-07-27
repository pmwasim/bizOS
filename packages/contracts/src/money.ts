const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export interface MoneyValue {
  amountMinor: string;
  currency: string;
  scale: number;
}

export interface CalculatedLine {
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) {
    throw new RangeError("Scale must be an integer between 0 and 6.");
  }
}

export function parseDecimalToScaledInteger(value: string, scale: number): bigint {
  assertScale(scale);
  const normalized = value.trim();
  const match = DECIMAL_PATTERN.exec(normalized);

  if (!match) {
    throw new TypeError("Enter a positive number without separators.");
  }

  const fraction = match[2] ?? "";
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) {
    throw new RangeError(`Use no more than ${scale} decimal places.`);
  }

  const whole = match[1] ?? "0";
  const minor = `${whole}${fraction.slice(0, scale).padEnd(scale, "0")}`.replace(/^0+(?=\d)/, "");

  if (minor.length > 38) {
    throw new RangeError("The amount is too large.");
  }

  return BigInt(minor || "0");
}

export function formatScaledInteger(value: bigint, scale: number): string {
  assertScale(scale);
  if (value < 0n) {
    throw new RangeError("MVP money values cannot be negative.");
  }

  if (scale === 0) {
    return value.toString();
  }

  const digits = value.toString().padStart(scale + 1, "0");
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new RangeError("Only non-negative values and a positive denominator are supported.");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function calculateLine(
  quantity: string,
  unitPrice: string,
  currencyScale: number,
  taxRatePercent: string,
): CalculatedLine {
  const quantityMicros = parseDecimalToScaledInteger(quantity, 6);
  if (quantityMicros === 0n) {
    throw new RangeError("Quantity must be greater than zero.");
  }

  const unitPriceMinor = parseDecimalToScaledInteger(unitPrice, currencyScale);
  const taxRatePpm = parseDecimalToScaledInteger(taxRatePercent, 4);
  if (taxRatePpm > 1_000_000n) {
    throw new RangeError("Tax rate cannot exceed 100%.");
  }

  const subtotalMinor = roundDivide(quantityMicros * unitPriceMinor, 1_000_000n);
  const taxMinor = roundDivide(subtotalMinor * taxRatePpm, 1_000_000n);

  return {
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
  };
}
