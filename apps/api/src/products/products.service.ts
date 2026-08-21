import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateProductRequest,
  type Product,
  type UpdateProductRequest,
} from "@bizo/contracts/products";
import { type Prisma } from "@bizo/database";

import { DatabaseService } from "../database/database.service";
import {
  type AuthorizationAction,
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service";

interface ProductRecord {
  id: bigint;
  publicId: string;
  sku: string;
  name: string;
  description: string | null;
  type: string;
  unit: string | null;
  costPriceMinor: { toFixed: (n: number) => string } | null;
  sellingPriceMinor: { toFixed: (n: number) => string } | null;
  taxRatePpm: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateProductRequest,
    requestId: string,
  ): Promise<Product> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");

    return this.database.withScope(access, async (transaction) => {
      const existing = await transaction.product.findFirst({
        where: { businessId: access.businessId, sku: input.sku },
      });
      if (existing) throw new BadRequestException("A product with this SKU already exists.");

      const record = (await transaction.product.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          sku: input.sku,
          name: input.name,
          description: input.description ?? null,
          type: input.type ?? "PRODUCT",
          unit: input.unit ?? null,
          costPriceMinor: input.costPriceMinor ?? null,
          sellingPriceMinor: input.sellingPriceMinor ?? null,
          taxRatePpm: input.taxRatePpm ?? 0,
          isActive: input.isActive ?? true,
        },
      })) as unknown as ProductRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "product.created",
          targetType: "product",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapProduct(record);
    });
  }

  async list(userPublicId: string, businessPublicId: string): Promise<Product[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const records = (await transaction.product.findMany({
        where: { businessId: access.businessId },
        orderBy: [{ name: "asc" }],
        take: 500,
      })) as unknown as ProductRecord[];
      return records.map((record) => this.mapProduct(record));
    });
  }

  async get(
    userPublicId: string,
    businessPublicId: string,
    productPublicId: string,
  ): Promise<Product> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    return this.database.withScope(access, async (transaction) => {
      const record = await this.findRecord(transaction, access, productPublicId);
      return this.mapProduct(record);
    });
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    productPublicId: string,
    input: UpdateProductRequest,
    requestId: string,
  ): Promise<Product> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, productPublicId);

      if (input.sku && input.sku !== existing.sku) {
        const duplicate = await transaction.product.findFirst({
          where: { businessId: access.businessId, sku: input.sku },
        });
        if (duplicate) throw new BadRequestException("A product with this SKU already exists.");
      }

      const record = (await transaction.product.update({
        where: { id: existing.id },
        data: {
          sku: input.sku ?? existing.sku,
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          type: input.type ?? existing.type,
          unit: input.unit !== undefined ? input.unit : existing.unit,
          costPriceMinor:
            input.costPriceMinor !== undefined ? input.costPriceMinor : existing.costPriceMinor,
          sellingPriceMinor:
            input.sellingPriceMinor !== undefined
              ? input.sellingPriceMinor
              : existing.sellingPriceMinor,
          taxRatePpm: input.taxRatePpm ?? existing.taxRatePpm,
          isActive: input.isActive ?? existing.isActive,
        },
      })) as unknown as ProductRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "product.updated",
          targetType: "product",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapProduct(record);
    });
  }

  async deactivate(
    userPublicId: string,
    businessPublicId: string,
    productPublicId: string,
    requestId: string,
  ): Promise<Product> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    return this.database.withScope(access, async (transaction) => {
      const existing = await this.findRecord(transaction, access, productPublicId);

      const record = (await transaction.product.update({
        where: { id: existing.id },
        data: { isActive: false },
      })) as unknown as ProductRecord;

      await transaction.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          businessId: access.businessId,
          actorUserId: access.userId,
          action: "product.deactivated",
          targetType: "product",
          targetPublicId: record.publicId,
          requestId,
        },
      });

      return this.mapProduct(record);
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
    productPublicId: string,
  ): Promise<ProductRecord> {
    const record = (await transaction.product.findFirst({
      where: { businessId: access.businessId, publicId: productPublicId },
    })) as unknown as ProductRecord | null;
    if (!record) throw new NotFoundException("We could not find that product.");
    return record;
  }

  private formatMinor(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "bigint") return value.toString();
    if (
      typeof value === "object" &&
      value !== null &&
      "toFixed" in value &&
      typeof (value as { toFixed: unknown }).toFixed === "function"
    ) {
      return (value as { toFixed: (n: number) => string }).toFixed(0);
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "toString" in value &&
      typeof value.toString === "function"
    ) {
      return value.toString();
    }
    return String(value);
  }

  private mapProduct(record: ProductRecord): Product {
    return {
      id: record.publicId,
      sku: record.sku,
      name: record.name,
      description: record.description,
      type: record.type as Product["type"],
      unit: record.unit,
      costPriceMinor: this.formatMinor(record.costPriceMinor),
      sellingPriceMinor: this.formatMinor(record.sellingPriceMinor),
      taxRatePpm: record.taxRatePpm,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
