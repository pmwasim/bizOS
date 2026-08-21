import { describe, expect, it } from "vitest";

import { estimateQuotationTotal, formatMoney } from "./display";

describe("quotation display helpers", () => {
  it("formats server totals using the declared currency scale", () => {
    expect(formatMoney("23000", "SAR", 2, "en")).toContain("230.00");
  });

  it("formats regional currencies (AED, INR, USD, GBP, BHD)", () => {
    expect(formatMoney("150000", "INR", 2, "en")).toContain("1,500.00");
    expect(formatMoney("5000", "AED", 2, "en")).toContain("50.00");
    expect(formatMoney("1000", "BHD", 3, "en")).toContain("1.000");
  });

  it("handles zero and small amounts cleanly", () => {
    expect(formatMoney("0", "USD", 2, "en")).toContain("0.00");
  });

  it("shows a responsive estimate while the server remains authoritative", () => {
    expect(
      estimateQuotationTotal([{ quantity: "2", unitPrice: "100", taxRatePercent: "15" }]),
    ).toBeCloseTo(230, 8);
    expect(
      estimateQuotationTotal([
        { quantity: "1", unitPrice: "1000", taxRatePercent: "18" },
        { quantity: "3", unitPrice: "200", taxRatePercent: "18" },
      ]),
    ).toBeCloseTo(1888, 8);
  });
});
