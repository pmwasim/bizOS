import { z } from "zod";

const decimalSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const inventoryItemStatusSchema = z.enum(["INVENTORY", "SERVICE", "NON_INVENTORY"]);

export const createInventoryItemRequestSchema = z.strictObject({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  itemType: inventoryItemStatusSchema.optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  costPriceMinor: decimalSchema.nullable().optional(),
  sellingPriceMinor: decimalSchema.nullable().optional(),
  taxRatePpm: z.number().int().min(0).max(1_000_000).optional(),
  reorderLevel: z.number().int().min(0).nullable().optional(),
});

export const updateInventoryItemRequestSchema = createInventoryItemRequestSchema.partial();

export const inventoryItemSchema = z.strictObject({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemType: inventoryItemStatusSchema,
  unit: z.string().nullable(),
  costPriceMinor: z.string().nullable(),
  sellingPriceMinor: z.string().nullable(),
  taxRatePpm: z.number().int(),
  reorderLevel: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type InventoryItemType = z.infer<typeof inventoryItemStatusSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type CreateInventoryItemRequest = z.infer<typeof createInventoryItemRequestSchema>;
export type UpdateInventoryItemRequest = z.infer<typeof updateInventoryItemRequestSchema>;
