import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const creditNoteReasonSchema = z.enum([
  "RETURNED_GOODS",
  "BILLING_ERROR",
  "DISCOUNT",
  "CANCELLATION",
  "OTHER",
]);

export const creditNoteReasonLabelByCode = {
  RETURNED_GOODS: "Returned goods",
  BILLING_ERROR: "Billing error",
  DISCOUNT: "Discount",
  CANCELLATION: "Cancellation",
  OTHER: "Other",
} as const satisfies Record<z.infer<typeof creditNoteReasonSchema>, string>;

export function creditNoteReasonLabel(reason: z.infer<typeof creditNoteReasonSchema>): string {
  return creditNoteReasonLabelByCode[reason];
}

export const creditNoteLineInputSchema = z.strictObject({
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

export const createCreditNoteRequestSchema = z.strictObject({
  referenceInvoiceId: z.uuid().optional(),
  customerId: z.uuid(),
  reason: creditNoteReasonSchema,
  issueDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(creditNoteLineInputSchema).min(1).max(50),
});

export const updateCreditNoteRequestSchema = z.strictObject({
  reason: creditNoteReasonSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(creditNoteLineInputSchema).min(1).max(50),
});

export const creditNoteLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const creditNoteSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(["DRAFT", "ISSUED", "APPLIED", "CANCELLED"]),
  reason: creditNoteReasonSchema,
  issueDate: z.iso.date(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
  notes: z.string().nullable(),
  customer: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    phone: z.string().nullable(),
  }),
  referenceInvoice: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  lines: z.array(creditNoteLineSchema),
  allocations: z.array(
    z.strictObject({
      id: z.uuid(),
      invoiceId: z.uuid(),
      amountMinor: z.string(),
      createdAt: z.iso.datetime(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CreditNoteReason = z.infer<typeof creditNoteReasonSchema>;
export type CreditNote = z.infer<typeof creditNoteSchema>;
export type CreateCreditNoteRequest = z.infer<typeof createCreditNoteRequestSchema>;
export type UpdateCreditNoteRequest = z.infer<typeof updateCreditNoteRequestSchema>;
