import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { StatementsService } from "./statements.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";

const CUSTOMER = {
  id: 42n,
  publicId: "c0000000-0000-4000-8000-000000000001",
  name: "Acme Trading",
  currencyCode: "SAR",
};

function buildService(options: {
  customer?: typeof CUSTOMER | null;
  invoices?: unknown[];
  payments?: unknown[];
}) {
  const documentFindMany = vi.fn().mockResolvedValue(options.invoices ?? []);
  const allocationFindMany = vi.fn().mockResolvedValue(options.payments ?? []);

  const transaction = {
    customer: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.customer === undefined ? CUSTOMER : options.customer),
    },
    document: { findMany: documentFindMany },
    paymentAllocation: { findMany: allocationFindMany },
  };

  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_scope: unknown, work: (t: unknown) => unknown) =>
        work(transaction),
      ),
  };
  const access = {
    resolve: vi.fn().mockResolvedValue({ tenantId: 1n, businessId: 2n }),
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  };

  const service = new StatementsService(
    database as unknown as DatabaseService,
    access as unknown as BusinessAccessService,
  );
  return { service, documentFindMany, allocationFindMany };
}

function invoice(publicId: string, number: string, date: string, totalMinor: string) {
  return {
    publicId,
    number,
    issueDate: new Date(`${date}T00:00:00.000Z`),
    totalMinor: { toString: () => totalMinor },
  };
}

function payment(publicId: string, reference: string, date: string, amountMinor: string) {
  return {
    publicId: `alloc-${publicId}`,
    amountMinor: { toString: () => amountMinor },
    payment: {
      publicId,
      paymentDate: new Date(`${date}T00:00:00.000Z`),
      reference,
    },
  };
}

describe("StatementsService.customer", () => {
  it("scopes payments to the requested customer", async () => {
    const { service, allocationFindMany } = buildService({ customer: CUSTOMER });

    await service.customer("user-1", "biz-1", CUSTOMER.publicId);

    // Without customerId in this filter every customer's statement shows every other customer's
    // receipts, and the closing balance is wrong for all of them.
    expect(allocationFindMany).toHaveBeenCalledTimes(1);
    const where = allocationFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect((where.document as Record<string, unknown>).customerId).toBe(CUSTOMER.id);
    expect(where.businessId).toBe(2n);
    expect((where.payment as Record<string, unknown>).status).toBe("COMPLETED");
  });

  it("interleaves invoices and payments by date with a running balance", async () => {
    const { service } = buildService({
      customer: CUSTOMER,
      invoices: [
        invoice("i-1", "INV-001", "2026-01-10", "100000"),
        invoice("i-2", "INV-002", "2026-03-01", "50000"),
      ],
      payments: [payment("p-1", "RCP-001", "2026-02-01", "40000")],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId);

    expect(statement.items.map((item) => item.referenceNumber)).toEqual([
      "INV-001",
      "RCP-001",
      "INV-002",
    ]);
    expect(statement.items.map((item) => item.balanceMinor)).toEqual([100000, 60000, 110000]);
    expect(statement.totalInvoicedMinor).toBe(150000);
    expect(statement.totalPaidMinor).toBe(40000);
    expect(statement.closingBalanceMinor).toBe(110000);
    expect(statement.currency).toBe("SAR");
  });

  it("orders an invoice before a payment received the same day", async () => {
    const { service } = buildService({
      customer: CUSTOMER,
      invoices: [invoice("i-1", "INV-001", "2026-01-10", "30000")],
      payments: [payment("p-1", "RCP-001", "2026-01-10", "30000")],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId);

    expect(statement.items.map((item) => item.type)).toEqual(["INVOICE", "PAYMENT"]);
    expect(statement.items.map((item) => item.balanceMinor)).toEqual([30000, 0]);
  });

  it("returns an empty settled statement when there is no activity", async () => {
    const { service } = buildService({ customer: CUSTOMER });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId);

    expect(statement.items).toEqual([]);
    expect(statement.openingBalanceMinor).toBe(0);
    expect(statement.closingBalanceMinor).toBe(0);
  });

  it("raises NotFound for a customer outside the business", async () => {
    const { service } = buildService({ customer: null });

    await expect(service.customer("user-1", "biz-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
