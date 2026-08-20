import { describe, expect, it } from "vitest";

import {
  DEFAULT_NUMBER_PAD_WIDTH,
  DOCUMENT_NUMBERING_TYPES,
  documentNumberingConfigSchema,
  documentNumberingTypeSchema,
  formatDocumentNumber,
} from "./numbering.js";

describe("documentNumberingTypeSchema", () => {
  it("accepts every known document type", () => {
    for (const type of DOCUMENT_NUMBERING_TYPES) {
      expect(documentNumberingTypeSchema.parse(type)).toBe(type);
    }
  });

  it("fails closed on an unknown document type instead of coercing it", () => {
    const result = documentNumberingTypeSchema.safeParse("PACKING_SLIP");
    expect(result.success).toBe(false);
  });
});

describe("documentNumberingConfigSchema", () => {
  it("normalises and applies defaults for a valid config", () => {
    const parsed = documentNumberingConfigSchema.parse({ type: "INVOICE", prefix: "inv-a" });
    expect(parsed).toEqual({
      type: "INVOICE",
      prefix: "INV-A",
      nextNumber: 1,
      padWidth: DEFAULT_NUMBER_PAD_WIDTH,
    });
  });

  it("rejects a prefix with illegal characters", () => {
    const result = documentNumberingConfigSchema.safeParse({ type: "INVOICE", prefix: "IN V/1" });
    expect(result.success).toBe(false);
  });

  it("rejects a prefix longer than twelve characters", () => {
    const result = documentNumberingConfigSchema.safeParse({
      type: "INVOICE",
      prefix: "ABCDEFGHIJKLM",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a pad width outside the supported range", () => {
    expect(
      documentNumberingConfigSchema.safeParse({ type: "INVOICE", prefix: "INV", padWidth: 0 })
        .success,
    ).toBe(false);
    expect(
      documentNumberingConfigSchema.safeParse({ type: "INVOICE", prefix: "INV", padWidth: 13 })
        .success,
    ).toBe(false);
  });

  it("rejects a next number below one", () => {
    const result = documentNumberingConfigSchema.safeParse({
      type: "INVOICE",
      prefix: "INV",
      nextNumber: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys rather than silently dropping them", () => {
    const result = documentNumberingConfigSchema.safeParse({
      type: "INVOICE",
      prefix: "INV",
      reset: "ANNUALLY",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer pad width", () => {
    const result = documentNumberingConfigSchema.safeParse({
      type: "INVOICE",
      prefix: "INV",
      padWidth: 3.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("formatDocumentNumber", () => {
  it("left-pads the sequence to the configured width", () => {
    expect(formatDocumentNumber("INV", 1, 4)).toBe("INV-0001");
    expect(formatDocumentNumber("Q", 42, 6)).toBe("Q-000042");
  });

  it("does not truncate a sequence wider than the pad width", () => {
    expect(formatDocumentNumber("INV", 123456, 4)).toBe("INV-123456");
  });
});
