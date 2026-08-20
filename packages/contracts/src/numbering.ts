import { z } from "zod";

// Document numbering — configurable, per-business, per-document-type sequences.
//
// Prefix, next number, and zero-padding width are configured per document type and persisted on the
// business-settings model. Number allocation itself happens in the API inside a single atomic
// `UPDATE … RETURNING` on the settings counter row, so two concurrent documents of the same type
// can never receive the same number. These contracts describe the configurable surface and fail
// closed on invalid config: the type is a real enum (never a cast), the object is strict (unknown
// keys are rejected), and the prefix/width bounds are enforced by regex and range.

export const documentNumberingTypeSchema = z.enum([
  "QUOTATION",
  "INVOICE",
  "SALES_ORDER",
  "DELIVERY_NOTE",
  "CREDIT_NOTE",
  "PURCHASE_ORDER",
  "SUPPLIER_PO",
  "SUPPLIER_BILL",
  "PAYMENT",
]);

export type DocumentNumberingType = z.infer<typeof documentNumberingTypeSchema>;

/** Every document numbering type, in declaration order. */
export const DOCUMENT_NUMBERING_TYPES = documentNumberingTypeSchema.options;

/** Prefix: 1–12 uppercase letters, digits, or hyphens. Trimmed and upper-cased before validation. */
export const numberingPrefixSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,12}$/);

/** Zero-padding width for the sequence part of a number, e.g. width 4 renders `INV-0001`. */
export const numberingPadWidthSchema = z.number().int().min(1).max(12);

/** The next sequence value a business will hand out for a document type. */
export const numberingNextNumberSchema = z.number().int().min(1).max(2_000_000_000);

export const documentNumberingConfigSchema = z.strictObject({
  type: documentNumberingTypeSchema,
  prefix: numberingPrefixSchema,
  nextNumber: numberingNextNumberSchema.default(1),
  padWidth: numberingPadWidthSchema.default(4),
});

export type DocumentNumberingConfig = z.infer<typeof documentNumberingConfigSchema>;

/** Default zero-padding width when a business has not customised one. */
export const DEFAULT_NUMBER_PAD_WIDTH = 4;

/**
 * Render a document number from its parts. Kept here so the API allocator and any presentation
 * layer format numbers identically. `sequence` is the 1-based ordinal already allocated for the
 * document; `padWidth` is left-padded with zeros.
 */
export function formatDocumentNumber(prefix: string, sequence: number, padWidth: number): string {
  return `${prefix}-${String(sequence).padStart(padWidth, "0")}`;
}
