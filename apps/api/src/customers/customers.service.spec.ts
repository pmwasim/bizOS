import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type CreateCustomerRequest } from "@bizo/contracts/customers";

import { type DatabaseService } from "../database/database.service.js";
import { type ErpnextClient } from "../erpnext/erpnext.client.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { CustomersService } from "./customers.service.js";

const buildCustomerInput = (
  overrides: Partial<CreateCustomerRequest> = {},
): CreateCustomerRequest => ({
  name: "Acme Corp",
  email: "contact@acme.test",
  phone: "+1234567890",
  addressLine1: "123 Main St",
  addressLine2: "Suite 100",
  city: "Riyadh",
  postalCode: "12345",
  countryCode: "SA",
  ...overrides,
});

const customerRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 10n,
  publicId: "cust-001",
  name: "Acme Corp",
  email: "contact@acme.test",
  phone: "+1234567890",
  addressLine1: "123 Main St",
  addressLine2: "Suite 100",
  city: "Riyadh",
  postalCode: "12345",
  countryCode: "SA",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

describe("CustomersService", () => {
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

  const buildDatabase = (options: { notFound?: boolean } = {}): DatabaseService => {
    const transaction = {
      customer: {
        create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...customerRecord(),
          ...args.data,
        })),
        findFirst: vi.fn().mockImplementation(async () => {
          if (options.notFound) return null;
          return customerRecord();
        }),
        findMany: vi.fn().mockResolvedValue([customerRecord()]),
        update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...customerRecord(),
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

  const buildErpnextClient = (options: { configured?: boolean; fail?: boolean } = {}) =>
    ({
      isConfigured: vi.fn().mockReturnValue(options.configured ?? false),
      createDocument: options.fail
        ? vi.fn().mockRejectedValue(new Error("ERPNext down"))
        : vi.fn().mockResolvedValue({ name: "CUST-001" }),
    }) as unknown as ErpnextClient;

  it("creates a customer and writes an audit event", async () => {
    const database = buildDatabase();
    const service = new CustomersService(database, buildAccessService(), buildErpnextClient());
    const result = await service.create("user-001", "biz-001", buildCustomerInput(), "req-001");

    expect(result.id).toBe("cust-001");
    expect(result.name).toBe("Acme Corp");
    expect(result.email).toBe("contact@acme.test");
    expect(result.countryCode).toBe("SA");
  });

  it("syncs with ERPNext if configured and tolerates ERPNext failure without throwing", async () => {
    const erpnext = buildErpnextClient({ configured: true, fail: true });
    const service = new CustomersService(buildDatabase(), buildAccessService(), erpnext);

    const result = await service.create("user-001", "biz-001", buildCustomerInput(), "req-002");
    expect(result.id).toBe("cust-001");
    expect(erpnext.createDocument).toHaveBeenCalledWith("Customer", {
      customer_name: "Acme Corp",
      customer_group: "Commercial",
      territory: "All Territories",
      customer_type: "Company",
    });
  });

  it("lists customers", async () => {
    const service = new CustomersService(
      buildDatabase(),
      buildAccessService(),
      buildErpnextClient(),
    );
    const results = await service.list("user-001", "biz-001");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("cust-001");
    expect(results[0]?.name).toBe("Acme Corp");
  });

  it("retrieves a customer by publicId", async () => {
    const service = new CustomersService(
      buildDatabase(),
      buildAccessService(),
      buildErpnextClient(),
    );
    const result = await service.get("user-001", "biz-001", "cust-001");
    expect(result.id).toBe("cust-001");
    expect(result.name).toBe("Acme Corp");
  });

  it("throws NotFoundException when retrieving a non-existent customer", async () => {
    const service = new CustomersService(
      buildDatabase({ notFound: true }),
      buildAccessService(),
      buildErpnextClient(),
    );
    await expect(service.get("user-001", "biz-001", "missing-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates a customer and writes an audit event", async () => {
    const service = new CustomersService(
      buildDatabase(),
      buildAccessService(),
      buildErpnextClient(),
    );
    const result = await service.update(
      "user-001",
      "biz-001",
      "cust-001",
      buildCustomerInput({ name: "Acme Updated" }),
      "req-003",
    );
    expect(result.name).toBe("Acme Updated");
  });

  it("throws NotFoundException when updating a non-existent customer", async () => {
    const service = new CustomersService(
      buildDatabase({ notFound: true }),
      buildAccessService(),
      buildErpnextClient(),
    );
    await expect(
      service.update("user-001", "biz-001", "missing-id", buildCustomerInput(), "req-004"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
