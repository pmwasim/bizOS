import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";

describe("InventoryService: FIFO & AVCO Stock Valuation Engine", () => {
  const mockDb = {} as never;
  const mockAccess = {} as never;

  it("calculates FIFO stock valuation accurately across multi-batch receipts and dispatches", async () => {
    const service = new InventoryService(mockDb, mockAccess);
    const bizId = "b1";
    const itemId = "item-1";

    // Batch 1: 10 units @ 100 SAR (10000 minor)
    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "RECEIPT",
      quantity: 10,
      unitCostMinor: 10000,
    });

    // Batch 2: 5 units @ 150 SAR (15000 minor)
    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "RECEIPT",
      quantity: 5,
      unitCostMinor: 15000,
    });

    // Dispatch 8 units (FIFO consumes 8 units from Batch 1 @ 10000 minor)
    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "DISPATCH",
      quantity: 8,
      unitCostMinor: 0,
    });

    // Remaining: 2 units @ 10000 + 5 units @ 15000 = 20000 + 75000 = 95000 total asset value
    const fifoValuation = await service.calculateValuation(bizId, itemId, "FIFO");
    expect(fifoValuation.totalQuantity).toBe(7);
    expect(fifoValuation.totalAssetValueMinor).toBe(95000);
    expect(fifoValuation.averageUnitCostMinor).toBe(Math.round(95000 / 7));
  });

  it("calculates AVCO (Moving Average Costing) stock valuation accurately", async () => {
    const service = new InventoryService(mockDb, mockAccess);
    const bizId = "b1";
    const itemId = "item-2";

    // Batch 1: 10 units @ 100 SAR
    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "RECEIPT",
      quantity: 10,
      unitCostMinor: 10000,
    });

    // Batch 2: 10 units @ 200 SAR
    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "RECEIPT",
      quantity: 10,
      unitCostMinor: 20000,
    });

    // Total: 20 units @ 300000 minor -> avg 15000 minor per unit
    const avcoValuation = await service.calculateValuation(bizId, itemId, "AVCO");
    expect(avcoValuation.totalQuantity).toBe(20);
    expect(avcoValuation.totalAssetValueMinor).toBe(300000);
    expect(avcoValuation.averageUnitCostMinor).toBe(15000);
  });

  it("reserves stock and enforces available stock limits", async () => {
    const service = new InventoryService(mockDb, mockAccess);
    const bizId = "b1";
    const itemId = "item-3";

    await service.recordStockMovement(bizId, {
      itemId,
      movementType: "RECEIPT",
      quantity: 10,
      unitCostMinor: 5000,
    });

    const res1 = await service.reserveStock(bizId, itemId, 6);
    expect(res1.reservedQuantity).toBe(6);
    expect(res1.availableStock).toBe(4);

    // Attempting to reserve 5 when only 4 available throws BadRequestException
    await expect(service.reserveStock(bizId, itemId, 5)).rejects.toThrow(BadRequestException);
  });
});
