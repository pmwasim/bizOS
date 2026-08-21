import { describe, expect, it, vi } from "vitest";

import { type CreateCustomerRequest, type Customer } from "@bizo/contracts/customers";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { CustomersController } from "./customers.controller.js";
import { type CustomersService } from "./customers.service.js";

const principal: AuthenticatedPrincipal = {
  userId: "user-001",
};

const customerMock: Customer = {
  id: "cust-001",
  name: "Acme Corp",
  email: "contact@acme.test",
  phone: "+1234567890",
  addressLine1: "123 Main St",
  addressLine2: null,
  city: "Riyadh",
  postalCode: "12345",
  countryCode: "SA",
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("CustomersController", () => {
  const buildService = (): CustomersService =>
    ({
      create: vi.fn().mockResolvedValue(customerMock),
      list: vi.fn().mockResolvedValue([customerMock]),
      get: vi.fn().mockResolvedValue(customerMock),
      update: vi.fn().mockResolvedValue({ ...customerMock, name: "Acme Updated" }),
    }) as unknown as CustomersService;

  it("delegates create to CustomersService", async () => {
    const service = buildService();
    const controller = new CustomersController(service);
    const input: CreateCustomerRequest = {
      name: "Acme Corp",
      email: "contact@acme.test",
      phone: "+1234567890",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Riyadh",
      postalCode: "12345",
      countryCode: "SA",
    };

    const result = await controller.create(principal, "biz-001", input, "req-001");
    expect(service.create).toHaveBeenCalledWith("user-001", "biz-001", input, "req-001");
    expect(result).toEqual(customerMock);
  });

  it("delegates list to CustomersService", async () => {
    const service = buildService();
    const controller = new CustomersController(service);

    const result = await controller.list(principal, "biz-001");
    expect(service.list).toHaveBeenCalledWith("user-001", "biz-001");
    expect(result).toEqual([customerMock]);
  });

  it("delegates get to CustomersService", async () => {
    const service = buildService();
    const controller = new CustomersController(service);

    const result = await controller.get(principal, "biz-001", "cust-001");
    expect(service.get).toHaveBeenCalledWith("user-001", "biz-001", "cust-001");
    expect(result).toEqual(customerMock);
  });

  it("delegates update to CustomersService", async () => {
    const service = buildService();
    const controller = new CustomersController(service);
    const input = {
      name: "Acme Updated",
      email: "contact@acme.test",
      phone: "+1234567890",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Riyadh",
      postalCode: "12345",
      countryCode: "SA",
    };

    const result = await controller.update(principal, "biz-001", "cust-001", input, "req-002");
    expect(service.update).toHaveBeenCalledWith(
      "user-001",
      "biz-001",
      "cust-001",
      input,
      "req-002",
    );
    expect(result.name).toBe("Acme Updated");
  });
});
