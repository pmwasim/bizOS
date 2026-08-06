import { z } from "zod";

/**
 * Print formats for customer-facing documents.
 *
 * Per ADR-0019 (#8) a print format is a server-side template identified by a stable name, so the
 * layout is chosen from a closed set rather than authored by the business. Everything else here is
 * presentation-only branding: it changes how a quotation or invoice looks, never what it says about
 * money, tax, or dates. Totals stay authoritative on the server.
 */
export const documentLayoutSchema = z.enum(["STANDARD"]);

export const accentColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, for example #2457d6.");

export const DEFAULT_DOCUMENT_TEMPLATE = {
  layout: "STANDARD",
  accentColor: "#2457d6",
  headerText: null,
  showTaxRegistration: true,
  quotationFooter: null,
  invoiceFooter: null,
} as const;

export const documentTemplateSchema = z.strictObject({
  layout: documentLayoutSchema.default(DEFAULT_DOCUMENT_TEMPLATE.layout),
  accentColor: accentColorSchema.default(DEFAULT_DOCUMENT_TEMPLATE.accentColor),
  /** Wordmark printed at the top-left. Null falls back to the business name. */
  headerText: z.string().trim().min(1).max(60).nullable().default(null),
  /** Print the business tax registration number in the letterhead block. */
  showTaxRegistration: z.boolean().default(DEFAULT_DOCUMENT_TEMPLATE.showTaxRegistration),
  /** Null keeps the built-in wording, which already references the validity or due date. */
  quotationFooter: z.string().trim().min(1).max(500).nullable().default(null),
  invoiceFooter: z.string().trim().min(1).max(500).nullable().default(null),
});

export const updateDocumentTemplateRequestSchema = documentTemplateSchema;

export type DocumentLayout = z.infer<typeof documentLayoutSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type UpdateDocumentTemplateRequest = z.infer<typeof updateDocumentTemplateRequestSchema>;

/** Readable contrast against a filled accent block, so text stays legible on a chosen colour. */
export function readableTextColor(accentColor: string): "#ffffff" | "#172033" {
  const hex = accentColor.replace("#", "");
  const channel = (offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  const linear = (value: number) =>
    value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * linear(channel(0)) + 0.7152 * linear(channel(2)) + 0.0722 * linear(channel(4));
  // WCAG contrast against white is (1.05) / (L + 0.05); 0.179 is the crossover where black wins.
  return luminance > 0.179 ? "#172033" : "#ffffff";
}
