import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const invoiceStatusSchema = z.enum([
  "DRAFT",
  "READY_TO_SEND",
  "SENT",
  "SEND_FAILED",
  "ARCHIVED",
]);

export const invoiceStatusLabelByCode = {
  DRAFT: "Draft",
  READY_TO_SEND: "Ready to send",
  SENT: "Sent",
  SEND_FAILED: "Send failed",
  ARCHIVED: "Archived",
} as const satisfies Record<z.infer<typeof invoiceStatusSchema>, string>;

export function invoiceStatusLabel(status: z.infer<typeof invoiceStatusSchema>): string {
  return invoiceStatusLabelByCode[status];
}

export const invoiceLineInputSchema = z.strictObject({
  description: z.string().trim().min(1).max(500),
  quantity: decimalSchema
    .refine((value) => !/^0(?:\.0+)?$/.test(value), "Quantity must be greater than zero.")
    .refine(
      (value) => !value.includes(".") || value.split(".")[1]!.length <= 6,
      "Use no more than 6 decimal places.",
    ),
  unitPrice: decimalSchema,
  taxRatePercent: percentageSchema,
});

export const createInvoiceFromQuotationRequestSchema = z.strictObject({
  quotationId: z.uuid(),
});

/**
 * The one-click convert endpoint takes the quotation id from the URL path, so its request body
 * carries no fields. It stays a schema (rather than nothing) so the BFF and controller validate the
 * shape and reject stray properties, matching every other write contract.
 */
export const convertQuotationToInvoiceRequestSchema = z.strictObject({});

export const updateInvoiceRequestSchema = z.strictObject({
  issueDate: z.iso.date().optional(),
  dueDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(invoiceLineInputSchema).min(1).max(50),
});

export const sendInvoiceRequestSchema = z.strictObject({
  recipientEmail: z.email("Enter a valid email address.").max(320),
  message: z.string().trim().max(2000).nullable(),
});

export const invoiceLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const invoiceSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: invoiceStatusSchema,
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
  validUntil: z.iso.date(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
  notes: z.string().nullable(),
  poNumber: z.string().nullable(),
  projectReference: z.string().nullable(),
  customer: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    phone: z.string().nullable(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    postalCode: z.string().nullable(),
    countryCode: z.string().nullable(),
  }),
  sourceQuotation: z.strictObject({
    id: z.uuid(),
    number: z.string(),
  }),
  purchaseOrder: z
    .strictObject({
      id: z.uuid(),
      poNumber: z.string(),
    })
    .nullable(),
  lines: z.array(invoiceLineSchema),
  latestDelivery: z
    .strictObject({
      id: z.uuid(),
      status: z.enum(["PENDING", "SENT", "FAILED"]),
      recipientEmail: z.email(),
      sentAt: z.iso.datetime().nullable(),
      failureReason: z.string().nullable(),
    })
    .nullable()
    .optional(),
  sentAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * Converting a quotation returns the draft invoice it produced (or, when the quotation was already
 * converted, the invoice that already exists). Either way the response is a full invoice.
 */
export const convertQuotationToInvoiceResponseSchema = invoiceSchema;

export const invoiceDeliveryResultSchema = z.strictObject({
  invoice: invoiceSchema,
  delivery: z.strictObject({
    id: z.uuid(),
    status: z.enum(["SENT"]),
    recipientEmail: z.email(),
    sentAt: z.iso.datetime(),
  }),
});

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type CreateInvoiceFromQuotationRequest = z.infer<
  typeof createInvoiceFromQuotationRequestSchema
>;
export type ConvertQuotationToInvoiceRequest = z.infer<
  typeof convertQuotationToInvoiceRequestSchema
>;
export type ConvertQuotationToInvoiceResponse = z.infer<
  typeof convertQuotationToInvoiceResponseSchema
>;
export type UpdateInvoiceRequest = z.infer<typeof updateInvoiceRequestSchema>;
export type SendInvoiceRequest = z.infer<typeof sendInvoiceRequestSchema>;
