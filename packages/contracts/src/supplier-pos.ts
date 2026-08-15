import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const supplierPoStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const supplierPoLineInputSchema = z.strictObject({
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

export const createSupplierPoRequestSchema = z.strictObject({
  supplierId: z.uuid(),
  issueDate: z.iso.date().optional(),
  expectedReceiveDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(supplierPoLineInputSchema).min(1).max(50),
});

export const updateSupplierPoRequestSchema = z.strictObject({
  expectedReceiveDate: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(supplierPoLineInputSchema).min(1).max(50),
});

export const supplierPoLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  receivedQuantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const supplierPoSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: supplierPoStatusSchema,
  issueDate: z.iso.date(),
  expectedReceiveDate: z.iso.date().nullable(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  currencyScale: z.number().int().min(0).max(4),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
  notes: z.string().nullable(),
  supplier: z.strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.email().nullable(),
    phone: z.string().nullable(),
  }),
  lines: z.array(supplierPoLineSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SupplierPoStatus = z.infer<typeof supplierPoStatusSchema>;
export type SupplierPo = z.infer<typeof supplierPoSchema>;
export type CreateSupplierPoRequest = z.infer<typeof createSupplierPoRequestSchema>;
export type UpdateSupplierPoRequest = z.infer<typeof updateSupplierPoRequestSchema>;
