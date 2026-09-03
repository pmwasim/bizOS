import { BadRequestException } from "@nestjs/common";
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

const ITEM = "i0000000-0000-4000-8000-000000000001";
const LOC_A = "l0000000-0000-4000-8000-00000000000a";
const LOC_B = "l0000000-0000-4000-8000-00000000000b";

function createAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function movementRow(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "m0000000-0000-4000-8000-000000000001",
    movementType: "RECEIPT",
    quantity: 10,
    unitCostMinor: { toFixed: () => "1500" },
    referenceType: null,
    referenceId: null,
    occurredAt: new Date("2026-08-29T00:00:00.000Z"),
    createdAt: new Date("2026-08-29T00:00:00.000Z"),
    item: { publicId: ITEM },
    location: { publicId: LOC_A },
    ...overrides,
  };
}

function createDatabaseMock(
  options: {
    onHandRows?: Array<{ movementType: string; quantity: number }>;
    reservationRows?: Array<Record<string, unknown>>;
  } = {},
) {
  const inventoryItem = {
    findFirst: vi.fn().mockResolvedValue({ id: 10n, sku: "SKU-1", name: "Widget" }),
  };
  const stockLocation = {
    findFirst: vi.fn().mockImplementation(async ({ where }: { where: { publicId: string } }) => ({
      id: where.publicId === LOC_B ? 21n : 20n,
    })),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      publicId: "loc-1",
      code: data.code,
      name: data.name,
      isDefault: data.isDefault ?? false,
      isActive: true,
      createdAt: new Date("2026-08-29T00:00:00.000Z"),
      updatedAt: new Date("2026-08-29T00:00:00.000Z"),
    })),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const stockMovement = {
    findMany: vi.fn().mockResolvedValue(options.onHandRows ?? []),
    // Idempotency dedup lookup: no prior movement for the request by default.
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      movementRow({
        movementType: data.movementType,
        quantity: data.quantity,
        location: { publicId: data.locationId === 21n ? LOC_B : LOC_A },
      }),
    ),
  };
  const stockReservation = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue(options.reservationRows ?? []),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const auditEvent = { create: vi.fn().mockResolvedValue({}) };
  const transaction = {
    inventoryItem,
    stockLocation,
    stockMovement,
    stockReservation,
    auditEvent,
    // Advisory-lock calls (pg_advisory_xact_lock) are no-ops against the mock.
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_a: unknown, work: (s: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return {
    database: database as unknown as DatabaseService,
    transaction,
    inventoryItem,
    stockLocation,
    stockMovement,
    stockReservation,
  };
}

describe("InventoryService: multi-location stock", () => {
  it("creates a default location and clears any prior default", async () => {
    const mock = createDatabaseMock();
    const service = new InventoryService(mock.database, createAccessMock());

    const location = await service.createLocation(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { code: "MAIN", name: "Main Warehouse", isDefault: true },
      "req-loc",
    );

    expect(mock.stockLocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 44n, isDefault: true },
        data: { isDefault: false },
      }),
    );
    expect(location.code).toBe("MAIN");
    expect(location.isDefault).toBe(true);
  });

  it("records a receipt movement against a location", async () => {
    const mock = createDatabaseMock();
    const service = new InventoryService(mock.database, createAccessMock());

    const movement = await service.recordMovement(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        itemId: ITEM,
        locationId: LOC_A,
        movementType: "RECEIPT",
        quantity: 10,
        unitCostMinor: "1500",
      },
      "req-mov",
    );

    expect(mock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 10n,
          locationId: 20n,
          movementType: "RECEIPT",
          quantity: 10,
          unitCostMinor: "1500",
        }),
      }),
    );
    expect(movement.movementType).toBe("RECEIPT");
    expect(movement.unitCostMinor).toBe("1500");
  });

  it("dedups a retried movement command by request id instead of double-posting", async () => {
    const mock = createDatabaseMock();
    mock.stockMovement.findFirst.mockResolvedValueOnce(
      movementRow({ movementType: "RECEIPT", quantity: 10 }),
    );
    const service = new InventoryService(mock.database, createAccessMock());

    const movement = await service.recordMovement(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { itemId: ITEM, locationId: LOC_A, movementType: "RECEIPT", quantity: 10 },
      "req-dup",
    );

    expect(mock.stockMovement.create).not.toHaveBeenCalled();
    expect(movement.movementType).toBe("RECEIPT");
  });

  it("computes on-hand from the movement ledger (receipts − dispatches + signed adjustments)", async () => {
    const mock = createDatabaseMock({
      onHandRows: [
        { movementType: "RECEIPT", quantity: 20 },
        { movementType: "DISPATCH", quantity: 5 },
        { movementType: "ADJUSTMENT", quantity: -2 },
        { movementType: "TRANSFER", quantity: 3 },
      ],
    });
    const service = new InventoryService(mock.database, createAccessMock());

    const onHand = await service.onHand(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM, LOC_A);
    expect(onHand.quantityOnHand).toBe(16); // 20 - 5 - 2 + 3
    expect(onHand.locationId).toBe(LOC_A);
  });

  it("rejects a dispatch that exceeds on-hand at the location", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 3 }] });
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(
      service.recordMovement(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { itemId: ITEM, locationId: LOC_A, movementType: "DISPATCH", quantity: 5 },
        "req-dispatch",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mock.stockMovement.create).not.toHaveBeenCalled();
  });

  it("rejects a manual dispatch that would consume reserved stock", async () => {
    const mock = createDatabaseMock({
      onHandRows: [{ movementType: "RECEIPT", quantity: 10 }],
      reservationRows: [{ quantity: 8 }],
    });
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(
      service.recordMovement(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { itemId: ITEM, locationId: LOC_A, movementType: "DISPATCH", quantity: 3 },
        "req-reserved-dispatch",
      ),
    ).rejects.toMatchObject({ response: { code: "INSUFFICIENT_AVAILABLE_STOCK" } });
    expect(mock.stockMovement.create).not.toHaveBeenCalled();
  });

  it("rejects a transfer that would consume reserved stock at the source", async () => {
    const mock = createDatabaseMock({
      onHandRows: [{ movementType: "RECEIPT", quantity: 10 }],
      reservationRows: [{ quantity: 8 }],
    });
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(
      service.transferStock(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { itemId: ITEM, fromLocationId: LOC_A, toLocationId: LOC_B, quantity: 3 },
        "req-reserved-transfer",
      ),
    ).rejects.toMatchObject({ response: { code: "INSUFFICIENT_AVAILABLE_STOCK" } });
    expect(mock.stockMovement.create).not.toHaveBeenCalled();
  });

  it("transfers stock as a source dispatch and destination receipt, guarding source on-hand", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    const service = new InventoryService(mock.database, createAccessMock());

    const result = await service.transferStock(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      { itemId: ITEM, fromLocationId: LOC_A, toLocationId: LOC_B, quantity: 4 },
      "req-transfer",
    );

    expect(mock.stockMovement.create).toHaveBeenCalledTimes(2);
    // Source row leaves stock (−q), destination row receives it (+q).
    expect(mock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: 20n, quantity: -4 }) }),
    );
    expect(mock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ locationId: 21n, quantity: 4 }) }),
    );
    expect(result.from.quantity).toBe(-4);
    expect(result.to.quantity).toBe(4);
  });

  it("rejects a transfer between the same location", async () => {
    const mock = createDatabaseMock();
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(
      service.transferStock(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        { itemId: ITEM, fromLocationId: LOC_A, toLocationId: LOC_A, quantity: 1 },
        "req-transfer-same",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reserves available inventory at the default location", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    mock.inventoryItem.findFirst.mockResolvedValue({ id: 10n, itemType: "INVENTORY" });
    const service = new InventoryService(mock.database, createAccessMock());

    await service.reserveDocumentStock(mock.transaction as never, ACCESS as never, 77n, [
      { inventoryItemId: ITEM, quantity: 4 },
    ]);

    expect(mock.stockReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 77n,
          itemId: 10n,
          locationId: 20n,
          quantity: 4,
        }),
      }),
    );
  });

  it("does not create a second hold when the source document already holds the item", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    mock.inventoryItem.findFirst.mockResolvedValue({ id: 10n, itemType: "INVENTORY" });
    mock.stockReservation.findFirst.mockResolvedValue({ id: 99n });
    const service = new InventoryService(mock.database, createAccessMock());

    await service.reserveDocumentStock(
      mock.transaction as never,
      ACCESS as never,
      88n,
      [{ inventoryItemId: ITEM, quantity: 4 }],
      77n,
    );

    expect(mock.stockReservation.create).not.toHaveBeenCalled();
  });

  it("calculates available-to-promise stock after active reservations", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    mock.stockReservation.findMany.mockResolvedValue([{ quantity: 3 }]);
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(service.atp(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM)).resolves.toEqual({
      itemId: ITEM,
      locationId: null,
      quantityOnHand: 10,
      reservedQuantity: 3,
      availableQuantity: 7,
    });
  });

  it("serializes concurrent fulfillment and dispatches a reservation only once", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    let status = "RESERVED";
    let lockHeld = false;
    let releaseLock: (() => void) | undefined;
    mock.transaction.$executeRaw = vi.fn(async () => {
      if (lockHeld) await new Promise<void>((resolve) => (releaseLock = resolve));
      lockHeld = true;
      return 1;
    });
    mock.stockReservation.findMany.mockImplementation(async ({ select }: { select?: object }) => {
      if (select && "itemId" in select) return status === "RESERVED" ? [{ itemId: 10n }] : [];
      if (select && "quantity" in select) return [];
      return status === "RESERVED" ? [{ id: 1n, itemId: 10n, locationId: 20n, quantity: 4 }] : [];
    });
    mock.stockReservation.update.mockImplementation(async () => {
      status = "FULFILLED";
      lockHeld = false;
      releaseLock?.();
      releaseLock = undefined;
      return {};
    });
    const service = new InventoryService(mock.database, createAccessMock());

    await Promise.all([
      service.fulfillDocumentStock(
        mock.transaction as never,
        ACCESS as never,
        77n,
        "so-1",
        "req-1",
      ),
      service.fulfillDocumentStock(
        mock.transaction as never,
        ACCESS as never,
        77n,
        "so-1",
        "req-2",
      ),
    ]);

    expect(mock.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  it("fulfills only delivered quantity and leaves the remainder reserved", async () => {
    const mock = createDatabaseMock({ onHandRows: [{ movementType: "RECEIPT", quantity: 10 }] });
    mock.stockReservation.findMany
      .mockResolvedValueOnce([{ id: 1n, itemId: 10n, locationId: 20n, quantity: 10 }])
      .mockResolvedValueOnce([]);
    const service = new InventoryService(mock.database, createAccessMock());

    await service.fulfillDocumentStock(
      mock.transaction as never,
      ACCESS as never,
      77n,
      "so-1",
      "req-partial",
      [{ inventoryItemId: ITEM, quantity: 3 }],
    );

    expect(mock.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 3 }) }),
    );
    expect(mock.stockReservation.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { quantity: 7 },
    });
  });

  it("values persisted movement layers with FIFO and AVCO using minor-unit strings", async () => {
    const mock = createDatabaseMock();
    mock.stockMovement.findMany.mockResolvedValue([
      { id: 1n, movementType: "RECEIPT", quantity: 10, unitCostMinor: { toString: () => "10000" } },
      { id: 2n, movementType: "RECEIPT", quantity: 10, unitCostMinor: { toString: () => "20000" } },
      { id: 3n, movementType: "DISPATCH", quantity: 5, unitCostMinor: { toString: () => "0" } },
      {
        id: 4n,
        movementType: "ADJUSTMENT",
        quantity: 5,
        unitCostMinor: { toString: () => "10000" },
      },
      { id: 5n, movementType: "ADJUSTMENT", quantity: -5, unitCostMinor: { toString: () => "0" } },
    ]);
    const service = new InventoryService(mock.database, createAccessMock());

    await expect(
      service.valuation(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM, LOC_A, "FIFO"),
    ).resolves.toMatchObject({
      valuationMethod: "FIFO",
      totalQuantity: 15,
      totalAssetValueMinor: "250000",
      averageUnitCostMinor: "16667",
    });
    await expect(
      service.valuation(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM, LOC_A, "AVCO"),
    ).resolves.toMatchObject({
      valuationMethod: "AVCO",
      totalQuantity: 15,
      totalAssetValueMinor: "206250",
      averageUnitCostMinor: "13750",
    });

    mock.stockMovement.findMany.mockResolvedValue([
      { id: 6n, movementType: "RECEIPT", quantity: 1, unitCostMinor: { toString: () => "100" } },
      { id: 7n, movementType: "RECEIPT", quantity: 2, unitCostMinor: { toString: () => "0" } },
    ]);
    await expect(
      service.valuation(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM, LOC_A, "AVCO"),
    ).resolves.toMatchObject({
      totalQuantity: 3,
      totalAssetValueMinor: "100",
      averageUnitCostMinor: "33",
    });
    await expect(
      service.valuation(ACCESS.userPublicId, ACCESS.businessPublicId, ITEM, LOC_A, "FIFO"),
    ).resolves.toMatchObject({
      totalQuantity: 3,
      totalAssetValueMinor: "100",
      averageUnitCostMinor: "33",
    });
  });
});
