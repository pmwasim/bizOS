import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateInventoryItemRequest,
  type CreateStockLocationRequest,
  type InventoryItem,
  type RecordStockMovementRequest,
  type StockLocation,
  type StockMovement,
  type StockOnHand,
  type StockReservation,
  type TransferStockRequest,
  type UpdateInventoryItemRequest,
} from "@bizo/contracts/inventory";
import { StockReservationStatus, type Prisma } from "@bizo/database";

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

interface ReservationLine {
  inventoryItemId?: string | undefined;
  quantity: { toString(): string } | number | string;
}

interface StockReservationRecord {
  createdAt: Date;
  document: { publicId: string };
  fulfilledAt: Date | null;
  id: bigint;
  item: { publicId: string; name: string; sku: string };
  location: { publicId: string; code: string; name: string };
  publicId: string;
  quantity: number;
  releasedAt: Date | null;
  status: StockReservationStatus;
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
        const reserved = await this.reservedQuantity(transaction, access, itemId, locationId);
        const available = onHand - reserved;
        if (available < input.quantity) {
          throw new BadRequestException({
            code: "INSUFFICIENT_AVAILABLE_STOCK",
            detail: `Only ${available} unit(s) are available at this location after reservations.`,
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
      const reserved = await this.reservedQuantity(transaction, access, itemId, fromId);
      const available = onHand - reserved;
      if (available < input.quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_AVAILABLE_STOCK",
          detail: `Only ${available} unit(s) are available at the source location after reservations.`,
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

  async atp(
    userPublicId: string,
    businessPublicId: string,
    itemPublicId: string,
    locationPublicId?: string,
  ) {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const itemId = await this.resolveItemId(transaction, access, itemPublicId);
      const locationId = locationPublicId
        ? await this.resolveLocationId(transaction, access, locationPublicId)
        : undefined;
      const quantityOnHand = await this.onHandQuantity(transaction, access, itemId, locationId);
      const reservations = await transaction.stockReservation.findMany({
        where: {
          businessId: access.businessId,
          itemId,
          status: StockReservationStatus.RESERVED,
          ...(locationId !== undefined ? { locationId } : {}),
        },
        select: { quantity: true },
      });
      const reservedQuantity = reservations.reduce(
        (sum: number, row: { quantity: number }) => sum + row.quantity,
        0,
      );
      return {
        itemId: itemPublicId,
        locationId: locationPublicId ?? null,
        quantityOnHand,
        reservedQuantity,
        availableQuantity: quantityOnHand - reservedQuantity,
      };
    });
  }

  /** Hold stock for a document. This method is transaction-scoped so status changes and holds
   * commit together. Lines without an explicit inventory item are non-stock lines. */
  async reserveDocumentStock(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    documentId: bigint,
    lines: ReservationLine[],
    sourceDocumentId?: bigint,
  ): Promise<void> {
    const quantities = new Map<string, number>();
    for (const line of lines) {
      if (!line.inventoryItemId) continue;
      const quantity = Number(line.quantity.toString());
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new BadRequestException({
          code: "INVALID_STOCK_QUANTITY",
          detail: "Stock item quantities must be positive whole units.",
        });
      }
      quantities.set(line.inventoryItemId, (quantities.get(line.inventoryItemId) ?? 0) + quantity);
    }
    if (!quantities.size) return;
    for (const quantity of quantities.values()) {
      if (!Number.isSafeInteger(quantity)) {
        throw new BadRequestException({
          code: "INVALID_STOCK_QUANTITY",
          detail: "The total stock quantity must be a safe whole number.",
        });
      }
    }

    const location = await transaction.stockLocation.findFirst({
      where: { businessId: access.businessId, isDefault: true, isActive: true },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException({
        code: "DEFAULT_STOCK_LOCATION_REQUIRED",
        detail: "Create an active default stock location before reserving inventory.",
      });
    }
    for (const [itemPublicId, quantity] of quantities) {
      const item = await transaction.inventoryItem.findFirst({
        where: { businessId: access.businessId, publicId: itemPublicId },
        select: { id: true, itemType: true },
      });
      if (!item) throw new NotFoundException("We could not find that inventory item.");
      if (item.itemType !== "INVENTORY") continue;

      await this.lockItem(transaction, access.businessId, item.id);
      if (sourceDocumentId) {
        const sourceReservation = await transaction.stockReservation.findFirst({
          where: {
            businessId: access.businessId,
            documentId: sourceDocumentId,
            itemId: item.id,
            locationId: location.id,
            status: StockReservationStatus.RESERVED,
          },
          select: { id: true },
        });
        if (sourceReservation) continue;
      }
      const existing = await transaction.stockReservation.findFirst({
        where: {
          businessId: access.businessId,
          documentId,
          itemId: item.id,
          locationId: location.id,
          status: StockReservationStatus.RESERVED,
        },
      });
      if (existing) continue;

      const held = await transaction.stockReservation.findMany({
        where: {
          businessId: access.businessId,
          itemId: item.id,
          locationId: location.id,
          status: StockReservationStatus.RESERVED,
          documentId: { not: documentId },
        },
        select: { quantity: true },
      });
      const reserved = held.reduce(
        (sum: number, row: { quantity: number }) => sum + row.quantity,
        0,
      );
      const available =
        (await this.onHandQuantity(transaction, access, item.id, location.id)) - reserved;
      if (available < quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_AVAILABLE_STOCK",
          detail: `Only ${available} unit(s) are available to reserve at the default location.`,
        });
      }
      await transaction.stockReservation.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          documentId,
          itemId: item.id,
          locationId: location.id,
          quantity,
          status: StockReservationStatus.RESERVED,
        },
      });
    }
  }

  async releaseDocumentStock(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    documentId: bigint,
  ): Promise<void> {
    await transaction.stockReservation.updateMany({
      where: {
        businessId: access.businessId,
        documentId,
        status: StockReservationStatus.RESERVED,
      },
      data: { status: StockReservationStatus.RELEASED, releasedAt: new Date() },
    });
  }

  async fulfillDocumentStock(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    documentId: bigint,
    referenceId: string,
    requestId: string,
    lines?: ReservationLine[],
    relatedDocumentId?: bigint,
  ): Promise<void> {
    const documentIds = relatedDocumentId ? [documentId, relatedDocumentId] : [documentId];
    const requested = lines
      ? await this.resolveStockQuantities(transaction, access, this.stockQuantities(lines))
      : null;
    const itemIds = requested
      ? [...requested.keys()].map((itemId) => BigInt(itemId))
      : [
          ...new Set(
            (
              (await transaction.stockReservation.findMany({
                where: {
                  businessId: access.businessId,
                  documentId: { in: documentIds },
                  status: StockReservationStatus.RESERVED,
                },
                select: { itemId: true },
              })) as Array<{ itemId: bigint }>
            ).map((reservation) => reservation.itemId),
          ),
        ];
    itemIds.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    for (const itemId of itemIds) {
      await this.lockItem(transaction, access.businessId, itemId);
    }
    // Re-read only after every relevant item lock: concurrent fulfillment cannot dispatch a
    // reservation row that the first transaction has already fulfilled.
    const reservations = await transaction.stockReservation.findMany({
      where: {
        businessId: access.businessId,
        documentId: { in: documentIds },
        status: StockReservationStatus.RESERVED,
      },
    });
    for (const reservation of reservations) {
      const requestedQuantity =
        requested?.get(reservation.itemId.toString()) ?? reservation.quantity;
      if (requested && requestedQuantity === 0) continue;
      if (requestedQuantity > reservation.quantity) {
        throw new BadRequestException({
          code: "FULFILLMENT_EXCEEDS_RESERVATION",
          detail: "Delivered quantity cannot exceed the active stock reservation.",
        });
      }
      const otherReserved = await this.reservedQuantity(
        transaction,
        access,
        reservation.itemId,
        reservation.locationId,
        reservation.id,
      );
      const onHand = await this.onHandQuantity(
        transaction,
        access,
        reservation.itemId,
        reservation.locationId,
      );
      if (onHand - otherReserved < requestedQuantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_STOCK",
          detail: "Stock changed after reservation; fulfillment cannot be completed.",
        });
      }
      await transaction.stockMovement.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          itemId: reservation.itemId,
          locationId: reservation.locationId,
          movementType: "DISPATCH",
          quantity: requestedQuantity,
          referenceType: "SALE",
          referenceId,
          requestId,
          occurredAt: new Date(),
        },
      });
      await transaction.stockReservation.update({
        where: { id: reservation.id },
        data:
          requestedQuantity === reservation.quantity
            ? { status: StockReservationStatus.FULFILLED, fulfilledAt: new Date() }
            : { quantity: reservation.quantity - requestedQuantity },
      });
    }
  }

  private stockQuantities(lines: ReservationLine[]): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const line of lines) {
      if (!line.inventoryItemId) continue;
      const quantity = Number(line.quantity.toString());
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new BadRequestException({
          code: "INVALID_STOCK_QUANTITY",
          detail: "Stock item quantities must be positive whole units.",
        });
      }
      const total = (quantities.get(line.inventoryItemId) ?? 0) + quantity;
      if (!Number.isSafeInteger(total)) {
        throw new BadRequestException({
          code: "INVALID_STOCK_QUANTITY",
          detail: "The total stock quantity must be a safe whole number.",
        });
      }
      quantities.set(line.inventoryItemId, total);
    }
    return quantities;
  }

  private async resolveStockQuantities(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    quantities: Map<string, number>,
  ): Promise<Map<string, number>> {
    const resolved = new Map<string, number>();
    for (const [itemPublicId, quantity] of quantities) {
      const item = await transaction.inventoryItem.findFirst({
        where: { businessId: access.businessId, publicId: itemPublicId },
        select: { id: true },
      });
      if (!item) throw new NotFoundException("We could not find that inventory item.");
      resolved.set(item.id.toString(), quantity);
    }
    return resolved;
  }

  async listReservations(
    userPublicId: string,
    businessPublicId: string,
    documentPublicId?: string,
  ): Promise<StockReservation[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const document = documentPublicId
        ? await transaction.document.findFirst({
            where: { businessId: access.businessId, publicId: documentPublicId },
            select: { id: true },
          })
        : null;
      if (documentPublicId && !document)
        throw new NotFoundException("We could not find that document.");
      const rows = (await transaction.stockReservation.findMany({
        where: {
          businessId: access.businessId,
          ...(document ? { documentId: document.id } : {}),
        },
        include: {
          document: { select: { publicId: true } },
          item: { select: { publicId: true, name: true, sku: true } },
          location: { select: { publicId: true, code: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 500,
      })) as unknown as StockReservationRecord[];
      return rows.map((row) => ({
        id: row.publicId,
        documentId: row.document.publicId,
        itemId: row.item.publicId,
        locationId: row.location.publicId,
        quantity: row.quantity,
        status: row.status,
        releasedAt: row.releasedAt?.toISOString() ?? null,
        fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }));
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

  private async reservedQuantity(
    transaction: Prisma.TransactionClient,
    access: BusinessAccessContext,
    itemId: bigint,
    locationId: bigint,
    excludingReservationId?: bigint,
  ): Promise<number> {
    const rows = await transaction.stockReservation.findMany({
      where: {
        businessId: access.businessId,
        itemId,
        locationId,
        status: StockReservationStatus.RESERVED,
        ...(excludingReservationId ? { id: { not: excludingReservationId } } : {}),
      },
      select: { quantity: true },
    });
    return rows.reduce((sum: number, row: { quantity: number }) => sum + row.quantity, 0);
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
