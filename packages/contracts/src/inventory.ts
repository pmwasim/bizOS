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

// ── Multi-location stock: locations, movement journal, on-hand ───────────────

// Integer minor units (whole cents); costs never carry a fractional minor part.
const minorUnitSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)$/);

export const stockMovementTypeSchema = z.enum(["RECEIPT", "DISPATCH", "TRANSFER", "ADJUSTMENT"]);

export const createStockLocationRequestSchema = z.strictObject({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
});

export const stockLocationSchema = z.strictObject({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// Users record RECEIPT/DISPATCH/ADJUSTMENT directly; TRANSFER rows are written
// as a pair by the transfer endpoint, never posted individually.
export const recordStockMovementRequestSchema = z
  .strictObject({
    itemId: z.uuid(),
    locationId: z.uuid(),
    movementType: z.enum(["RECEIPT", "DISPATCH", "ADJUSTMENT"]),
    quantity: z.number().int(),
    unitCostMinor: minorUnitSchema.optional(),
    referenceType: z.enum(["GRN", "MANUAL", "SALE", "SO"]).nullable().optional(),
    referenceId: z.string().trim().max(64).nullable().optional(),
    occurredAt: z.iso.datetime().optional(),
  })
  .refine((v) => v.quantity !== 0, { message: "Quantity must not be zero." })
  .refine((v) => v.movementType === "ADJUSTMENT" || v.quantity > 0, {
    message: "RECEIPT and DISPATCH quantities must be positive.",
  });

export const transferStockRequestSchema = z.strictObject({
  itemId: z.uuid(),
  fromLocationId: z.uuid(),
  toLocationId: z.uuid(),
  quantity: z.number().int().positive(),
  unitCostMinor: minorUnitSchema.optional(),
  occurredAt: z.iso.datetime().optional(),
});

export const stockMovementSchema = z.strictObject({
  id: z.uuid(),
  itemId: z.uuid(),
  locationId: z.uuid(),
  movementType: stockMovementTypeSchema,
  quantity: z.number().int(),
  unitCostMinor: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const stockOnHandSchema = z.strictObject({
  itemId: z.uuid(),
  locationId: z.uuid().nullable(),
  quantityOnHand: z.number().int(),
});

export const stockAtpSchema = z.strictObject({
  itemId: z.uuid(),
  locationId: z.uuid().nullable(),
  quantityOnHand: z.number().int(),
  reservedQuantity: z.number().int().nonnegative(),
  availableQuantity: z.number().int(),
});

export const stockReservationStatusSchema = z.enum(["RESERVED", "RELEASED", "FULFILLED"]);
export const stockReservationSchema = z.strictObject({
  id: z.uuid(),
  documentId: z.uuid(),
  itemId: z.uuid(),
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
  status: stockReservationStatusSchema,
  releasedAt: z.iso.datetime().nullable(),
  fulfilledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const stockReservationQuerySchema = z.strictObject({
  documentId: z.uuid().optional(),
});

// Query for GET .../stock/on-hand: itemId is required and must be a UUID, so a
// missing/malformed value fails closed with a 400 instead of reaching Prisma.
export const stockOnHandQuerySchema = z.strictObject({
  itemId: z.uuid(),
  locationId: z.uuid().optional(),
});

export type InventoryItemType = z.infer<typeof inventoryItemStatusSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type CreateInventoryItemRequest = z.infer<typeof createInventoryItemRequestSchema>;
export type UpdateInventoryItemRequest = z.infer<typeof updateInventoryItemRequestSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type CreateStockLocationRequest = z.infer<typeof createStockLocationRequestSchema>;
export type StockLocation = z.infer<typeof stockLocationSchema>;
export type RecordStockMovementRequest = z.infer<typeof recordStockMovementRequestSchema>;
export type TransferStockRequest = z.infer<typeof transferStockRequestSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type StockOnHand = z.infer<typeof stockOnHandSchema>;
export type StockAtp = z.infer<typeof stockAtpSchema>;
export type StockOnHandQuery = z.infer<typeof stockOnHandQuerySchema>;
export type StockReservation = z.infer<typeof stockReservationSchema>;
export type StockReservationQuery = z.infer<typeof stockReservationQuerySchema>;
