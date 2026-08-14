import { describe, expect, it } from "vitest";
import { PaymentsService } from "./payments.service.js";
import { BadRequestException } from "@nestjs/common";

describe("EMPIRICAL STRESS TEST: Payments & Allocation Engine", () => {
  it("Stress PAY-1: Over-allocation detection asserts allocation sum <= payment amount", () => {
    const mockDb = {} as never;
    const mockAccess = {} as never;
    const service = new PaymentsService(mockDb, mockAccess);

    const overAllocatedInput = {
      type: "BANK_TRANSFER",
      paymentDate: "2026-08-07",
      amountMinor: "10000", // 100.00
      currencyCode: "SAR",
      reference: "REF123",
      notes: "Test",
      allocations: [
        { documentId: "doc-1", amountMinor: "6000" },
        { documentId: "doc-2", amountMinor: "5000" }, // Total 11000 > 10000
      ],
    };

    // Private method assertAllocationTotal check
    expect(() =>
      (
        service as never as { assertAllocationTotal: (input: unknown) => void }
      ).assertAllocationTotal(overAllocatedInput),
    ).toThrow(BadRequestException);
    expect(() =>
      (
        service as never as { assertAllocationTotal: (input: unknown) => void }
      ).assertAllocationTotal(overAllocatedInput),
    ).toThrow("Payment allocations cannot exceed the payment amount.");
  });

  it("Stress PAY-2: Exact allocation sum equal to payment amount passes assertion", () => {
    const mockDb = {} as never;
    const mockAccess = {} as never;
    const service = new PaymentsService(mockDb, mockAccess);

    const exactInput = {
      type: "CASH",
      paymentDate: "2026-08-07",
      amountMinor: "10000",
      currencyCode: "SAR",
      reference: "REF123",
      notes: "Test",
      allocations: [
        { documentId: "doc-1", amountMinor: "6000" },
        { documentId: "doc-2", amountMinor: "4000" }, // Total 10000 === 10000
      ],
    };

    expect(() =>
      (
        service as never as { assertAllocationTotal: (input: unknown) => void }
      ).assertAllocationTotal(exactInput),
    ).not.toThrow();
  });

  it("Stress PAY-3: Under-allocation logs unallocated money to customer credit balance on completion", async () => {
    const auditEvents: Array<Record<string, unknown>> = [];
    const transaction = {
      payment: {
        findFirst: async () => ({
          id: 1n,
          publicId: "pay-1",
          type: "INBOUND",
          status: "DRAFT",
          paymentDate: new Date("2026-08-07T00:00:00.000Z"),
          amountMinor: { toFixed: () => "10000" },
          currencyCode: "SAR",
          currencyScale: 2,
          reference: null,
          notes: null,
          createdAt: new Date("2026-08-07T01:00:00.000Z"),
          updatedAt: new Date("2026-08-07T01:00:00.000Z"),
          allocations: [
            {
              publicId: "alloc-1",
              amountMinor: { toFixed: () => "4000" },
              createdAt: new Date("2026-08-07T01:00:00.000Z"),
              document: null,
              purchaseOrder: null,
            },
          ],
        }),
        update: async () => ({
          id: 1n,
          publicId: "pay-1",
          type: "INBOUND",
          status: "COMPLETED",
          paymentDate: new Date("2026-08-07T00:00:00.000Z"),
          amountMinor: { toFixed: () => "10000" },
          currencyCode: "SAR",
          currencyScale: 2,
          reference: null,
          notes: null,
          createdAt: new Date("2026-08-07T01:00:00.000Z"),
          updatedAt: new Date("2026-08-07T01:00:00.000Z"),
          allocations: [
            {
              publicId: "alloc-1",
              amountMinor: { toFixed: () => "4000" },
              createdAt: new Date("2026-08-07T01:00:00.000Z"),
              document: null,
              purchaseOrder: null,
            },
          ],
        }),
      },
      auditEvent: {
        create: async (data: { data: Record<string, unknown> }) => {
          auditEvents.push(data.data);
          return data.data;
        },
      },
      document: { findFirst: async () => null, update: async () => {} },
    };
    const mockDb = {
      withScope: async (_scope: unknown, work: (tx: unknown) => unknown) => work(transaction),
    } as never;
    const mockAccess = {
      resolve: async () => ({ tenantId: 1n, businessId: 1n, userId: 1n }),
      assertAllowed: async () => {},
    } as never;

    const service = new PaymentsService(mockDb, mockAccess);

    await service.markAsCompleted("u-1", "b-1", "pay-1", "req-1");

    const creditEvent = auditEvents.find((e) => e.action === "customer.overpayment_credited");
    expect(creditEvent).toBeDefined();
    expect((creditEvent?.after as Record<string, unknown>).unallocatedAmountMinor).toBe("6000");
  });
});
