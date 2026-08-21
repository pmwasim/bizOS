import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type CreateProductRequest, type UpdateProductRequest } from "@bizo/contracts/products";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { ProductsService } from "./products.service.js";

const productRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 100n,
  publicId: "prod-001",
  sku: "ITEM-001",
  name: "Standard Widget",
  description: "High quality widget",
  type: "PRODUCT",
  unit: "pcs",
  costPriceMinor: { toFixed: () => "5000" },
  sellingPriceMinor: { toFixed: () => "10000" },
  taxRatePpm: 150000,
  isActive: true,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

describe("ProductsService", () => {
  const access = {
    businessId: 1n,
    businessPublicId: "biz-001",
    membershipId: 2n,
    role: "OWNER" as const,
    tenantId: 3n,
    tenantPublicId: "tenant-001",
    userId: 4n,
    userPublicId: "user-001",
  };

  const buildDatabase = (
    options: { duplicateSku?: boolean; notFound?: boolean; duplicateSkuOnUpdate?: boolean } = {},
  ): DatabaseService => {
    const transaction = {
      product: {
        create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...productRecord(),
          ...args.data,
        })),
        findFirst: vi.fn().mockImplementation(async (args: { where: Record<string, unknown> }) => {
          if (options.notFound) return null;
          if (options.duplicateSku && "sku" in args.where) {
            return productRecord({ publicId: "existing-prod", sku: args.where.sku });
          }
          if (options.duplicateSkuOnUpdate && "sku" in args.where) {
            return productRecord({ publicId: "other-prod", sku: args.where.sku });
          }
          if ("sku" in args.where) {
            return null;
          }
          return productRecord();
        }),
        findMany: vi.fn().mockResolvedValue([productRecord()]),
        update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...productRecord(),
          ...args.data,
        })),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };

    return {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (tx: unknown) => unknown) =>
          work(transaction),
        ),
    } as unknown as DatabaseService;
  };

  const buildAccessService = (): BusinessAccessService =>
    ({
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    }) as unknown as BusinessAccessService;

  it("creates a product and records an audit event", async () => {
    const service = new ProductsService(buildDatabase(), buildAccessService());
    const input: CreateProductRequest = {
      sku: "ITEM-001",
      name: "Standard Widget",
      description: "High quality widget",
      type: "PRODUCT",
      unit: "pcs",
      costPriceMinor: "5000",
      sellingPriceMinor: "10000",
      taxRatePpm: 150000,
      isActive: true,
    };

    const result = await service.create("user-001", "biz-001", input, "req-001");
    expect(result.id).toBe("prod-001");
    expect(result.sku).toBe("ITEM-001");
    expect(result.name).toBe("Standard Widget");
    expect(result.sellingPriceMinor).toBe("10000");
  });

  it("rejects product creation when SKU already exists", async () => {
    const service = new ProductsService(
      buildDatabase({ duplicateSku: true }),
      buildAccessService(),
    );
    const input: CreateProductRequest = {
      sku: "ITEM-001",
      name: "Duplicate Widget",
    };

    await expect(service.create("user-001", "biz-001", input, "req-002")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("lists products for business", async () => {
    const service = new ProductsService(buildDatabase(), buildAccessService());
    const results = await service.list("user-001", "biz-001");
    expect(results).toHaveLength(1);
    expect(results[0]?.sku).toBe("ITEM-001");
  });

  it("retrieves a product by publicId", async () => {
    const service = new ProductsService(buildDatabase(), buildAccessService());
    const result = await service.get("user-001", "biz-001", "prod-001");
    expect(result.id).toBe("prod-001");
    expect(result.name).toBe("Standard Widget");
  });

  it("throws NotFoundException when retrieving non-existent product", async () => {
    const service = new ProductsService(buildDatabase({ notFound: true }), buildAccessService());
    await expect(service.get("user-001", "biz-001", "missing-prod")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates a product and records an audit event", async () => {
    const service = new ProductsService(buildDatabase(), buildAccessService());
    const input: UpdateProductRequest = {
      name: "Super Widget",
      sellingPriceMinor: "12000",
    };

    const result = await service.update("user-001", "biz-001", "prod-001", input, "req-003");
    expect(result.name).toBe("Super Widget");
  });

  it("rejects product update when new SKU already exists on another product", async () => {
    const service = new ProductsService(
      buildDatabase({ duplicateSkuOnUpdate: true }),
      buildAccessService(),
    );
    const input: UpdateProductRequest = {
      sku: "EXISTING-SKU",
    };

    await expect(
      service.update("user-001", "biz-001", "prod-001", input, "req-004"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deactivates a product and records an audit event", async () => {
    const service = new ProductsService(buildDatabase(), buildAccessService());
    const result = await service.deactivate("user-001", "biz-001", "prod-001", "req-005");
    expect(result.isActive).toBe(false);
  });
});
