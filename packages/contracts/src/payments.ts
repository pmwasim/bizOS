import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const paymentMethodSchema = z.enum(["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "OTHER"]);

export const customerPaymentStatusSchema = z.enum(["RECORDED", "VOIDED"]);

export const invoiceBalanceStatusSchema = z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]);

export const paymentMethodLabelByCode = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  OTHER: "Other",
} as const satisfies Record<z.infer<typeof paymentMethodSchema>, string>;

export const invoiceBalanceStatusLabelByCode = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
} as const satisfies Record<z.infer<typeof invoiceBalanceStatusSchema>, string>;

export function paymentMethodLabel(method: z.infer<typeof paymentMethodSchema>): string {
  return paymentMethodLabelByCode[method];
}

export function invoiceBalanceStatusLabel(
  status: z.infer<typeof invoiceBalanceStatusSchema>,
): string {
  return invoiceBalanceStatusLabelByCode[status];
}

export function deriveInvoiceBalanceStatus(input: {
  totalMinor: string;
  allocatedMinor: string;
}): z.infer<typeof invoiceBalanceStatusSchema> {
  const total = BigInt(input.totalMinor);
  const allocated = BigInt(input.allocatedMinor);
  if (allocated <= 0n) {
    return "UNPAID";
  }
  if (allocated >= total) {
    return "PAID";
  }
  return "PARTIALLY_PAID";
}

export const createCustomerPaymentRequestSchema = z.strictObject({
  invoiceId: z.uuid(),
  amount: decimalSchema.refine(
    (value) => !/^0(?:\.0+)?$/.test(value),
    "Amount must be greater than zero.",
  ),
  receivedOn: z.iso.date(),
  method: paymentMethodSchema,
  reference: optionalTrimmed(120),
  notes: optionalTrimmed(2000),
});

export const voidCustomerPaymentRequestSchema = z.strictObject({
  reason: optionalTrimmed(500),
});

export const paymentAllocationSchema = z.strictObject({
  id: z.uuid(),
  amountMinor: z.string().regex(/^\d+$/),
  invoice: z.strictObject({
    id: z.uuid(),
    number: z.string(),
  }),
  createdAt: z.iso.datetime(),
});

export const customerPaymentSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: customerPaymentStatusSchema,
  receivedOn: z.iso.date(),
  method: paymentMethodSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  amountMinor: z.string().regex(/^\d+$/),
  voidedAt: z.iso.datetime().nullable(),
  voidReason: z.string().nullable(),
  customer: z.strictObject({
    id: z.uuid(),
    name: z.string(),
  }),
  allocations: z.array(paymentAllocationSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const invoicePaymentSummarySchema = z.strictObject({
  totalMinor: z.string().regex(/^\d+$/),
  allocatedMinor: z.string().regex(/^\d+$/),
  outstandingMinor: z.string().regex(/^\d+$/),
  balanceStatus: invoiceBalanceStatusSchema,
  payments: z.array(
    z.strictObject({
      id: z.uuid(),
      number: z.string(),
      status: customerPaymentStatusSchema,
      receivedOn: z.iso.date(),
      method: paymentMethodSchema,
      amountMinor: z.string().regex(/^\d+$/),
      allocationAmountMinor: z.string().regex(/^\d+$/),
    }),
  ),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type CustomerPaymentStatus = z.infer<typeof customerPaymentStatusSchema>;
export type InvoiceBalanceStatus = z.infer<typeof invoiceBalanceStatusSchema>;
export type CreateCustomerPaymentRequest = z.infer<typeof createCustomerPaymentRequestSchema>;
export type VoidCustomerPaymentRequest = z.infer<typeof voidCustomerPaymentRequestSchema>;
export type CustomerPayment = z.infer<typeof customerPaymentSchema>;
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;
export type InvoicePaymentSummary = z.infer<typeof invoicePaymentSummarySchema>;
