import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentStatus } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";
import { PaymentsService } from "./payments.service.js";

const access = {
  businessId: 11n,
  businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
  membershipId: 13n,
  role: "OWNER" as const,
  tenantId: 17n,
  tenantPublicId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
  userId: 19n,
  userPublicId: "9dc31c21-87e7-4aa5-a1ac-648ebc812028",
};

const decimal = (value: string) => ({ toFixed: () => value });

const paymentRow = {
  id: 23n,
  publicId: "33333333-3333-4333-8333-333333333333",
  type: "INBOUND" as const,
  status: PaymentStatus.DRAFT,
  paymentDate: new Date("2026-08-07T00:00:00.000Z"),
  amountMinor: decimal("10000"),
  currencyCode: "SAR",
  currencyScale: 2,
  reference: null,
  notes: null,
  createdAt: new Date("2026-08-07T01:00:00.000Z"),
  updatedAt: new Date("2026-08-07T01:00:00.000Z"),
  allocations: [],
};

describe("PaymentsService", () => {
  const businessAccess = {
    resolve: vi.fn(),
    assertAllowed: vi.fn(),
  };
  const transaction = {
    business: { findFirst: vi.fn() },
    document: { findFirst: vi.fn() },
    purchaseOrder: { findFirst: vi.fn() },
    payment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentAllocation: { deleteMany: vi.fn(), findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  const database = {
    withScope: vi.fn(async (_scope, work) => work(transaction)),
  };

  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    businessAccess.resolve.mockResolvedValue(access);
    businessAccess.assertAllowed.mockResolvedValue(undefined);
    transaction.business.findFirst.mockResolvedValue({
      baseCurrency: "SAR",
      currencyScale: 2,
    });
    transaction.payment.create.mockResolvedValue(paymentRow);
    transaction.payment.findMany.mockResolvedValue([]);
    service = new PaymentsService(
      database as unknown as DatabaseService,
      businessAccess as unknown as BusinessAccessService,
    );
  });

  it("enforces the payment read policy before querying the database", async () => {
    await expect(service.list(access.userPublicId, access.businessPublicId)).resolves.toEqual([]);

    expect(businessAccess.assertAllowed).toHaveBeenCalledWith(access, "payments", "read");
    expect(database.withScope).toHaveBeenCalledWith(access, expect.any(Function));
  });

  it("does not enter a business-scoped transaction when authorization is denied", async () => {
    businessAccess.assertAllowed.mockRejectedValue(
      new NotFoundException("We could not find that resource."),
    );

    await expect(service.list(access.userPublicId, access.businessPublicId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(database.withScope).not.toHaveBeenCalled();
  });

  it("uses the configured business currency scale when creating a payment", async () => {
    const created = await service.create(
      access.userPublicId,
      access.businessPublicId,
      {
        type: "INBOUND",
        paymentDate: "2026-08-07",
        amountMinor: "10000",
        currencyCode: "SAR",
        reference: null,
        notes: null,
        allocations: [],
      },
      "req-1",
    );

    expect(created.amountMinor).toBe("10000");
    expect(transaction.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currencyScale: 2 }),
      }),
    );
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "payment.created" }),
      }),
    );
  });

  it("rejects a payment currency that does not match the business base currency", async () => {
    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          type: "INBOUND",
          paymentDate: "2026-08-07",
          amountMinor: "10000",
          currencyCode: "USD",
          reference: null,
          notes: null,
          allocations: [],
        },
        "req-2",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it("rejects allocations whose total exceeds the payment amount", async () => {
    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          type: "INBOUND",
          paymentDate: "2026-08-07",
          amountMinor: "10000",
          currencyCode: "SAR",
          reference: null,
          notes: null,
          allocations: [
            {
              documentId: "11111111-1111-4111-8111-111111111111",
              amountMinor: "6000",
            },
            {
              documentId: "22222222-2222-4222-8222-222222222222",
              amountMinor: "5000",
            },
          ],
        },
        "req-3",
      ),
    ).rejects.toThrow("Payment allocations cannot exceed the payment amount.");

    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it("accepts a partial allocation smaller than the payment amount", async () => {
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      publicId: "inv-1",
      currencyCode: "SAR",
    });

    const created = await service.create(
      access.userPublicId,
      access.businessPublicId,
      {
        type: "INBOUND",
        paymentDate: "2026-08-07",
        amountMinor: "10000",
        currencyCode: "SAR",
        reference: null,
        notes: null,
        allocations: [
          {
            documentId: "11111111-1111-4111-8111-111111111111",
            amountMinor: "4000",
          },
        ],
      },
      "req-partial",
    );

    expect(created.id).toBe(paymentRow.publicId);
    expect(transaction.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allocations: {
            create: [expect.objectContaining({ documentId: 101n, amountMinor: "4000" })],
          },
        }),
      }),
    );
  });

  it("rejects an allocation whose invoice currency differs from the payment currency", async () => {
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      publicId: "inv-1",
      currencyCode: "USD",
    });

    await expect(
      service.create(
        access.userPublicId,
        access.businessPublicId,
        {
          type: "INBOUND",
          paymentDate: "2026-08-07",
          amountMinor: "10000",
          currencyCode: "SAR",
          reference: null,
          notes: null,
          allocations: [
            {
              documentId: "11111111-1111-4111-8111-111111111111",
              amountMinor: "10000",
            },
          ],
        },
        "req-cross-currency",
      ),
    ).rejects.toThrow("Payment currency SAR does not match invoice currency USD.");

    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it("derives PAID from multiple completed allocations that cover the invoice total", async () => {
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      publicId: "inv-1",
      number: "INV-001",
      totalMinor: decimal("10000"),
      currencyCode: "SAR",
      currencyScale: 2,
    });
    transaction.paymentAllocation.findMany.mockResolvedValueOnce([
      { amountMinor: decimal("4000") },
      { amountMinor: decimal("6000") },
    ]);

    const summary = await service.invoicePaymentSummary(
      access.userPublicId,
      access.businessPublicId,
      "inv-1",
    );

    expect(summary.paidMinor).toBe("10000");
    expect(summary.outstandingMinor).toBe("0");
    expect(summary.settlementStatus).toBe("PAID");
  });

  it("derives PARTIALLY_PAID when only some of the invoice is settled", async () => {
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      publicId: "inv-1",
      number: "INV-001",
      totalMinor: decimal("10000"),
      currencyCode: "SAR",
      currencyScale: 2,
    });
    transaction.paymentAllocation.findMany.mockResolvedValueOnce([
      { amountMinor: decimal("4000") },
    ]);

    const summary = await service.invoicePaymentSummary(
      access.userPublicId,
      access.businessPublicId,
      "inv-1",
    );

    expect(summary.paidMinor).toBe("4000");
    expect(summary.outstandingMinor).toBe("6000");
    expect(summary.settlementStatus).toBe("PARTIALLY_PAID");
  });

  it("derives UNPAID and only counts COMPLETED (non-reversed) allocations", async () => {
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      publicId: "inv-1",
      number: "INV-001",
      totalMinor: decimal("10000"),
      currencyCode: "SAR",
      currencyScale: 2,
    });
    transaction.paymentAllocation.findMany.mockResolvedValueOnce([]);

    const summary = await service.invoicePaymentSummary(
      access.userPublicId,
      access.businessPublicId,
      "inv-1",
    );

    expect(summary.paidMinor).toBe("0");
    expect(summary.outstandingMinor).toBe("10000");
    expect(summary.settlementStatus).toBe("UNPAID");
    expect(transaction.paymentAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payment: { status: PaymentStatus.COMPLETED },
        }),
      }),
    );
  });

  it("uses dedicated authorization actions for completion and reversal", async () => {
    transaction.payment.findFirst.mockResolvedValueOnce(paymentRow);
    transaction.payment.update.mockResolvedValueOnce({
      ...paymentRow,
      status: PaymentStatus.COMPLETED,
    });

    await service.markAsCompleted(
      access.userPublicId,
      access.businessPublicId,
      paymentRow.publicId,
      "req-4",
    );

    expect(businessAccess.assertAllowed).toHaveBeenCalledWith(access, "payments", "complete");

    transaction.payment.findFirst.mockResolvedValueOnce({
      ...paymentRow,
      status: PaymentStatus.COMPLETED,
    });
    transaction.payment.update.mockResolvedValueOnce({
      ...paymentRow,
      status: PaymentStatus.REVERSED,
    });

    await service.reverse(
      access.userPublicId,
      access.businessPublicId,
      paymentRow.publicId,
      "req-5",
    );

    expect(businessAccess.assertAllowed).toHaveBeenCalledWith(access, "payments", "reverse");
  });

  it("rejects completion when payment allocation exceeds invoice remaining balance", async () => {
    const paymentWithAlloc = {
      ...paymentRow,
      allocations: [
        {
          publicId: "alloc-1",
          amountMinor: decimal("7000"),
          createdAt: new Date("2026-08-07T01:00:00.000Z"),
          document: { publicId: "inv-1" },
          purchaseOrder: null,
        },
      ],
    };
    transaction.payment.findFirst.mockResolvedValueOnce(paymentWithAlloc);
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      number: "INV-001",
      totalMinor: decimal("10000"),
    });
    // Prior completed allocations = 5000, new = 7000, 5000 + 7000 = 12000 > 10000
    transaction.paymentAllocation.findMany = vi
      .fn()
      .mockResolvedValueOnce([{ amountMinor: decimal("5000") }]);

    await expect(
      service.markAsCompleted(
        access.userPublicId,
        access.businessPublicId,
        paymentRow.publicId,
        "req-6",
      ),
    ).rejects.toThrow(
      "Payment allocation of 7000 exceeds remaining balance of 5000 on invoice INV-001.",
    );

    expect(transaction.payment.update).not.toHaveBeenCalled();
  });

  it("allows completion when payment allocation is within invoice remaining balance", async () => {
    const paymentWithAlloc = {
      ...paymentRow,
      allocations: [
        {
          publicId: "alloc-1",
          amountMinor: decimal("5000"),
          createdAt: new Date("2026-08-07T01:00:00.000Z"),
          document: { publicId: "inv-1" },
          purchaseOrder: null,
        },
      ],
    };
    transaction.payment.findFirst.mockResolvedValueOnce(paymentWithAlloc);
    transaction.document.findFirst.mockResolvedValueOnce({
      id: 101n,
      number: "INV-001",
      totalMinor: decimal("10000"),
    });
    // Prior completed allocations = 5000, new = 5000, 5000 + 5000 = 10000 === 10000
    transaction.paymentAllocation.findMany = vi
      .fn()
      .mockResolvedValueOnce([{ amountMinor: decimal("5000") }]);
    transaction.payment.update.mockResolvedValueOnce({
      ...paymentWithAlloc,
      status: PaymentStatus.COMPLETED,
    });

    const completed = await service.markAsCompleted(
      access.userPublicId,
      access.businessPublicId,
      paymentRow.publicId,
      "req-7",
    );

    expect(completed.status).toBe(PaymentStatus.COMPLETED);
    expect(transaction.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: paymentWithAlloc.id },
        data: { status: PaymentStatus.COMPLETED },
      }),
    );
  });
});
