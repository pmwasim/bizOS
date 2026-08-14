import { describe, expect, it, vi } from "vitest";

import { type CreateSupplierRequest } from "@bizo/contracts/suppliers";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { SuppliersService } from "../suppliers/suppliers.service.js";

const buildInput = (): CreateSupplierRequest => ({
  name: "Acme Supplies",
  contactName: "Jane Doe",
  email: "jane@acme.test",
  phone: "+1234567890",
  taxId: "TAX-12345",
  paymentTerms: 30,
  notes: "Preferred vendor",
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

  const buildDatabase = (): DatabaseService => {
    const transaction = {
      supplier: {
        create: vi.fn().mockImplementation(async (args: Record<string, unknown>) => ({
          publicId: "sup-001",
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          ...args.data,
        })),
        findFirst: vi.fn().mockResolvedValue({
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
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockImplementation(async (args: Record<string, unknown>) => ({
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
          ...(args.data as object),
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
