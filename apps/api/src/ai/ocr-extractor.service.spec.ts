import { describe, expect, it } from "vitest";

import { parseLineItem } from "./ocr-extractor.service.js";

describe("parseLineItem", () => {
  it("reads a plain description, quantity, unit price, and total", () => {
    expect(parseLineItem("Hammer 2 50.00 100.00")).toEqual({
      description: "Hammer",
      quantity: 2,
      unitPrice: 50,
      total: 100,
    });
  });

  it("accepts multi-word descriptions and the optional separators", () => {
    expect(parseLineItem("Steel Bracket 10 x 12.5 = 125.0")).toEqual({
      description: "Steel Bracket",
      quantity: 10,
      unitPrice: 12.5,
      total: 125,
    });
    expect(parseLineItem("Nails 3 x1.5 total 4.5")).toEqual({
      description: "Nails",
      quantity: 3,
      unitPrice: 1.5,
      total: 4.5,
    });
  });

  it("rejects lines that are not line items", () => {
    expect(parseLineItem("Subtotal 100.00")).toBeNull();
    expect(parseLineItem("")).toBeNull();
    expect(parseLineItem("Invoice #INV-1 for ACME Corp")).toBeNull();
  });

  it("returns promptly on pathological input rather than backtracking", () => {
    // The previous regex was a polynomial-ReDoS vector (CodeQL js/polynomial-redos): a long run of
    // whitespace-and-digits made matching quadratic. Tokenised parsing is linear.
    const hostile = `${" ".repeat(50_000)}0.${" ".repeat(50_000)}`;
    const startedAt = performance.now();

    expect(parseLineItem(hostile)).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});
