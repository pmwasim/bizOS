import { describe, expect, it, vi } from "vitest";

import { type CreateCreditNoteRequest } from "@bizo/contracts/credit-notes";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { CreditNotesService } from "../credit-notes/credit-notes.service.js";

const buildInput = (): CreateCreditNoteRequest => ({
  customerId: "cust-001",
  reason: "BILLING_ERROR",
  lines: [
    { description: "Discount adjustment", quantity: "1", unitPrice: "50.00", taxRatePercent: "15" },
  ],
});

describe("CreditNotesService", () => {
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
    const transaction: Record<string, unknown> = {
      business: {
        // Mirrors the real Prisma shape: `currencyScale` and `baseCurrency` are columns on
        // `businesses`, and `business_settings` has no currency column at all.
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          settings: {
            timeZone: "UTC",
            creditNotePrefix: "CN",
            nextCreditNoteNumber: 1,
          },
          baseCurrency: "USD",
          currencyScale: 2,
          timeZone: "UTC",
        }),
      },
      customer: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 10n, publicId: "cust-001", name: "Acme Studio" }),
      },
      businessSettings: {
        update: vi.fn().mockResolvedValue({ nextCreditNoteNumber: 1, creditNotePrefix: "CN" }),
      },
      document: {
        create: vi.fn().mockResolvedValue({
          publicId: "cn-001",
          number: "CN-0001",
          reason: "BILLING_ERROR",
          issueDate: new Date(),
          currencyCode: "USD",
          currencyScale: 2,
          subtotalMinor: "-50000",
          taxMinor: "-7500",
          totalMinor: "-57500",
          notes: null,
          status: "DRAFT",
          customer: { publicId: "cust-001", name: "Acme Studio", email: null, phone: null },
          referenceDocument: null,
          lines: [
            {
              position: 1,
              description: "Discount adjustment",
              quantity: "1",
              unitPriceMinor: "-50000",
              taxRatePpm: 150000,
              subtotalMinor: "-50000",
              taxMinor: "-7500",
              totalMinor: "-57500",
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: vi.fn().mockImplementation(async (args: Record<string, unknown>) => ({
          publicId: "cn-001",
          number: "CN-0001",
          reason: "BILLING_ERROR",
          issueDate: new Date(),
          currencyCode: "USD",
          currencyScale: 2,
          subtotalMinor: "-50000",
          taxMinor: "-7500",
          totalMinor: "-57500",
          notes: null,
          status: "SENT",
          customer: { publicId: "cust-001", name: "Acme Studio", email: null, phone: null },
          referenceDocument: null,
          lines: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(args.data as object),
        })),
        findFirst: vi.fn().mockResolvedValue({
          id: 1n,
          publicId: "cn-001",
          reason: "BILLING_ERROR",
          status: "DRAFT",
          customer: { id: 10n },
        }),
      },
      documentLine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
      creditNoteAllocation: { findMany: vi.fn().mockResolvedValue([]) },
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

  it("creates a credit note", async () => {
    const service = new CreditNotesService(buildDatabase(), buildAccessService());
    const result = await service.create("user-001", "biz-001", buildInput(), "req-001");

    expect(result.number).toBe("CN-0001");
    expect(result.reason).toBe("BILLING_ERROR");
    expect(result.status).toBe("DRAFT");
  });

  it("issues a draft credit note", async () => {
    const service = new CreditNotesService(buildDatabase(), buildAccessService());
    const result = await service.issue("user-001", "biz-001", "cn-001", "req-002");
    expect(result.status).toBe("ISSUED");
  });
});
