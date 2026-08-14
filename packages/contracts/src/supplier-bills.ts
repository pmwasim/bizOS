import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
const percentageSchema = z
  .string()
  .trim()
  .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/);

export const supplierBillStatusSchema = z.enum(["DRAFT", "APPROVED", "PAID", "CANCELLED"]);

export const supplierBillLineInputSchema = z.strictObject({
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

export const createSupplierBillRequestSchema = z.strictObject({
  supplierId: z.uuid(),
  supplierPoId: z.uuid().optional(),
  billNumber: z.string().trim().min(1).max(80),
  billDate: z.iso.date(),
  dueDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(supplierBillLineInputSchema).min(1).max(50),
});

export const supplierBillLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
  unitPriceMinor: z.string(),
  taxRatePpm: z.number().int().min(0).max(1_000_000),
  subtotalMinor: z.string(),
  taxMinor: z.string(),
  totalMinor: z.string(),
});

export const supplierBillSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  billNumber: z.string(),
  status: supplierBillStatusSchema,
  billDate: z.iso.date(),
  dueDate: z.iso.date().nullable(),
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
  supplierPo: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  matchStatus: z.enum(["MATCHED", "VARIANCE", "NO_PO"]),
  lines: z.array(supplierBillLineSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const goodsReceiptNoteStatusSchema = z.enum(["DRAFT", "RECEIVED", "CANCELLED"]);

export const grnLineInputSchema = z.strictObject({
  description: z.string().trim().min(1).max(500),
  quantity: decimalSchema
    .refine((value) => !/^0(?:\.0+)?$/.test(value), "Quantity must be greater than zero.")
    .refine(
      (value) => !value.includes(".") || value.split(".")[1]!.length <= 6,
      "Use no more than 6 decimal places.",
    ),
});

export const createGrnRequestSchema = z.strictObject({
  supplierId: z.uuid(),
  supplierPoId: z.uuid().optional(),
  receiveDate: z.iso.date().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(grnLineInputSchema).min(1).max(50),
});

export const grnLineSchema = z.strictObject({
  position: z.number().int().positive(),
  description: z.string(),
  quantity: z.string(),
});

export const grnSchema = z.strictObject({
  id: z.uuid(),
  number: z.string(),
  status: goodsReceiptNoteStatusSchema,
  receiveDate: z.iso.date().nullable(),
  notes: z.string().nullable(),
  supplier: z.strictObject({
    id: z.uuid(),
    name: z.string(),
  }),
  supplierPo: z
    .strictObject({
      id: z.uuid(),
      number: z.string(),
    })
    .nullable(),
  lines: z.array(grnLineSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SupplierBillStatus = z.infer<typeof supplierBillStatusSchema>;
export type SupplierBill = z.infer<typeof supplierBillSchema>;
export type CreateSupplierBillRequest = z.infer<typeof createSupplierBillRequestSchema>;
export type GoodsReceiptNoteStatus = z.infer<typeof goodsReceiptNoteStatusSchema>;
export type GoodsReceiptNote = z.infer<typeof grnSchema>;
export type CreateGrnRequest = z.infer<typeof createGrnRequestSchema>;
