import { describe, expect, it, vi } from "vitest";

import { RoleCode } from "@bizo/database";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { PlatformService } from "./platform.service.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const TENANT_PUBLIC_ID = "t0000000-0000-4000-8000-000000000001";
const MEMBERSHIP_PUBLIC_ID = "m0000000-0000-4000-8000-000000000001";

interface MockTransaction {
  user: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  tenant: { create: ReturnType<typeof vi.fn> };
  membership: { create: ReturnType<typeof vi.fn> };
  role: { create: ReturnType<typeof vi.fn> };
  business: { create: ReturnType<typeof vi.fn> };
  businessSettings: { create: ReturnType<typeof vi.fn> };
  taxProfile: { create: ReturnType<typeof vi.fn> };
  businessAccess: { create: ReturnType<typeof vi.fn> };
  auditEvent: { create: ReturnType<typeof vi.fn> };
  $executeRaw: ReturnType<typeof vi.fn>;
}

function createMockTransaction(): MockTransaction {
  return {
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 1n, publicId: USER_PUBLIC_ID }),
    },
    tenant: {
      create: vi.fn().mockResolvedValue({ id: 100n, publicId: TENANT_PUBLIC_ID, name: "Acme" }),
    },
    membership: {
      create: vi.fn().mockResolvedValue({ id: 300n, publicId: MEMBERSHIP_PUBLIC_ID }),
    },
    role: {
      create: vi.fn().mockImplementation((args: { data: { code: RoleCode } }) => ({
        id: 400n,
        code: args.data.code,
      })),
    },
    business: {
      create: vi.fn().mockResolvedValue({
        id: 200n,
        publicId: BUSINESS_PUBLIC_ID,
        name: "Acme",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
      }),
    },
    businessSettings: { create: vi.fn().mockResolvedValue({}) },
    taxProfile: { create: vi.fn().mockResolvedValue({}) },
    businessAccess: { create: vi.fn().mockResolvedValue({ id: 500n }) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  };
}

function createDatabaseMock(transaction: MockTransaction): DatabaseService {
  const db = {
    client: {
      $transaction: vi
        .fn()
        .mockImplementation(async (work: (transaction: MockTransaction) => Promise<unknown>) =>
          work(transaction),
        ),
    },
  };
  return db as unknown as DatabaseService;
}

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn(),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function createConfigurationMock(
  overrides: Partial<ConfigurationService> = {},
): ConfigurationService {
  const mock = {
    assignDefaultErp: vi.fn().mockResolvedValue({
      id: "a0000000-0000-4000-8000-000000000001",
      businessId: BUSINESS_PUBLIC_ID,
      configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
      templateCode: "default-erp",
      templateVersion: "1.0.0",
      isPrimary: true,
      assignedByMembershipId: null,
      reason: "auto-assign on business creation",
      assignedAt: "2026-07-28T00:00:00.000Z",
    }),
  };
  return { ...mock, ...overrides } as unknown as ConfigurationService;
}

describe("PlatformService.createBusiness", () => {
  it("creates the tenant, business, settings, tax, roles, and assigns default-erp as primary", async () => {
    const transaction = createMockTransaction();
    const database = createDatabaseMock(transaction);
    const configuration = createConfigurationMock();

    const service = new PlatformService(database, createBusinessAccessMock(), configuration);

    const business = await service.createBusiness(
      USER_PUBLIC_ID,
      {
        name: "Acme Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "test-request-id",
    );

    expect(business.id).toBe(BUSINESS_PUBLIC_ID);
    expect(business.role).toBe(RoleCode.OWNER);

    // Verify all the expected records were created inside the transaction.
    expect(transaction.tenant.create).toHaveBeenCalled();
    expect(transaction.membership.create).toHaveBeenCalled();
    expect(transaction.business.create).toHaveBeenCalled();
    expect(transaction.businessSettings.create).toHaveBeenCalled();
    expect(transaction.taxProfile.create).toHaveBeenCalled();
    expect(transaction.businessAccess.create).toHaveBeenCalled();
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "business.created",
          targetType: "business",
        }),
      }),
    );

    // Verify assignDefaultErp was called after the transaction committed.
    expect(configuration.assignDefaultErp).toHaveBeenCalledWith(
      expect.objectContaining({
        userPublicId: USER_PUBLIC_ID,
        businessPublicId: BUSINESS_PUBLIC_ID,
        reason: "auto-assign on business creation",
      }),
    );
  });

  it("re-throws when assignDefaultErp fails so the caller surfaces the missing assignment", async () => {
    const transaction = createMockTransaction();
    const database = createDatabaseMock(transaction);
    const configuration = createConfigurationMock({
      assignDefaultErp: vi.fn().mockRejectedValue(new Error("default-erp template missing")),
    });

    const service = new PlatformService(database, createBusinessAccessMock(), configuration);

    await expect(
      service.createBusiness(
        USER_PUBLIC_ID,
        {
          name: "Acme Services",
          countryCode: "SA",
          baseCurrency: "SAR",
          currencyScale: 2,
          locale: "en",
          timeZone: "Asia/Riyadh",
          taxEnabled: false,
          taxName: "Tax",
          taxRatePercent: "0",
        },
        "test-request-id",
      ),
    ).rejects.toThrow("default-erp template missing");

    expect(configuration.assignDefaultErp).toHaveBeenCalled();
  });
});
