import { describe, expect, it } from "vitest";

import { calculateQuotation } from "./quotation-calculator.js";

describe("calculateQuotation", () => {
  it("calculates exact totals across decimal quantities and tax rates", () => {
    const result = calculateQuotation(
      {
        customerId: "a2803a9d-c52c-4078-8de1-78b0664ef4e1",
        lines: [
          {
            description: "Consulting",
            quantity: "1.5",
            unitPrice: "100.00",
            taxRatePercent: "15",
          },
          {
            description: "Travel",
            quantity: "1",
            unitPrice: "25.25",
            taxRatePercent: "0",
          },
        ],
      },
      2,
    );

    expect(result.subtotalMinor).toBe(17_525n);
    expect(result.taxMinor).toBe(2_250n);
    expect(result.totalMinor).toBe(19_775n);
    expect(result.lines[0]).toMatchObject({
      position: 1,
      unitPriceMinor: 10_000n,
      taxRatePpm: 150_000,
    });
  });

  it("rejects a zero quantity before persistence", () => {
    expect(() =>
      calculateQuotation(
        {
          customerId: "a2803a9d-c52c-4078-8de1-78b0664ef4e1",
          lines: [
            {
              description: "Consulting",
              quantity: "0",
              unitPrice: "100.00",
              taxRatePercent: "15",
            },
          ],
        },
        2,
      ),
    ).toThrow("Quantity must be greater than zero");
  });
});
