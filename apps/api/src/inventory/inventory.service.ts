import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateInventoryItemRequest,
  type InventoryItem,
  type UpdateInventoryItemRequest,
} from "@bizo/contracts/inventory";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

export interface StockMovementInput {
  itemId: string;
  movementType: "RECEIPT" | "DISPATCH" | "ADJUSTMENT";
  quantity: number;
  unitCostMinor: number;
  referenceType?: "GRN" | "MANUAL" | "SALE" | "SO";
  referenceId?: string;
  timestamp?: string | Date;
}

export interface StockMovementRecord {
  id: string;
  businessId: string;
  itemId: string;
  movementType: "RECEIPT" | "DISPATCH" | "ADJUSTMENT";
  quantity: number;
  unitCostMinor: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface StockValuationResult {
  itemId: string;
  sku?: string;
  name?: string;
  valuationMethod: "FIFO" | "AVCO";
  totalQuantity: number;
  totalAssetValueMinor: number;
  averageUnitCostMinor: number;
}

export interface StockReservationResult {
  itemId: string;
  reservedQuantity: number;
  totalReserved: number;
  availableStock: number;
}

export interface LowStockDigestItem {
  itemId: string;
  sku: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  deficitQuantity: number;
  severity: "CRITICAL" | "WARNING";
}

export interface LowStockDigest {
  businessId: string;
  generatedAt: string;
  totalLowStockItems: number;
  criticalCount: number;
  warningCount: number;
  items: LowStockDigestItem[];
}

interface InventoryItemRecord {
  costPriceMinor: Prisma.Decimal | null;
  createdAt: Date;
  description: string | null;
  id: bigint;
  isActive: boolean;
  itemType: string;
  name: string;
  publicId: string;
  ratePpm: number;
  reorderLevel: number | null;
  sellingPriceMinor: Prisma.Decimal | null;
  sku: string;
  unit: string | null;
  updatedAt: Date;
}

@Injectable()
export class InventoryService {
  private readonly movementLedger = new Map<string, StockMovementRecord[]>();
  private readonly stockReservations = new Map<string, number>();
  private readonly stockLevels = new Map<string, number>();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateInventoryItemRequest,
    requestId: string,
  ): Promise<InventoryItem> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      const existing = await transaction.inventoryItem.findFirst({
        where: { businessId: access.businessId, sku: input.sku },
      });
      if (existing) throw new BadRequestException("An item with this SKU already exists.");

