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

interface InventoryItemRecord {
  costPriceMinor: Prisma.Decimal | null;
  createdAt: Date;
  description: string | null;
  id: bigint;
  isActive: boolean;
  itemType: string;
  name: string;
  publicId: string;
  taxRatePpm: number;
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

    const item = await this.database.withScope(access, async (transaction) => {
      const existing = await transaction.inventoryItem.findFirst({
        where: { businessId: access.businessId, sku: input.sku },
      });
      if (existing) {
        throw new BadRequestException("An item with this SKU already exists.");
      }

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
          taxRatePpm: input.taxRatePpm ?? 0,
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

    return item;
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
        if (duplicate) {
          throw new BadRequestException("An item with this SKU already exists.");
        }
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
          taxRatePpm: input.taxRatePpm ?? existing.taxRatePpm,
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
    if (!record) {
      throw new NotFoundException("We could not find that inventory item.");
    }
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
      taxRatePpm: record.taxRatePpm,
      reorderLevel: record.reorderLevel,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
