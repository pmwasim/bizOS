import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const salesOrderStatusSchema = z.enum(["DRAFT", "CONFIRMED", "FULFILLED", "CANCELLED"]);

export const salesOrderStatusLabelByCode = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
} as const satisfies Record<z.infer<typeof salesOrderStatusSchema>, string>;

export function salesOrderStatusLabel(status: z.infer<typeof salesOrderStatusSchema>): string {
  return salesOrderStatusLabelByCode[status];
}

export const salesOrderLineInputSchema = z.strictObject({
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

export const createSalesOrderRequestSchema = z.strictObject({
  customerId: z.uuid(),
  issueDate: z.iso.date().optional(),
  deliveryDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(salesOrderLineInputSchema).min(1).max(50),
});

export const updateSalesOrderRequestSchema = z.strictObject({
  deliveryDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(salesOrderLineInputSchema).min(1).max(50),
});

export const sendSalesOrderRequestSchema = z.strictObject({
  recipientEmail: z.email("Enter a valid email address.").max(320),
  message: z.string().trim().max(2000).nullable(),
});

export const salesOrderLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const salesOrderSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: salesOrderStatusSchema,
  issueDate: z.iso.date(),
  deliveryDate: z.iso.date().nullable(),
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
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    postalCode: z.string().nullable(),
    countryCode: z.string().nullable(),
  }),
  lines: z.array(salesOrderLineSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SalesOrderStatus = z.infer<typeof salesOrderStatusSchema>;
export type SalesOrder = z.infer<typeof salesOrderSchema>;
export type CreateSalesOrderRequest = z.infer<typeof createSalesOrderRequestSchema>;
export type UpdateSalesOrderRequest = z.infer<typeof updateSalesOrderRequestSchema>;
export type SendSalesOrderRequest = z.infer<typeof sendSalesOrderRequestSchema>;
