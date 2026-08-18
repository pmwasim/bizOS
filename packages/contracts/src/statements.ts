import { z } from "zod";

/** `YYYY-MM-DD`. Statements are reported in whole days, never in instants. */
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

const currencySchema = z.string().trim().length(3).toUpperCase();
const currencyScaleSchema = z.number().int().min(0).max(6);

/**
 * A monetary amount in integer minor units, encoded as a decimal string.
 *
 * Minor units are arbitrary-size integers (ADR-0008). A value above `Number.MAX_SAFE_INTEGER` would
 * round silently if it crossed the wire as a JS number, so every money field on a statement is a
 * string and is parsed with `BigInt` where arithmetic is needed. Scale stays a `number` — it is a
 * small exponent, not an amount. `minorUnitsSchema` is signed (a balance can be negative);
 * `nonNegativeMinorUnitsSchema` is for amounts that cannot be, such as an outstanding total or a
 * bucket sum.
 */
const minorUnitsSchema = z.string().regex(/^-?\d+$/, "Use an integer number of minor units.");
const nonNegativeMinorUnitsSchema = z
  .string()
  .regex(/^\d+$/, "Use a non-negative integer number of minor units.");

/**
 * A statement line is one of three things, and only three: an invoice the customer owes, a receipt
 * applied against one, or a credit note applied against one. There is no "adjustment" — every
 * movement on a bizOS statement traces back to a document or a payment the business recorded.
 */
export const statementLineTypeSchema = z.enum(["INVOICE", "PAYMENT", "CREDIT_NOTE"]);
export type StatementLineType = z.infer<typeof statementLineTypeSchema>;

export const statementLineItemSchema = z.object({
  id: z.string(),
  date: dateOnlySchema,
  type: statementLineTypeSchema,
  referenceNumber: z.string(),
  description: z.string(),
  /** Null on payment and credit-note lines, which have no due date of their own. */
  dueDate: dateOnlySchema.nullable(),
  debitMinor: nonNegativeMinorUnitsSchema,
  creditMinor: nonNegativeMinorUnitsSchema,
  /** Running balance after this line. Negative when the customer is in credit. */
  balanceMinor: minorUnitsSchema,
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
});

export type StatementLineItem = z.infer<typeof statementLineItemSchema>;

/**
 * Ageing buckets in whole days past due, as of a stated date.
 *
 * Each bucket is a sum of whole invoice outstanding amounts — an invoice sits in exactly one bucket,
 * chosen by its own due date. Nothing is apportioned across buckets, so the five values always add
 * up to the outstanding total exactly. See ADR-0024.
 */
export const ageingBucketsSchema = z.object({
  notDueMinor: nonNegativeMinorUnitsSchema,
  days1To30Minor: nonNegativeMinorUnitsSchema,
  days31To60Minor: nonNegativeMinorUnitsSchema,
  days61To90Minor: nonNegativeMinorUnitsSchema,
  daysOver90Minor: nonNegativeMinorUnitsSchema,
});

export type AgeingBuckets = z.infer<typeof ageingBucketsSchema>;

export const emptyAgeingBuckets: AgeingBuckets = {
  notDueMinor: "0",
  days1To30Minor: "0",
  days31To60Minor: "0",
  days61To90Minor: "0",
  daysOver90Minor: "0",
};

export const ageingBucketLabels = {
  notDueMinor: "Not yet due",
  days1To30Minor: "1 - 30 days late",
  days31To60Minor: "31 - 60 days late",
  days61To90Minor: "61 - 90 days late",
  daysOver90Minor: "Over 90 days late",
} as const satisfies Record<keyof AgeingBuckets, string>;

/** One customer's position in the receivables summary. */
export const receivableCustomerSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  outstandingMinor: nonNegativeMinorUnitsSchema,
  overdueMinor: nonNegativeMinorUnitsSchema,
  openInvoiceCount: z.number().int().nonnegative(),
  /** Due date of the oldest unsettled invoice, or null when nothing is outstanding. */
  oldestDueDate: dateOnlySchema.nullable(),
  buckets: ageingBucketsSchema,
});