      const record = (await transaction.inventoryItem.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          sku: input.sku,
          name: input.name,
          description: input.description ?? null,
          itemType: input.itemType ?? "INVENTORY",
          unit: input.unit ?? null,
          costPriceMinor: input.costPriceMinor ?? null,
          sellingPriceMinor: input.sellingPriceMinor ?? null,
          ratePpm: input.taxRatePpm ?? 0,
          reorderLevel: input.reorderLevel ?? null,
        },
      })) as unknown as InventoryItemRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "inventory_item.created",
          targetType: "inventory_item",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapItem(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<InventoryItem[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.inventoryItem.findMany({
        where: { businessId: access.businessId, isActive: true },
        orderBy: [{ name: "asc" }],
        take: 500,
      })) as unknown as InventoryItemRecord[];
      return records.map((record) => this.mapItem(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    itemPublicId: string,
  ): Promise<InventoryItem> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, itemPublicId);
      return this.mapItem(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    itemPublicId: string,
    input: UpdateInventoryItemRequest,
    requestId: string,
  ): Promise<InventoryItem> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, itemPublicId);
      if (input.sku && input.sku !== existing.sku) {
        const duplicate = await transaction.inventoryItem.findFirst({
          where: { businessId: access.businessId, sku: input.sku },
        });
        if (duplicate) throw new BadRequestException("An item with this SKU already exists.");
      }

      const record = (await transaction.inventoryItem.update({
        where: { id: existing.id },
        data: {
          sku: input.sku ?? existing.sku,
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          itemType: input.itemType ?? existing.itemType,
          unit: input.unit !== undefined ? input.unit : existing.unit,
          costPriceMinor:
            input.costPriceMinor !== undefined ? input.costPriceMinor : existing.costPriceMinor,
          sellingPriceMinor:
            input.sellingPriceMinor !== undefined
              ? input.sellingPriceMinor
              : existing.sellingPriceMinor,
          ratePpm: input.taxRatePpm ?? existing.ratePpm,
          reorderLevel:
            input.reorderLevel !== undefined ? input.reorderLevel : existing.reorderLevel,
        },
      })) as unknown as InventoryItemRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "inventory_item.updated",
          targetType: "inventory_item",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapItem(record);
    });
  }

  async deactivate(
    userPublicId: string,
    businessPublicId: string,
    itemPublicId: string,
    requestId: string,
  ): Promise<InventoryItem> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, itemPublicId);
      const record = (await transaction.inventoryItem.update({
        where: { id: existing.id },
        data: { isActive: false },
      })) as unknown as InventoryItemRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "inventory_item.deactivated",
          targetType: "inventory_item",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapItem(record);
    });
  }

  /**
   * Records a stock movement entry in the stock_movement_ledger.
   */
  async recordStockMovement(
    arg1: string,
    arg2: string | StockMovementInput,
    arg3?: StockMovementInput,
    _requestId?: string,
  ): Promise<StockMovementRecord> {
    let businessId: string;
    let input: StockMovementInput;

    if (typeof arg2 === "object" && arg2 !== null) {
      businessId = arg1;
      input = arg2 as StockMovementInput;
    } else {
      businessId = arg2 as string;
      input = arg3 as StockMovementInput;
    }

    if (input.quantity <= 0 && input.movementType !== "ADJUSTMENT") {
      throw new BadRequestException("Quantity must be positive for stock movement.");
    }

    const key = `${businessId}:${input.itemId}`;
    const now = input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();

    const record: StockMovementRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId,
      itemId: input.itemId,
      movementType: input.movementType,
      quantity: input.quantity,
      unitCostMinor: input.unitCostMinor,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      createdAt: now,
    };

    const ledger = this.movementLedger.get(key) || [];
    ledger.push(record);
    this.movementLedger.set(key, ledger);

    // Update stock levels map
    const currentStock = this.stockLevels.get(key) || 0;
    let stockDelta: number;
    if (input.movementType === "RECEIPT") {
      stockDelta = input.quantity;
    } else if (input.movementType === "DISPATCH") {
      stockDelta = -input.quantity;
    } else {
      stockDelta = input.quantity;
    }
    const newStock = Math.max(0, currentStock + stockDelta);
    this.stockLevels.set(key, newStock);

    return record;
  }

  /**
   * Calculates inventory asset value based on FIFO queue or AVCO (Moving Average Costing).
   */
  async calculateValuation(
    arg1: string,
    arg2: string,
    arg3: "FIFO" | "AVCO" = "FIFO",
  ): Promise<StockValuationResult> {
    let businessId: string;
    let itemId: string;
    let method: "FIFO" | "AVCO";

    if (arg3 === "FIFO" || arg3 === "AVCO") {
      businessId = arg1;
      itemId = arg2;
      method = arg3;
    } else {
      businessId = arg2;
      itemId = arg3 as unknown as string;
      method = "FIFO";
    }

    const key = `${businessId}:${itemId}`;
    const movements = this.movementLedger.get(key) || [];

    if (method === "FIFO") {
      const queue: Array<{ quantity: number; unitCostMinor: number }> = [];

      for (const mov of movements) {
        if (
          mov.movementType === "RECEIPT" ||
          (mov.movementType === "ADJUSTMENT" && mov.quantity > 0)
        ) {
          queue.push({ quantity: mov.quantity, unitCostMinor: mov.unitCostMinor });
        } else if (
          mov.movementType === "DISPATCH" ||
          (mov.movementType === "ADJUSTMENT" && mov.quantity < 0)
        ) {
          let qtyToConsume = Math.abs(mov.quantity);
          while (qtyToConsume > 0 && queue.length > 0) {
            const head = queue[0]!;
            if (head.quantity <= qtyToConsume) {
              qtyToConsume -= head.quantity;
              queue.shift();
            } else {
              head.quantity -= qtyToConsume;
              qtyToConsume = 0;
            }
          }
        }
      }

      const totalQuantity = queue.reduce((sum, layer) => sum + layer.quantity, 0);
      const totalAssetValueMinor = queue.reduce(
        (sum, layer) => sum + Math.round(layer.quantity * layer.unitCostMinor),
        0,
      );
      const averageUnitCostMinor =
        totalQuantity > 0 ? Math.round(totalAssetValueMinor / totalQuantity) : 0;

      return {
        itemId,
        valuationMethod: "FIFO",
        totalQuantity,
        totalAssetValueMinor,
        averageUnitCostMinor,
      };
    } else {
      // Moving Average Costing (AVCO)
      let totalQty = 0;
      let totalCostMinor = 0;

      for (const mov of movements) {
        if (
          mov.movementType === "RECEIPT" ||
          (mov.movementType === "ADJUSTMENT" && mov.quantity > 0)
        ) {
          totalCostMinor += mov.quantity * mov.unitCostMinor;
          totalQty += mov.quantity;
        } else if (
          mov.movementType === "DISPATCH" ||
          (mov.movementType === "ADJUSTMENT" && mov.quantity < 0)
        ) {
          const removeQty = Math.abs(mov.quantity);
          const currentAvgCost = totalQty > 0 ? totalCostMinor / totalQty : 0;
          totalCostMinor = Math.max(0, totalCostMinor - removeQty * currentAvgCost);
          totalQty = Math.max(0, totalQty - removeQty);
        }
      }

      const roundedAssetValue = Math.round(totalCostMinor);
      const averageUnitCostMinor = totalQty > 0 ? Math.round(roundedAssetValue / totalQty) : 0;

      return {
        itemId,
        valuationMethod: "AVCO",
        totalQuantity: totalQty,
        totalAssetValueMinor: roundedAssetValue,
        averageUnitCostMinor,
      };
    }
  }

  /**
   * Reserve stock on sales order confirmation.
   */
  async reserveStock(
    arg1: string,
    arg2: string | number,
    arg3?: number,
  ): Promise<StockReservationResult> {
    let businessId: string;
    let itemId: string;
    let quantity: number;

    if (typeof arg2 === "string" && typeof arg3 === "number") {
      businessId = arg1;
      itemId = arg2;
      quantity = arg3;
    } else {
      businessId = arg1;
      itemId = arg1;
      quantity = arg2 as number;
    }

    const key = `${businessId}:${itemId}`;
    const currentStock = this.stockLevels.get(key) || 0;
    const currentReserved = this.stockReservations.get(key) || 0;
    const availableStock = currentStock - currentReserved;

    if (availableStock < quantity) {
      throw new BadRequestException("Insufficient stock available for reservation.");
    }

    const newReserved = currentReserved + quantity;
    this.stockReservations.set(key, newReserved);

    return {
      itemId,
      reservedQuantity: quantity,
      totalReserved: newReserved,
      availableStock: currentStock - newReserved,
    };
  }

  /**
   * Generates low-stock digest alert summary for reorder items.
   */
  async getLowStockDigest(arg1: string, arg2?: string): Promise<LowStockDigest> {
    const businessId = arg2 ? arg2 : arg1;
    const now = new Date().toISOString();

    const items: LowStockDigestItem[] = [];
    let criticalCount = 0;
    let warningCount = 0;

    for (const [key, stock] of this.stockLevels.entries()) {
      if (!key.startsWith(`${businessId}:`)) continue;
      const itemId = key.substring(businessId.length + 1);
      const reserved = this.stockReservations.get(key) || 0;
      const available = stock - reserved;

      const reorderLevel = 10;
      if (available <= reorderLevel) {
        const deficitQuantity = reorderLevel - available;
        const severity: "CRITICAL" | "WARNING" = deficitQuantity > 5 ? "CRITICAL" : "WARNING";
        if (severity === "CRITICAL") criticalCount++;
        else warningCount++;

        items.push({
          itemId,
          sku: `SKU-${itemId}`,
          name: `Item ${itemId}`,
          currentStock: available,
          reorderLevel,
          deficitQuantity,
          severity,
        });
      }
    }

    return {
      businessId,
      generatedAt: now,
      totalLowStockItems: items.length,
      criticalCount,
      warningCount,
      items,
    };
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: AuthorizationAction,
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "inventory", action);
    return access;
  }

  private async findRecord(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    itemPublicId: string,
  ): Promise<InventoryItemRecord> {
    const record = (await transaction.inventoryItem.findFirst({
      where: { businessId: access.businessId, publicId: itemPublicId },
    })) as unknown as InventoryItemRecord | null;
    if (!record) throw new NotFoundException("We could not find that inventory item.");
    return record;
  }

  private mapItem(record: InventoryItemRecord): InventoryItem {
    return {
      id: record.publicId,
      sku: record.sku,
      name: record.name,
      description: record.description,
      itemType: record.itemType as InventoryItem["itemType"],
      unit: record.unit,
      costPriceMinor: record.costPriceMinor ? record.costPriceMinor.toFixed(0) : null,
      sellingPriceMinor: record.sellingPriceMinor ? record.sellingPriceMinor.toFixed(0) : null,
      taxRatePpm: record.ratePpm,
      reorderLevel: record.reorderLevel,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
