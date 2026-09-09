import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const quotationLineInputSchema = z.strictObject({
  inventoryItemId: z.uuid().optional(),
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

export const saveQuotationRequestSchema = z.strictObject({
  customerId: z.uuid(),
  issueDate: z.iso.date().optional(),
  validUntil: z.iso.date().optional(),
  lines: z.array(quotationLineInputSchema).min(1).max(50),
});

export const sendQuotationRequestSchema = z.strictObject({
  recipientEmail: z.email("Enter a valid email address.").max(320),
  message: z.string().trim().max(2000).nullable(),
});

export const quotationLineSchema = z.strictObject({
  inventoryItemId: z.uuid().optional(),
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const quotationSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(["DRAFT", "SENT"]),
  issueDate: z.iso.date(),
  validUntil: z.iso.date(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
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
  lines: z.array(quotationLineSchema),
  sentAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const quotationDeliveryResultSchema = z.strictObject({
  quotation: quotationSchema,
  delivery: z.strictObject({
    id: z.uuid(),
    // SENT: this call dispatched the email. ALREADY_SENT: an identical send had already been
    // delivered, so the idempotent send path reported the earlier delivery and put nothing new on
    // the wire.
    status: z.enum(["SENT", "ALREADY_SENT"]),
    recipientEmail: z.email(),
    sentAt: z.iso.datetime(),
  }),
});

export type Quotation = z.infer<typeof quotationSchema>;
export type SaveQuotationRequest = z.infer<typeof saveQuotationRequestSchema>;
export type SendQuotationRequest = z.infer<typeof sendQuotationRequestSchema>;
