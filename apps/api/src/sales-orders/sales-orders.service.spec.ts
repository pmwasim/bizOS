import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { SalesOrdersService } from "./sales-orders.service.js";

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

const CUSTOMER = {
  id: 500n,
  publicId: "c0000000-0000-4000-8000-000000000001",
  name: "Test Customer Co",
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  postalCode: null,
  countryCode: null,
};

const BUSINESS = {
  id: 44n,
  baseCurrency: "SAR",
  currencyScale: 2,
  timeZone: "Asia/Riyadh",
  settings: { id: 44n },
};

function createBusinessAccessMock(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed: vi.fn(),
  } as unknown as BusinessAccessService;
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 900n,
    publicId: "so0000000-0000-4000-8000-000000000001",
    number: "SO-0001",
    status: "DRAFT",
    issueDate: new Date("2026-08-07T00:00:00.000Z"),
    validUntil: new Date("2026-08-07T00:00:00.000Z"),
    deliveryDate: null,
    currencyCode: "SAR",
    currencyScale: 2,
    subtotalMinor: 50000n,
    taxMinor: 7500n,
    totalMinor: 57500n,
    notes: null,
    archivedAt: null,
    customer: CUSTOMER,
    lines: [
      {
        position: 1,
        description: "Consulting services",
        quantity: "1",
        unitPriceMinor: 50000n,
        taxRatePpm: 150_000,
        subtotalMinor: 50000n,
        taxMinor: 7500n,
        totalMinor: 57500n,
      },
    ],
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    updatedAt: new Date("2026-08-07T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabaseMock(initial: ReturnType<typeof documentRecord> | null = null) {
  let row = initial;
  const auditEvents: unknown[] = [];
  const business = { findUniqueOrThrow: vi.fn().mockResolvedValue(BUSINESS) };
  const businessSettings = {
    update: vi.fn().mockResolvedValue({ nextSalesOrderNumber: 2, salesOrderPrefix: "SO" }),
  };
  const customer = { findFirst: vi.fn().mockResolvedValue(CUSTOMER) };
  const document = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = documentRecord({
        ...args.data,
        id: 900n,
        publicId: documentRecord().publicId,
        customer: CUSTOMER,
        lines: [
          {
            position: 1,
            description: "Consulting services",
            quantity: "1",
            unitPriceMinor: 50000n,
            taxRatePpm: 150_000,
            subtotalMinor: 50000n,
            taxMinor: 7500n,
            totalMinor: 57500n,
          },
        ],
      });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async () => row),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof documentRecord
      >;
      return row;
    }),
  };
  const documentLine = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = { business, businessSettings, customer, document, documentLine, auditEvent };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, document, auditEvents };
}

describe("SalesOrdersService", () => {
  it("creates a sales order, reading currencyScale from Business (not BusinessSettings)", async () => {
    const access = createBusinessAccessMock();
    const { database, document, auditEvents } = createDatabaseMock();
    const service = new SalesOrdersService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        customerId: CUSTOMER.publicId,
        lines: [
          {
            description: "Consulting services",
            quantity: "1",
            unitPrice: "500.00",
            taxRatePercent: "15",
          },
        ],
      },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "sales_orders", "create");
    // This is the exact bug this session found and fixed: currencyScale/validUntil must be
    // populated on the shared Document row, sourced from Business, not BusinessSettings.
    expect(document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyCode: "SAR",
          currencyScale: 2,
          validUntil: expect.anything(),
        }),
      }),
    );
    expect(result.status).toBe("DRAFT");
    expect(result.totalMinor).toBe("57500");
    expect(auditEvents).toHaveLength(1);
  });

  it("get() throws NotFoundException for a sales order outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new SalesOrdersService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("update() rejects editing a sales order that is not DRAFT", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(documentRecord({ status: "SENT" }));
    const service = new SalesOrdersService(database, access);

    await expect(
      service.update(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "so0000000-0000-4000-8000-000000000001",
        { lines: [{ description: "New", quantity: "1", unitPrice: "10.00", taxRatePercent: "0" }] },
        "req-2",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("confirm() moves a draft order to CONFIRMED and rejects a non-draft order", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(documentRecord({ status: "DRAFT" }));
    const service = new SalesOrdersService(database, access);

    const confirmed = await service.confirm(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "so0000000-0000-4000-8000-000000000001",
      "req-3",
    );
    expect(confirmed.status).toBe("CONFIRMED");

    await expect(
      service.confirm(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "so0000000-0000-4000-8000-000000000001",
        "req-4",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cancel() sets status ARCHIVED and stamps archivedAt (documents_archive_consistency_check)", async () => {
    const access = createBusinessAccessMock();
    const { database, document } = createDatabaseMock(documentRecord({ status: "DRAFT" }));
    const service = new SalesOrdersService(database, access);

    const cancelled = await service.cancel(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "so0000000-0000-4000-8000-000000000001",
      "req-5",
    );

    // This is the exact bug this session's integration test caught: cancel() must set
    // archivedAt whenever it sets status to ARCHIVED, or the DB check constraint rejects it.
    expect(document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) }),
      }),
    );
    expect(cancelled.status).toBe("CANCELLED");

    await expect(
      service.cancel(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "so0000000-0000-4000-8000-000000000001",
        "req-6",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
