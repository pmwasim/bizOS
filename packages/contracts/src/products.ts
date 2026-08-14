import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const productTypeSchema = z.enum(["PRODUCT", "SERVICE"]);

export const createProductRequestSchema = z.strictObject({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  type: productTypeSchema.optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  costPriceMinor: decimalSchema.nullable().optional(),
  sellingPriceMinor: decimalSchema.nullable().optional(),
  taxRatePpm: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
});

export const updateProductRequestSchema = createProductRequestSchema.partial();

export const productSchema = z.strictObject({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: productTypeSchema,
  unit: z.string().nullable(),
  costPriceMinor: z.string().nullable(),
  sellingPriceMinor: z.string().nullable(),
  taxRatePpm: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductType = z.infer<typeof productTypeSchema>;
export type Product = z.infer<typeof productSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
