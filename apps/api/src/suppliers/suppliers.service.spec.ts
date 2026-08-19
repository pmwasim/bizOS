import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type CreateSupplierRequest } from "@bizo/contracts/suppliers";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";

const buildInput = (overrides: Partial<CreateSupplierRequest> = {}): CreateSupplierRequest => ({
  name: "Acme Supplies",
  contactName: "Jane Doe",
  email: "jane@acme.test",
  phone: "+1234567890",
  taxId: "TAX-12345",
  paymentTerms: 30,
  notes: "Preferred vendor",
  ...overrides,
});

const supplierRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 10n,
  publicId: "sup-001",
  name: "Acme Supplies",
  contactName: "Jane Doe",
  email: "jane@acme.test",
  phone: "+1234567890",
  addressLine1: null,
  addressLine2: null,
  city: null,
  postalCode: null,
  countryCode: null,
  taxId: "TAX-12345",
  taxName: null,
  bankName: null,
  iban: null,
  swiftCode: null,
  paymentTerms: 30,
  notes: "Preferred vendor",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("SuppliersService", () => {
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

  /**
   * `findFirst` serves two callers: the record lookup (`where.publicId`) and the duplicate tax-ID
   * probe (`where.taxId`). `duplicateTaxId` controls whether the probe reports a clash.
   */
  const buildDatabase = (options: { duplicateTaxId?: boolean } = {}): DatabaseService => {
    const transaction = {
      supplier: {
        create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...supplierRecord(),
          ...args.data,
        })),
        findFirst: vi.fn().mockImplementation(async (args: { where: Record<string, unknown> }) => {
          if ("taxId" in args.where) {
            return options.duplicateTaxId ? { publicId: "sup-999" } : null;
          }
          return supplierRecord();
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
          ...supplierRecord(),
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

  it("creates a supplier", async () => {
    const service = new SuppliersService(buildDatabase(), buildAccessService());
    const result = await service.create("user-001", "biz-001", buildInput(), "req-001");

    expect(result.name).toBe("Acme Supplies");
    expect(result.taxId).toBe("TAX-12345");
    expect(result.paymentTerms).toBe(30);
    expect(result.isActive).toBe(true);
  });

  it("creates a supplier with a valid country-specific tax ID (SA/AE/IN)", async () => {
    const service = new SuppliersService(buildDatabase(), buildAccessService());

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "SA", taxId: "310000000000003" }),
        "req-sa",
      ),
    ).resolves.toMatchObject({ taxId: "310000000000003" });

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "AE", taxId: "100000000000003" }),
        "req-ae",
      ),
    ).resolves.toMatchObject({ taxId: "100000000000003" });

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "IN", taxId: "27AAAAA0000A1Z5" }),
        "req-in",
      ),
    ).resolves.toMatchObject({ taxId: "27AAAAA0000A1Z5" });
  });

  it("rejects an invalid country-specific tax ID on create", async () => {
    const service = new SuppliersService(buildDatabase(), buildAccessService());

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "SA", taxId: "110000000000001" }),
        "req-bad-sa",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "IN", taxId: "INVALID" }),
        "req-bad-in",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a duplicate tax ID on create", async () => {
    const service = new SuppliersService(
      buildDatabase({ duplicateTaxId: true }),
      buildAccessService(),
    );

    await expect(
      service.create(
        "user-001",
        "biz-001",
        buildInput({ countryCode: "SA", taxId: "310000000000003" }),
        "req-dup",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a duplicate tax ID on update", async () => {
    const service = new SuppliersService(
      buildDatabase({ duplicateTaxId: true }),
      buildAccessService(),
    );

    await expect(
      service.update(
        "user-001",
        "biz-001",
        "sup-001",
        { taxId: "310000000000003", countryCode: "SA" },
        "req-dup-upd",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("lists suppliers", async () => {
    const service = new SuppliersService(buildDatabase(), buildAccessService());
    const result = await service.list("user-001", "biz-001");
    expect(result).toEqual([]);
  });

  it("deactivates a supplier", async () => {
    const service = new SuppliersService(buildDatabase(), buildAccessService());
    const result = await service.deactivate("user-001", "biz-001", "sup-001", "req-002");
    expect(result.isActive).toBe(false);
  });
});
