import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { InventoryService } from "./inventory.service.js";

const ACCESS = {
  businessId: 44n,
  businessPublicId: "b0000000-0000-4000-8000-000000000001",
  membershipId: 300n,
  role: "OWNER" as const,
  tenantId: 100n,
  tenantPublicId: "t0000000-0000-4000-8000-000000000001",
  userId: 1n,
  userPublicId: "u0000000-0000-4000-8000-000000000001",
};

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function itemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "i0000000-0000-4000-8000-000000000001",
    sku: "SKU-100",
    name: "Widget",
    description: null,
    itemType: "INVENTORY",
    unit: null,
    costPriceMinor: null,
    sellingPriceMinor: null,
    taxRatePpm: 0,
    reorderLevel: null,
    isActive: true,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(
  initial: ReturnType<typeof itemRecord> | null = null,
  existingBySku: ReturnType<typeof itemRecord> | null = null,
) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const inventoryItem = {
    findFirst: vi.fn().mockImplementation(async (args: { where: { sku?: string } }) => {
      if (args.where.sku !== undefined) return existingBySku;
      return row;
    }),
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = itemRecord({ ...args.data, id: 900n, publicId: itemRecord().publicId });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<typeof itemRecord>;
      return row;
    }),
  };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { inventoryItem, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, inventoryItem, auditEvents };
}

describe("InventoryService", () => {
  it("creates an item and maps the real taxRatePpm field (not the mapped DB column name)", async () => {
    const access = createBusinessAccessMock();
    const { database, inventoryItem, auditEvents } = createDatabaseMock();
    const service = new InventoryService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        sku: "SKU-100",
        name: "Widget",
        description: null,
        itemType: "INVENTORY",
        unit: "each",
        costPriceMinor: null,
        sellingPriceMinor: null,
        taxRatePpm: 150_000,
        reorderLevel: 5,
      },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "inventory", "create");
    expect(inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ taxRatePpm: 150_000, sku: "SKU-100" }),
      }),
    );
    expect(result.taxRatePpm).toBe(150_000);
    expect(auditEvents).toHaveLength(1);
  });

  it("rejects create() when the SKU already exists in the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null, itemRecord());
    const service = new InventoryService(database, access);

    await expect(
      service.create(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        {
          sku: "SKU-100",
          name: "Duplicate",
          description: null,
          itemType: "INVENTORY",
          unit: null,
          costPriceMinor: null,
          sellingPriceMinor: null,
          taxRatePpm: 0,
          reorderLevel: null,
        },
        "req-2",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("get() throws NotFoundException for an item outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new InventoryService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() rejects renaming the SKU to one already used by another item", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(
      itemRecord({ sku: "SKU-100" }),
      itemRecord({ sku: "SKU-200" }),
    );
    const service = new InventoryService(database, access);

    await expect(
      service.update(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "i0000000-0000-4000-8000-000000000001",
        { sku: "SKU-200" },
        "req-3",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("update() preserves fields not present in a partial request", async () => {
    const access = createBusinessAccessMock();
    const { database, inventoryItem } = createDatabaseMock(itemRecord({ reorderLevel: 10 }));
    const service = new InventoryService(database, access);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "i0000000-0000-4000-8000-000000000001",
      { name: "Renamed Widget" },
      "req-4",
    );

    expect(inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Renamed Widget", reorderLevel: 10 }),
      }),
    );
  });

  it("deactivate() sets isActive to false", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(itemRecord());
    const service = new InventoryService(database, access);

    const result = await service.deactivate(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "i0000000-0000-4000-8000-000000000001",
      "req-5",
    );

    expect(result.isActive).toBe(false);
  });
});
