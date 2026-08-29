import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateInventoryItemRequest,
  type CreateStockLocationRequest,
  type InventoryItem,
  type RecordStockMovementRequest,
  type StockLocation,
  type StockMovement,
  type StockOnHand,
  type TransferStockRequest,
  type UpdateInventoryItemRequest,
} from "@bizo/contracts/inventory";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface StockLocationRecord {
  publicId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StockMovementDbRecord {
  publicId: string;
  movementType: string;
  quantity: number;
  unitCostMinor: Prisma.Decimal;
  referenceType: string | null;
  referenceId: string | null;
  occurredAt: Date;
  createdAt: Date;
  item: { publicId: string };
  location: { publicId: string };
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
  // ── Stock locations ────────────────────────────────────────────────────
  async createLocation(
    userPublicId: string,
    businessPublicId: string,
    input: CreateStockLocationRequest,
    requestId: string,
  ): Promise<StockLocation> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    return this.database.withScope(access, async (transaction) => {
      // At most one default location per business. Serialize concurrent default
      // changes so two requests cannot both clear-and-set and commit two defaults.
      if (input.isDefault) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-default-location:${access.businessId}`}))`;
        await transaction.stockLocation.updateMany({
          where: { businessId: access.businessId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const record = (await transaction.stockLocation.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          code: input.code,
          name: input.name,
          isDefault: input.isDefault ?? false,
        },
      })) as unknown as StockLocationRecord;
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "stock_location.created",
          targetType: "stock_location",
          targetPublicId: record.publicId,
          requestId,
        },
      });
      return this.mapLocation(record);
    });
  }

  async listLocations(userPublicId: string, businessPublicId: string): Promise<StockLocation[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const rows = (await transaction.stockLocation.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      })) as unknown as StockLocationRecord[];
      return rows.map((row) => this.mapLocation(row));
    });
  }

  // ── Movement journal ───────────────────────────────────────────────────
  async recordMovement(
    userPublicId: string,
    businessPublicId: string,
    input: RecordStockMovementRequest,
    requestId: string,
  ): Promise<StockMovement> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const itemId = await this.resolveItemId(transaction, access, input.itemId);
      const locationId = await this.resolveLocationId(transaction, access, input.locationId);

      // Serialize all concurrent stock mutations for this item so two dispatches
      // cannot both read the same on-hand and each pass the guard (which would
      // drive the committed ledger negative). Released on commit/rollback.
      await this.lockItem(transaction, access.businessId, itemId);

      // Idempotency: a retried command (same x-request-id) must not double-post.
      const existing = await this.findMovementByRequest(transaction, access, requestId, locationId);
      if (existing) {
        return this.mapMovement(existing);
      }

      // A DISPATCH must never drive on-hand negative at its location.
      if (input.movementType === "DISPATCH") {
        const onHand = await this.onHandQuantity(transaction, access, itemId, locationId);
        if (onHand < input.quantity) {
          throw new BadRequestException({
            code: "INSUFFICIENT_STOCK",
            detail: `Only ${onHand} unit(s) on hand at this location.`,
          });
        }
      }

      const record = (await transaction.stockMovement.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          itemId,
          locationId,
          movementType: input.movementType,
          quantity: input.quantity,
          unitCostMinor: input.unitCostMinor ?? "0",
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          requestId,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        },
        include: this.movementInclude(),
      })) as unknown as StockMovementDbRecord;
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "stock_movement.recorded",
          targetType: "stock_movement",
          targetPublicId: record.publicId,
          requestId,
        },
      });
      return this.mapMovement(record);
    });
  }

  async transferStock(
    userPublicId: string,
    businessPublicId: string,
    input: TransferStockRequest,
    requestId: string,
  ): Promise<{ from: StockMovement; to: StockMovement }> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    if (input.fromLocationId === input.toLocationId) {
      throw new BadRequestException({
        code: "SAME_LOCATION_TRANSFER",
        detail: "The source and destination locations must differ.",
      });
    }
    return this.database.withScope(access, async (transaction) => {
      const itemId = await this.resolveItemId(transaction, access, input.itemId);
      const fromId = await this.resolveLocationId(transaction, access, input.fromLocationId);
      const toId = await this.resolveLocationId(transaction, access, input.toLocationId);

      // Serialize concurrent mutations for this item, then dedup a retried
      // transfer (same x-request-id) by returning the pair it already wrote.
      await this.lockItem(transaction, access.businessId, itemId);
      const priorFrom = await this.findMovementByRequest(transaction, access, requestId, fromId);
      const priorTo = await this.findMovementByRequest(transaction, access, requestId, toId);
      if (priorFrom && priorTo) {
        return { from: this.mapMovement(priorFrom), to: this.mapMovement(priorTo) };
      }

      const onHand = await this.onHandQuantity(transaction, access, itemId, fromId);
      if (onHand < input.quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_STOCK",
          detail: `Only ${onHand} unit(s) on hand at the source location.`,
        });
      }

      // A transfer is two TRANSFER rows carrying a signed quantity: it leaves
      // the source (−q) and arrives at the destination (+q), so on-hand nets out.
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
      const unitCostMinor = input.unitCostMinor ?? "0";
      const base = {
        tenantId: access.tenantId,
        businessId: access.businessId,
        itemId,
        movementType: "TRANSFER" as const,
        unitCostMinor,
        referenceType: "MANUAL",
        requestId,
        occurredAt,
      };
      const fromRow = (await transaction.stockMovement.create({
        data: { ...base, locationId: fromId, quantity: -input.quantity },
        include: this.movementInclude(),
      })) as unknown as StockMovementDbRecord;
      const toRow = (await transaction.stockMovement.create({
        data: { ...base, locationId: toId, quantity: input.quantity },
        include: this.movementInclude(),
      })) as unknown as StockMovementDbRecord;
      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "stock.transferred",
          targetType: "inventory_item",
          targetPublicId: input.itemId,
          requestId,
        },
      });
      return { from: this.mapMovement(fromRow), to: this.mapMovement(toRow) };
    });
  }

  async listMovements(
    userPublicId: string,
    businessPublicId: string,
    filter: { itemPublicId?: string; locationPublicId?: string },
  ): Promise<StockMovement[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const where: Prisma.StockMovementWhereInput = { businessId: access.businessId };
      if (filter.itemPublicId) {
        where.itemId = await this.resolveItemId(transaction, access, filter.itemPublicId);
      }
      if (filter.locationPublicId) {
        where.locationId = await this.resolveLocationId(
          transaction,
          access,
          filter.locationPublicId,
        );
      }
      const rows = (await transaction.stockMovement.findMany({
        where,
        include: this.movementInclude(),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 500,
      })) as unknown as StockMovementDbRecord[];
      return rows.map((row) => this.mapMovement(row));
    });
  }

  async onHand(
    userPublicId: string,
    businessPublicId: string,
    itemPublicId: string,
    locationPublicId?: string,
  ): Promise<StockOnHand> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const itemId = await this.resolveItemId(transaction, access, itemPublicId);
      const locationId = locationPublicId
        ? await this.resolveLocationId(transaction, access, locationPublicId)
        : undefined;
      const quantityOnHand = await this.onHandQuantity(transaction, access, itemId, locationId);
      return { itemId: itemPublicId, locationId: locationPublicId ?? null, quantityOnHand };
    });
  }

  private async onHandQuantity(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    itemId: bigint,
    locationId?: bigint,
  ): Promise<number> {
    const rows = (await transaction.stockMovement.findMany({
      where: {
        businessId: access.businessId,
        itemId,
        ...(locationId !== undefined ? { locationId } : {}),
      },
      select: { movementType: true, quantity: true },
    })) as Array<{ movementType: string; quantity: number }>;
    let quantity = 0;
    for (const movement of rows) {
      if (movement.movementType === "RECEIPT") quantity += movement.quantity;
      else if (movement.movementType === "DISPATCH") quantity -= movement.quantity;
      // ADJUSTMENT and TRANSFER rows carry a signed quantity.
      else quantity += movement.quantity;
    }
    return quantity;
  }

  private async resolveItemId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    publicId: string,
  ): Promise<bigint> {
    const item = await transaction.inventoryItem.findFirst({
      where: { businessId: access.businessId, publicId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException("We could not find that inventory item.");
    return item.id;
  }

  private async resolveLocationId(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    publicId: string,
  ): Promise<bigint> {
    const location = await transaction.stockLocation.findFirst({
      where: { businessId: access.businessId, publicId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException("We could not find that stock location.");
    return location.id;
  }

  // Transaction-scoped advisory lock serializing all stock mutations for one
  // item within a business (released on commit/rollback), matching the pattern
  // used by payments/quotations for concurrency-sensitive writes.
  private async lockItem(
    transaction: Prisma.TransactionClient,
    businessId: bigint,
    itemId: bigint,
  ): Promise<void> {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-mutate:${businessId}:${itemId}`}))`;
  }

  private async findMovementByRequest(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    requestId: string,
    locationId: bigint,
  ): Promise<StockMovementDbRecord | null> {
    return (await transaction.stockMovement.findFirst({
      where: { businessId: access.businessId, requestId, locationId },
      include: this.movementInclude(),
    })) as unknown as StockMovementDbRecord | null;
  }

  private movementInclude() {
    return {
      item: { select: { publicId: true } },
      location: { select: { publicId: true } },
    } satisfies Prisma.StockMovementInclude;
  }

  private mapLocation(record: StockLocationRecord): StockLocation {
    return {
      id: record.publicId,
      code: record.code,
      name: record.name,
      isDefault: record.isDefault,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapMovement(record: StockMovementDbRecord): StockMovement {
    return {
      id: record.publicId,
      itemId: record.item.publicId,
      locationId: record.location.publicId,
      movementType: record.movementType as StockMovement["movementType"],
      quantity: record.quantity,
      unitCostMinor: record.unitCostMinor.toFixed(0),
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      occurredAt: record.occurredAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
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
