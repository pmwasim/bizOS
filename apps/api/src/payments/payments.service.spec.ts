import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { CustomerPaymentStatus, DocumentStatus, DocumentType, RoleCode } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";
import { PaymentsService } from "./payments.service.js";

const access: BusinessAccessContext = {
  businessId: 2n,
  businessPublicId: "ea056132-f071-43c4-b725-66b9998411aa",
  membershipId: 3n,
  role: RoleCode.OWNER,
  tenantId: 1n,
  tenantPublicId: "e8385805-a91b-4409-aad0-c093756bdb1b",
  userId: 4n,
  userPublicId: "e847ab9b-700e-4640-a3c7-75af19426954",
};

describe("PaymentsService", () => {
  it("records a payment against a sent invoice", async () => {
    const created = {
      id: 20n,
      publicId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      number: "PAY-0001",
      status: CustomerPaymentStatus.RECORDED,
      receivedOn: new Date("2026-07-28T00:00:00.000Z"),
      method: "BANK_TRANSFER",
      reference: "TRX-1",
      notes: null,
      currencyCode: "SAR",
      currencyScale: 2,
      amountMinor: "10000",
      voidedAt: null,
      voidReason: null,
      createdAt: new Date("2026-07-28T09:00:00.000Z"),
      updatedAt: new Date("2026-07-28T09:00:00.000Z"),
      customer: { publicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Customer" },
      allocations: [
        {
          publicId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          amountMinor: "10000",
          createdAt: new Date("2026-07-28T09:00:00.000Z"),
          invoice: { publicId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", number: "INV-0001" },
        },
      ],
    };
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 7n,
          publicId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          customerId: 5n,
          status: DocumentStatus.SENT,
          type: DocumentType.INVOICE,
          currencyCode: "SAR",
          currencyScale: 2,
          totalMinor: "10000",
          customer: { id: 5n, publicId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Customer" },
        }),
        findFirstOrThrow: vi.fn().mockResolvedValue({ totalMinor: "10000" }),
      },
      paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      businessSettings: {
        update: vi.fn().mockResolvedValue({ paymentPrefix: "PAY", nextPaymentNumber: 2 }),
      },
      customerPayment: { create: vi.fn().mockResolvedValue(created) },
      auditEvent: { create: vi.fn() },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new PaymentsService(database, businessAccess);

    const payment = await service.create(
      access.userPublicId,
      access.businessPublicId,
      {
        invoiceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        amount: "100.00",
        receivedOn: "2026-07-28",
        method: "BANK_TRANSFER",
        reference: "TRX-1",
        notes: null,
      },
      "request-1",
    );

    expect(payment.number).toBe("PAY-0001");
    expect(payment.allocations).toHaveLength(1);
    expect(transaction.customerPayment.create).toHaveBeenCalled();
  });

  it("rejects payments against draft invoices", async () => {
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 7n,
          status: DocumentStatus.DRAFT,
          type: DocumentType.INVOICE,
          currencyScale: 2,
          customer: {},
        }),
      },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new PaymentsService(database, businessAccess);

    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          invoiceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          amount: "10.00",
          receivedOn: "2026-07-28",
          method: "CASH",
          reference: null,
          notes: null,
        },
        "request-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unknown invoices", async () => {
    const transaction = {
      document: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new PaymentsService(database, businessAccess);

    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          invoiceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          amount: "10.00",
          receivedOn: "2026-07-28",
          method: "CASH",
          reference: null,
          notes: null,
        },
        "request-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
