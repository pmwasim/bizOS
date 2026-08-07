import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { SuppliersService } from "./suppliers.service.js";

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

function supplierRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "s0000000-0000-4000-8000-000000000001",
    name: "Acme Supplies LLC",
    contactName: null,
    email: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    postalCode: null,
    countryCode: null,
    taxId: null,
    taxName: null,
    bankName: null,
    iban: null,
    swiftCode: null,
    paymentTerms: null,
    notes: null,
    isActive: true,
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(initial: ReturnType<typeof supplierRecord> | null = null) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const supplier = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = supplierRecord({ ...args.data, id: 900n, publicId: supplierRecord().publicId });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof supplierRecord
      >;
      return row;
    }),
  };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { supplier, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, supplier, auditEvents };
}

describe("SuppliersService", () => {
  it("creates a supplier as active by default", async () => {
    const access = createBusinessAccessMock();
    const { database, supplier, auditEvents } = createDatabaseMock();
    const service = new SuppliersService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        name: "Acme Supplies LLC",
        contactName: null,
        email: null,
        phone: null,
        taxId: null,
        paymentTerms: null,
        notes: null,
      },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "suppliers", "create");
    expect(supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Acme Supplies LLC" }) }),
    );
    expect(result.isActive).toBe(true);
    expect(auditEvents).toHaveLength(1);
  });

  it("list() only returns active suppliers", async () => {
    const access = createBusinessAccessMock();
    const { database, supplier } = createDatabaseMock(supplierRecord());
    const service = new SuppliersService(database, access);

    await service.list(ACCESS.userPublicId, ACCESS.businessPublicId);

    expect(supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: ACCESS.businessId, isActive: true } }),
    );
  });

  it("get() throws NotFoundException for a supplier outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new SuppliersService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() only overwrites fields explicitly present in the request", async () => {
    const access = createBusinessAccessMock();
    const { database, supplier } = createDatabaseMock(supplierRecord({ taxId: "TAX-1" }));
    const service = new SuppliersService(database, access);

    await service.update(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "s0000000-0000-4000-8000-000000000001",
      { name: "Acme Renamed" },
      "req-2",
    );

    expect(supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Acme Renamed", taxId: "TAX-1" }),
      }),
    );
  });

  it("deactivate() sets isActive to false", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(supplierRecord());
    const service = new SuppliersService(database, access);

    const result = await service.deactivate(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "s0000000-0000-4000-8000-000000000001",
      "req-3",
    );

    expect(result.isActive).toBe(false);
  });
});
