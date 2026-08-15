import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type CreateSalesOrderRequest, type SalesOrder } from "@bizo/contracts/sales-orders";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { SalesOrdersService } from "../sales-orders/sales-orders.service.js";

/** Every `document.create` payload the service produced, so tests can assert on the persisted row. */
const createdDocuments: Array<Record<string, unknown>> = [];

const buildInput = (): CreateSalesOrderRequest => ({
  customerId: "cust-001",
  lines: [{ description: "Consulting", quantity: "10", unitPrice: "100.00", taxRatePercent: "15" }],
});

const buildRecord = (overrides: Partial<SalesOrder> = {}): Record<string, unknown> => ({
  id: 1n,
  publicId: "so-001",
  number: "SO-0001",
  status: "DRAFT" as const,
  issueDate: new Date("2026-08-07T00:00:00.000Z"),
  deliveryDate: null,
  currencyCode: "USD",
  currencyScale: 2,
  subtotalMinor: { toString: () => "100000" },
  taxMinor: { toString: () => "15000" },
  totalMinor: { toString: () => "115000" },
  notes: null,
  customer: {
    id: 10n,
    publicId: "cust-001",
    name: "Acme Studio",
    email: "hello@acme.test",
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    postalCode: null,
    countryCode: null,
  },
  lines: [
    {
      position: 1,
      description: "Consulting",
      quantity: { toString: () => "10" },
      unitPriceMinor: { toString: () => "100000" },
      taxRatePpm: 150000,
      subtotalMinor: { toString: () => "100000" },
      taxMinor: { toString: () => "15000" },
      totalMinor: { toString: () => "115000" },
    },
  ],
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
  ...overrides,
});

describe("SalesOrdersService", () => {
  beforeEach(() => {
    createdDocuments.length = 0;
  });

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

  const buildDatabase = (
    overrides: {
      customer?: boolean;
      settings?: Record<string, unknown>;
      settingsUpdate?: unknown;
      document?: Record<string, unknown>;
      audit?: boolean;
    } = {},
  ): DatabaseService => {
    const defaults = {
      customer: true,
      settings: {
        currencyScale: 2,
        baseCurrency: "USD",
        timeZone: "UTC",
        salesOrderPrefix: "SO",
        nextSalesOrderNumber: 1,
      },
      settingsUpdate: vi
        .fn()
        .mockResolvedValue({ nextSalesOrderNumber: 1, salesOrderPrefix: "SO" }),
      document: buildRecord(),
      audit: true,
    };
    const config = { ...defaults, ...overrides };

    const transaction = {
      business: {
        // Mirrors the real Prisma shape: `currencyScale` and `baseCurrency` are columns on
        // `businesses`, and `business_settings` has no currency column at all. The mock used to
        // put `currencyScale` on `settings`, which let the service read
        // `settings.currencyScale` — undefined in production — and still pass here.
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          settings: config.settings,
          baseCurrency: config.settings.baseCurrency,
          currencyScale: config.settings.currencyScale,
          timeZone: config.settings.timeZone,
        }),
      },
      customer: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            config.customer ? { id: 10n, publicId: "cust-001", name: "Acme Studio" } : null,
          ),
      },
      businessSettings: { update: config.settingsUpdate },
      document: {
        create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
          createdDocuments.push(args.data);
          return config.document;
        }),
        update: vi.fn().mockImplementation(async (args: Record<string, unknown>) => ({
          ...config.document,
          ...(args.data as object),
          customer: config.document.customer,
          lines: config.document.lines,
        })),
        findFirst: vi.fn().mockResolvedValue(config.document),
      },
      documentLine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

  it("creates a sales order with calculated totals", async () => {
    const database = buildDatabase();
    const businessAccess = buildAccessService();
    const service = new SalesOrdersService(database, businessAccess);

    const result = await service.create("user-001", "biz-001", buildInput(), "req-001");

    expect(result.number).toBe("SO-0001");
    expect(result.status).toBe("DRAFT");
    expect(result.totalMinor).toBe("115000");
    expect(result.customer.name).toBe("Acme Studio");
  });

  it("populates every NOT NULL column the shared documents table requires", async () => {
    const database = buildDatabase();
    const service = new SalesOrdersService(database, buildAccessService());

    await service.create("user-001", "biz-001", buildInput(), "req-001");

    // `documents` is shared with quotations, so valid_until is NOT NULL with no default even
    // though a sales order does not expire. Omitting it made every create fail against a real
    // database while this suite stayed green.
    const created = createdDocuments[0]!;
    expect(created.validUntil).toBeTruthy();
    expect(created.currencyScale).toBe(2);
    expect(created.currencyCode).toBe("USD");
  });

  it("throws NotFoundException when customer is missing", async () => {
    const database = buildDatabase({ customer: false });
    const businessAccess = buildAccessService();
    const service = new SalesOrdersService(database, businessAccess);

    await expect(
      service.create("user-001", "biz-001", buildInput(), "req-001"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("confirms a draft sales order", async () => {
    const database = buildDatabase();
    const businessAccess = buildAccessService();
    const service = new SalesOrdersService(database, businessAccess);

    const confirmed = await service.confirm("user-001", "biz-001", "so-001", "req-002");
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("cancels a sales order", async () => {
    const database = buildDatabase();
    const businessAccess = buildAccessService();
    const service = new SalesOrdersService(database, businessAccess);

    const cancelled = await service.cancel("user-001", "biz-001", "so-001", "req-003");
    expect(cancelled.status).toBe("CANCELLED");
  });
});
