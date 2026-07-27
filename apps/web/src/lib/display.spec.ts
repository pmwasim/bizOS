import { describe, expect, it } from "vitest";

import { estimateQuotationTotal, formatMoney } from "./display";

describe("quotation display helpers", () => {
  it("formats server totals using the declared currency scale", () => {
    expect(formatMoney("23000", "SAR", 2, "en")).toContain("230.00");
  });

  it("shows a responsive estimate while the server remains authoritative", () => {
    expect(
      estimateQuotationTotal([{ quantity: "2", unitPrice: "100", taxRatePercent: "15" }]),
    ).toBeCloseTo(230, 8);
  });
});
