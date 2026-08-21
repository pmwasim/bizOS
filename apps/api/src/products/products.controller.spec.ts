import { describe, expect, it, vi } from "vitest";

import {
  type CreateProductRequest,
  type Product,
  type UpdateProductRequest,
} from "@bizo/contracts/products";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { ProductsController } from "./products.controller.js";
import { type ProductsService } from "./products.service.js";

const principal: AuthenticatedPrincipal = {
  userId: "user-001",
};

const productMock: Product = {
  id: "prod-001",
  sku: "ITEM-001",
  name: "Standard Widget",
  description: "High quality widget",
  type: "PRODUCT",
  unit: "pcs",
  costPriceMinor: "5000",
  sellingPriceMinor: "10000",
  taxRatePpm: 150000,
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("ProductsController", () => {
  const buildService = (): ProductsService =>
    ({
      create: vi.fn().mockResolvedValue(productMock),
      list: vi.fn().mockResolvedValue([productMock]),
      get: vi.fn().mockResolvedValue(productMock),
      update: vi.fn().mockResolvedValue({ ...productMock, name: "Super Widget" }),
      deactivate: vi.fn().mockResolvedValue({ ...productMock, isActive: false }),
    }) as unknown as ProductsService;

  it("delegates create to ProductsService", async () => {
    const service = buildService();
    const controller = new ProductsController(service);
    const input: CreateProductRequest = {
      sku: "ITEM-001",
      name: "Standard Widget",
    };

    const result = await controller.create(principal, "biz-001", input, "req-001");
    expect(service.create).toHaveBeenCalledWith("user-001", "biz-001", input, "req-001");
    expect(result).toEqual(productMock);
  });

  it("delegates list to ProductsService", async () => {
    const service = buildService();
    const controller = new ProductsController(service);

    const result = await controller.list(principal, "biz-001");
    expect(service.list).toHaveBeenCalledWith("user-001", "biz-001");
    expect(result).toEqual([productMock]);
  });

  it("delegates get to ProductsService", async () => {
    const service = buildService();
    const controller = new ProductsController(service);

    const result = await controller.get(principal, "biz-001", "prod-001");
    expect(service.get).toHaveBeenCalledWith("user-001", "biz-001", "prod-001");
    expect(result).toEqual(productMock);
  });

  it("delegates update to ProductsService", async () => {
    const service = buildService();
    const controller = new ProductsController(service);
    const input: UpdateProductRequest = {
      name: "Super Widget",
    };

    const result = await controller.update(principal, "biz-001", "prod-001", input, "req-002");
    expect(service.update).toHaveBeenCalledWith(
      "user-001",
      "biz-001",
      "prod-001",
      input,
      "req-002",
    );
    expect(result.name).toBe("Super Widget");
  });

  it("delegates deactivate to ProductsService", async () => {
    const service = buildService();
    const controller = new ProductsController(service);

    const result = await controller.deactivate(principal, "biz-001", "prod-001", "req-003");
    expect(service.deactivate).toHaveBeenCalledWith("user-001", "biz-001", "prod-001", "req-003");
    expect(result.isActive).toBe(false);
  });
});
