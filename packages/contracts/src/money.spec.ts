import { describe, expect, it } from "vitest";

import { calculateLine, formatScaledInteger, parseDecimalToScaledInteger } from "./money.js";

describe("exact money helpers", () => {
  it("parses and formats minor units without floating point", () => {
    expect(parseDecimalToScaledInteger("1234.50", 2)).toBe(123_450n);
    expect(formatScaledInteger(123_450n, 2)).toBe("1234.50");
  });

  it("rejects material precision beyond the currency scale", () => {
    expect(() => parseDecimalToScaledInteger("1.001", 2)).toThrow(
      "Use no more than 2 decimal places.",
    );
    expect(parseDecimalToScaledInteger("1.000", 2)).toBe(100n);
  });

  it("calculates quantity and tax with deterministic half-up rounding", () => {
    expect(calculateLine("2.5", "100.00", 2, "15")).toEqual({
      subtotalMinor: 25_000n,
      taxMinor: 3_750n,
      totalMinor: 28_750n,
    });
  });
});