export type ReceivableCustomer = z.infer<typeof receivableCustomerSchema>;

/**
 * Everything the business is owed, as of a date.
 *
 * `otherCurrencies` names the currencies deliberately left out of the totals. bizOS has no exchange
 * rate source, so documents outside the business base currency are excluded rather than converted
 * at an implied rate (ADR-0024).
 */
export const receivablesSummarySchema = z.object({
  asOf: dateOnlySchema,
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
  totalOutstandingMinor: nonNegativeMinorUnitsSchema,
  totalOverdueMinor: nonNegativeMinorUnitsSchema,
  buckets: ageingBucketsSchema,
  customers: z.array(receivableCustomerSchema),
  otherCurrencies: z.array(currencySchema),
});

export type ReceivablesSummary = z.infer<typeof receivablesSummarySchema>;

export const customerStatementSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
  /** Null when the caller asked for the whole history rather than a period. */
  periodStart: dateOnlySchema.nullable(),
  periodEnd: dateOnlySchema.nullable(),
  /** Closing balance of everything strictly before `periodStart`. Zero when there is no start. */
  openingBalanceMinor: minorUnitsSchema,
  totalInvoicedMinor: nonNegativeMinorUnitsSchema,
  totalPaidMinor: nonNegativeMinorUnitsSchema,
  totalCreditedMinor: nonNegativeMinorUnitsSchema,
  closingBalanceMinor: minorUnitsSchema,
  /** Ageing of what is still outstanding as of `periodEnd`, or as of today when there is none. */
  asOf: dateOnlySchema,
  buckets: ageingBucketsSchema,
  items: z.array(statementLineItemSchema),
  otherCurrencies: z.array(currencySchema),
});

export type CustomerStatement = z.infer<typeof customerStatementSchema>;

export const statementQuerySchema = z
  .object({
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
  })
  .refine(
    (query) => !query.startDate || !query.endDate || query.startDate <= query.endDate,
    "The start date must not be after the end date.",
  );

export type StatementQuery = z.infer<typeof statementQuerySchema>;

export const receivablesQuerySchema = z.object({
  asOf: dateOnlySchema.optional(),
});

export type ReceivablesQuery = z.infer<typeof receivablesQuerySchema>;

/** One supplier's position in the payables summary. */
export const payableSupplierSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  outstandingMinor: nonNegativeMinorUnitsSchema,
  overdueMinor: nonNegativeMinorUnitsSchema,
  openBillCount: z.number().int().nonnegative(),
  /** Due date of the oldest unpaid bill, or null when nothing is outstanding. */
  oldestDueDate: dateOnlySchema.nullable(),
  buckets: ageingBucketsSchema,
});

export type PayableSupplier = z.infer<typeof payableSupplierSchema>;

/**
 * Everything the business owes its suppliers, as of a date.
 *
 * A supplier bill is settled all-or-nothing: bizOS records no outbound payment, so a bill is either
 * APPROVED (fully outstanding) or PAID (fully settled). `partialSettlementSupported` is false and
 * exists so the surface states that limitation rather than implying these totals net part-payments.
 *
 * `otherCurrencies` names the currencies deliberately left out of the totals, for the same reason
 * as receivables: there is no exchange rate source (ADR-0024).
 */
export const payablesSummarySchema = z.object({
  asOf: dateOnlySchema,
  currency: currencySchema,
  currencyScale: currencyScaleSchema,
  totalOutstandingMinor: nonNegativeMinorUnitsSchema,
  totalOverdueMinor: nonNegativeMinorUnitsSchema,
  buckets: ageingBucketsSchema,
  suppliers: z.array(payableSupplierSchema),
  otherCurrencies: z.array(currencySchema),
  partialSettlementSupported: z.literal(false),
});

export type PayablesSummary = z.infer<typeof payablesSummarySchema>;

export const payablesQuerySchema = z.object({
  asOf: dateOnlySchema.optional(),
});

export type PayablesQuery = z.infer<typeof payablesQuerySchema>;
