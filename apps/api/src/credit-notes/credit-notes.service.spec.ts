import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { CreditNotesService } from "./credit-notes.service.js";

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
};

const INVOICE = {
  id: 700n,
  publicId: "inv0000000-0000-4000-8000-000000000001",
  number: "INV-0001",
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
    publicId: "cn0000000-0000-4000-8000-000000000001",
    number: "CN-0001",
    status: "DRAFT",
    issueDate: new Date("2026-08-07T00:00:00.000Z"),
    reason: "BILLING_ERROR",
    currencyCode: "SAR",
    currencyScale: 2,
    subtotalMinor: 10000n,
    taxMinor: 1500n,
    totalMinor: 11500n,
    notes: null,
    customer: CUSTOMER,
    referenceDocument: null,
    lines: [
      {
        position: 1,
        description: "Refund adjustment",
        quantity: "1",
        unitPriceMinor: 10000n,
        taxRatePpm: 150_000,
        subtotalMinor: 10000n,
        taxMinor: 1500n,
        totalMinor: 11500n,
      },
    ],
    allocations: [],
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
    update: vi.fn().mockResolvedValue({ nextCreditNoteNumber: 2, creditNotePrefix: "CN" }),
  };
  const customer = { findFirst: vi.fn().mockResolvedValue(CUSTOMER) };
  const document = {
    create: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = documentRecord({
        ...args.data,
        id: 900n,
        publicId: documentRecord().publicId,
        customer: CUSTOMER,
        referenceDocument: args.data.referenceDocumentId ? INVOICE : null,
        lines: [
          {
            position: 1,
            description: "Refund adjustment",
            quantity: "1",
            unitPriceMinor: 10000n,
            taxRatePpm: 150_000,
            subtotalMinor: 10000n,
            taxMinor: 1500n,
            totalMinor: 11500n,
          },
        ],
        allocations: [],
      });
      return row;
    }),
    findMany: vi.fn().mockImplementation(async () => (row ? [row] : [])),
    findFirst: vi.fn().mockImplementation(async (args: { where: { type?: string } }) => {
      if (args.where.type === "INVOICE") return INVOICE;
      return row;
    }),
    update: vi.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
      row = { ...(row as Record<string, unknown>), ...args.data } as ReturnType<
        typeof documentRecord
      >;
      return row;
    }),
  };
  const creditNoteAllocation = { findMany: vi.fn().mockResolvedValue([]) };
  const auditEvent = {
    create: vi.fn().mockImplementation(async (args: { data: unknown }) => {
      auditEvents.push(args.data);
      return args.data;
    }),
  };
  const transaction = {
    business,
    businessSettings,
    customer,
    document,
    creditNoteAllocation,
    auditEvent,
  };
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_access: unknown, work: (scope: typeof transaction) => unknown) =>
        work(transaction),
      ),
  };
  return { database: database as unknown as DatabaseService, document, auditEvents };
}

describe("CreditNotesService", () => {
  it("creates a credit note, reading currencyScale from Business (not BusinessSettings)", async () => {
    const access = createBusinessAccessMock();
    const { database, document, auditEvents } = createDatabaseMock();
    const service = new CreditNotesService(database, access);

    const result = await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        customerId: CUSTOMER.publicId,
        reason: "BILLING_ERROR",
        lines: [
          {
            description: "Refund adjustment",
            quantity: "1",
            unitPrice: "100.00",
            taxRatePercent: "15",
          },
        ],
      },
      "req-1",
    );

    expect(access.assertAllowed).toHaveBeenCalledWith(ACCESS, "credit_notes", "create");
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
    expect(result.totalMinor).toBe("11500");
    expect(result.status).toBe("DRAFT");
    expect(auditEvents).toHaveLength(1);
  });

  it("resolves referenceInvoiceId against an INVOICE-typed document and rejects a missing one", async () => {
    const access = createBusinessAccessMock();
    const { database, document } = createDatabaseMock();
    const service = new CreditNotesService(database, access);

    await service.create(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      {
        customerId: CUSTOMER.publicId,
        referenceInvoiceId: INVOICE.publicId,
        reason: "BILLING_ERROR",
        lines: [
          { description: "Refund", quantity: "1", unitPrice: "100.00", taxRatePercent: "15" },
        ],
      },
      "req-2",
    );
    expect(document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceDocumentId: INVOICE.id }),
      }),
    );

    const missing = createDatabaseMock();
    missing.document.findFirst = vi.fn().mockResolvedValue(null);
    const serviceWithMissingInvoice = new CreditNotesService(missing.database, access);
    await expect(
      serviceWithMissingInvoice.create(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        {
          customerId: CUSTOMER.publicId,
          referenceInvoiceId: "missing-invoice",
          reason: "BILLING_ERROR",
          lines: [
            { description: "Refund", quantity: "1", unitPrice: "100.00", taxRatePercent: "15" },
          ],
        },
        "req-3",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("get() throws NotFoundException for a credit note outside the business", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(null);
    const service = new CreditNotesService(database, access);

    await expect(
      service.get(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("issue() moves a draft credit note to ISSUED and rejects a non-draft one", async () => {
    const access = createBusinessAccessMock();
    const { database } = createDatabaseMock(documentRecord({ status: "DRAFT" }));
    const service = new CreditNotesService(database, access);

    const issued = await service.issue(
      ACCESS.userPublicId,
      ACCESS.businessPublicId,
      "cn0000000-0000-4000-8000-000000000001",
      "req-4",
    );
    expect(issued.status).toBe("ISSUED");

    await expect(
      service.issue(
        ACCESS.userPublicId,
        ACCESS.businessPublicId,
        "cn0000000-0000-4000-8000-000000000001",
        "req-5",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
