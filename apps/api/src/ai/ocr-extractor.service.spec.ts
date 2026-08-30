import { describe, expect, it, vi } from "vitest";

import { OcrExtractorService, parseLineItem } from "./ocr-extractor.service.js";
import { ZeroBudgetAiProvider } from "./zero-budget-ai.provider.js";

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

describe("OcrExtractorService.extractFromBufferWithAi merge", () => {
  const content = "Merchant: Global Stationery KSA\nInvoice #INV-2026-001\nDate: 2026-08-05\n";
  const buffer = () => Buffer.from(content, "utf-8");

  function serviceWithAiReply(raw: string): OcrExtractorService {
    const provider = new ZeroBudgetAiProvider();
    vi.spyOn(provider, "completeChat").mockResolvedValue({
      text: raw,
      backend: "ollama",
      model: "test-model",
    });
    return new OcrExtractorService(provider);
  }

  it("keeps the heuristic amount when the model returns null instead of overwriting it with 0", async () => {
    const heuristic = new OcrExtractorService().extractFromBuffer(buffer(), "application/pdf");
    const service = serviceWithAiReply(
      JSON.stringify({
        merchantName: "Global Stationery KSA",
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-08-05",
        subtotal: null,
        taxAmount: null,
        totalAmount: null,
        lineItems: [],
      }),
    );

    const result = await service.extractFromBufferWithAi(buffer(), "application/pdf");

    // A null amount means "the model doesn't know", not "the model says zero" — the deterministic
    // heuristic value must survive, not get overwritten with 0.
    expect(result.subtotal).toBe(heuristic.subtotal);
    expect(result.taxAmount).toBe(heuristic.taxAmount);
    expect(result.totalAmount).toBe(heuristic.totalAmount);
  });

  it("recomputes the discrepancy warning and status from the merged amounts, not the pre-AI ones", async () => {
    // The heuristic pass over this content has no discrepancy (total == subtotal + tax). The AI
    // reply is internally inconsistent — its own subtotal/tax don't add up to its own total — and
    // that must surface as a fresh discrepancy, not the (absent) heuristic one.
    const service = serviceWithAiReply(
      JSON.stringify({
        merchantName: "Global Stationery KSA",
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-08-05",
        subtotal: 100,
        taxAmount: 15,
        totalAmount: 200,
        lineItems: [{ description: "Widget", quantity: 1, unitPrice: 100, total: 100 }],
      }),
    );

    const result = await service.extractFromBufferWithAi(buffer(), "application/pdf");

    expect(result.subtotal).toBe(100);
    expect(result.taxAmount).toBe(15);
    expect(result.totalAmount).toBe(200);
    expect(result.discrepancyWarning).toBe(
      "Line item sum (115.00) does not match total amount (200.00)",
    );
    expect(result.status).toBe("NEEDS_HUMAN_VERIFICATION");
  });

  it("clears a heuristic discrepancy once the merged amounts reconcile", async () => {
    // DISCREPANCY_TOTAL forces the heuristic pass to disagree with itself; a clean AI reply that
    // actually reconciles must clear the warning rather than carry the stale one forward.
    const discrepancyContent = `${content}DISCREPANCY_TOTAL\n`;
    const discrepancyBuffer = () => Buffer.from(discrepancyContent, "utf-8");
    const heuristic = new OcrExtractorService().extractFromBuffer(
      discrepancyBuffer(),
      "application/pdf",
    );
    expect(heuristic.discrepancyWarning).toBeDefined();

    const provider = new ZeroBudgetAiProvider();
    vi.spyOn(provider, "completeChat").mockResolvedValue({
      text: JSON.stringify({
        merchantName: "Global Stationery KSA",
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-08-05",
        subtotal: 100,
        taxAmount: 15,
        totalAmount: 115,
        lineItems: [{ description: "Widget", quantity: 1, unitPrice: 100, total: 100 }],
      }),
      backend: "ollama",
      model: "test-model",
    });
    const service = new OcrExtractorService(provider);

    const result = await service.extractFromBufferWithAi(discrepancyBuffer(), "application/pdf");

    expect(result.discrepancyWarning).toBeUndefined();
    expect("discrepancyWarning" in result).toBe(false);
  });
});
