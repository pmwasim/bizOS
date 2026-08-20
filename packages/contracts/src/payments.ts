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

export const paymentStatusSchema = z.enum(["DRAFT", "COMPLETED", "REVERSED", "VOIDED"]);

export const paymentStatusLabelByCode = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
  REVERSED: "Reversed",
  VOIDED: "Voided",
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
    const targetCount =
      Number(Boolean(allocation.documentId)) + Number(Boolean(allocation.purchaseOrderId));
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

const reasonSchema = z.string().trim().min(1).max(500);

/**
 * Void a DRAFT payment (it never settled anything). Terminal — a voided payment cannot be edited,
 * completed, reversed, or refunded afterwards. An optional reason is captured for the audit trail.
 */
export const voidPaymentRequestSchema = z.strictObject({
  reason: reasonSchema.nullable().optional(),
});

/**
 * Reverse a COMPLETED payment. Its allocations immediately stop counting toward invoice settlement
 * (settlement is derived from COMPLETED allocations only), so no compensating writes are needed.
 */
export const reversePaymentRequestSchema = z.strictObject({
  reason: reasonSchema.nullable().optional(),
});

/**
 * Record a refund against a COMPLETED payment. `amountMinor` is the positive magnitude returned to
 * the customer; the cumulative refunded amount is fail-closed to never exceed the payment amount.
 */
export const refundPaymentRequestSchema = z.strictObject({
  amountMinor: positiveMinorUnitValueSchema,
  reason: reasonSchema.nullable().optional(),
});

export const paymentAllocationSchema = z.strictObject({
  id: z.string().uuid(),
  documentId: z.string().uuid().nullable(),
  purchaseOrderId: z.string().uuid().nullable(),
  amountMinor: minorUnitValueSchema,
  createdAt: z.string().datetime(),
});

/**
 * One recorded refund: a distinct, append-only negative movement returning money to the customer
 * against a COMPLETED payment. `amountMinor` is the positive magnitude returned. The original
 * payment amount is never mutated — the net position is derived from the payment amount less the sum
 * of its refunds.
 */
export const paymentRefundSchema = z.strictObject({
  id: z.string().uuid(),
  amountMinor: positiveMinorUnitValueSchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  reason: z.string().nullable(),
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
  // Refund ledger against this payment, plus the derived totals: `refundedMinor` is the sum of the
  // refunds and `netAmountMinor` is the payment amount less that sum (never below zero).
  refunds: z.array(paymentRefundSchema),
  refundedMinor: minorUnitValueSchema,
  netAmountMinor: minorUnitValueSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const paymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER", "CHECK", "CARD", "OTHER"]);

export const paymentMethodLabelByCode = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CHECK: "Check",
  CARD: "Card",
  OTHER: "Other",
} as const satisfies Record<z.infer<typeof paymentMethodSchema>, string>;

export function paymentMethodLabel(method: z.infer<typeof paymentMethodSchema>): string {
  return paymentMethodLabelByCode[method];
}

export const createCustomerPaymentRequestSchema = z.strictObject({
  invoiceId: z.uuid(),
  paymentDate: z.string().date(),
  amountMinor: positiveMinorUnitValueSchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const voidCustomerPaymentRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500),
});

export const settlementStatusSchema = z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]);

export const settlementStatusLabelByCode = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
} as const satisfies Record<z.infer<typeof settlementStatusSchema>, string>;

export function settlementStatusLabel(status: z.infer<typeof settlementStatusSchema>): string {
  return settlementStatusLabelByCode[status];
}

/**
 * Settlement is derived, never stored: an invoice is PAID once completed, non-reversed allocations
 * cover its total, PARTIALLY_PAID while some (but not all) of it is covered, and UNPAID otherwise.
 * Reversing or voiding a payment simply drops its allocations from `paidMinor`, so the status falls
 * back on its own. Kept as a pure function so the API and the web derive the same answer.
 */
export function deriveSettlementStatus(paidMinor: bigint, totalMinor: bigint): SettlementStatus {
  if (paidMinor <= 0n) {
    return "UNPAID";
  }
  if (paidMinor >= totalMinor) {
    return "PAID";
  }
  return "PARTIALLY_PAID";
}

export const invoicePaymentSummarySchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  totalMinor: minorUnitValueSchema,
  paidMinor: minorUnitValueSchema,
  outstandingMinor: minorUnitValueSchema,
  settlementStatus: settlementStatusSchema,
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
});

export const customerPaymentSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(["RECORDED", "VOIDED"]),
  receivedOn: z.string().date(),
  method: paymentMethodSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  amountMinor: minorUnitValueSchema,
  voidedAt: z.string().datetime().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>;
export type RecordPaymentRequest = z.infer<typeof recordPaymentRequestSchema>;
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;
export type PaymentRefund = z.infer<typeof paymentRefundSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type VoidPaymentRequest = z.infer<typeof voidPaymentRequestSchema>;
export type ReversePaymentRequest = z.infer<typeof reversePaymentRequestSchema>;
export type RefundPaymentRequest = z.infer<typeof refundPaymentRequestSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;
export type CreateCustomerPaymentRequest = z.infer<typeof createCustomerPaymentRequestSchema>;
export type VoidCustomerPaymentRequest = z.infer<typeof voidCustomerPaymentRequestSchema>;
export type InvoicePaymentSummary = z.infer<typeof invoicePaymentSummarySchema>;
export type CustomerPayment = z.infer<typeof customerPaymentSchema>;
