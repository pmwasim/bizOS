import { z } from "zod";

const minorUnitValueSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)$/, "Amount must be an integer expressed in minor units.");

const positiveMinorUnitValueSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "Amount must be greater than zero and expressed in minor units.");

export const paymentTypeSchema = z.enum(["INBOUND", "OUTBOUND"]);

export const paymentStatusSchema = z.enum(["DRAFT", "COMPLETED", "REVERSED"]);

export const paymentStatusLabelByCode = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
  REVERSED: "Reversed",
} as const satisfies Record<z.infer<typeof paymentStatusSchema>, string>;

export function paymentStatusLabel(status: z.infer<typeof paymentStatusSchema>): string {
  return paymentStatusLabelByCode[status];
}

export const paymentAllocationInputSchema = z
  .strictObject({
    documentId: z.string().uuid().optional(),
    purchaseOrderId: z.string().uuid().optional(),
    amountMinor: positiveMinorUnitValueSchema,
  })
  .superRefine((allocation, context) => {
    const targetCount = Number(Boolean(allocation.documentId)) + Number(Boolean(allocation.purchaseOrderId));
    if (targetCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "Each allocation must reference exactly one invoice or purchase order.",
      });
    }
  });

export const recordPaymentRequestSchema = z.strictObject({
  type: paymentTypeSchema,
  paymentDate: z.string().date(),
  amountMinor: positiveMinorUnitValueSchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  allocations: z.array(paymentAllocationInputSchema).max(50),
});

export const paymentAllocationSchema = z.strictObject({
  id: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  purchaseOrderId: z.string().uuid().nullable(),
  amountMinor: minorUnitValueSchema,
  createdAt: z.string().datetime(),
});

export const paymentSchema = z.strictObject({
  id: z.string().uuid(),
  type: paymentTypeSchema,
  status: paymentStatusSchema,
  paymentDate: z.string().date(),
  amountMinor: minorUnitValueSchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  allocations: z.array(paymentAllocationSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
export type RecordPaymentRequest = z.infer<typeof recordPaymentRequestSchema>;
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;
export type Payment = z.infer<typeof paymentSchema>;
