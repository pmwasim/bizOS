import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { StatementsService } from "./statements.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";

const CUSTOMER = {
  id: 42n,
  publicId: "c0000000-0000-4000-8000-000000000001",
  name: "Acme Trading",
};

const OTHER_CUSTOMER = {
  publicId: "c0000000-0000-4000-8000-000000000002",
  name: "Beta Works",
};

/** The as-of date every test ages against, so no assertion depends on the day it is run. */
const AS_OF = "2026-06-30";

interface InvoiceOptions {
  number: string;
  issueDate: string;
  dueDate?: string | null;
  totalMinor: string;
  currency?: string;
  customer?: { publicId: string; name: string };
}

function invoice(publicId: string, options: InvoiceOptions) {
  return {
    publicId,
    number: options.number,
    issueDate: new Date(`${options.issueDate}T00:00:00.000Z`),
    dueDate:
      options.dueDate === undefined || options.dueDate === null
        ? null
        : new Date(`${options.dueDate}T00:00:00.000Z`),
    currencyCode: options.currency ?? "SAR",
    totalMinor: { toString: () => options.totalMinor },
    customer: options.customer ?? { publicId: CUSTOMER.publicId, name: CUSTOMER.name },
  };
}

function paymentAllocation(options: {
  id: string;
  invoicePublicId: string;
  reference: string;
  date: string;
  amountMinor: string;
}) {
  return {
    publicId: options.id,
    amountMinor: { toString: () => options.amountMinor },
    document: { publicId: options.invoicePublicId },
    payment: {
      publicId: `pay-${options.id}`,
      paymentDate: new Date(`${options.date}T00:00:00.000Z`),
      reference: options.reference,
    },
  };
}

function creditNoteAllocation(options: {
  id: string;
  invoicePublicId: string;
  number: string;
  date: string;
  amountMinor: string;
}) {
  return {
    publicId: options.id,
    amountMinor: { toString: () => options.amountMinor },
    invoice: { publicId: options.invoicePublicId },
    creditNote: {
      publicId: `cn-${options.id}`,
      number: options.number,
      issueDate: new Date(`${options.date}T00:00:00.000Z`),
    },
  };
}

function buildService(options: {
  customer?: typeof CUSTOMER | null;
  invoices?: unknown[];
  payments?: unknown[];
  creditNotes?: unknown[];
  baseCurrency?: string;
  currencyScale?: number;
}) {
  const documentFindMany = vi.fn().mockResolvedValue(options.invoices ?? []);
  const allocationFindMany = vi.fn().mockResolvedValue(options.payments ?? []);
  const creditNoteAllocationFindMany = vi.fn().mockResolvedValue(options.creditNotes ?? []);

  const transaction = {
    business: {
      findFirst: vi.fn().mockResolvedValue({
        baseCurrency: options.baseCurrency ?? "SAR",
        currencyScale: options.currencyScale ?? 2,
      }),
    },
    customer: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.customer === undefined ? CUSTOMER : options.customer),
    },
    document: { findMany: documentFindMany },
    paymentAllocation: { findMany: allocationFindMany },
    creditNoteAllocation: { findMany: creditNoteAllocationFindMany },
  };

  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_scope: unknown, work: (t: unknown) => unknown) =>
        work(transaction),
      ),
  };
  const assertAllowed = vi.fn().mockResolvedValue(undefined);
  const access = {
    resolve: vi.fn().mockResolvedValue({ tenantId: 1n, businessId: 2n }),
    assertAllowed,
  };

  const service = new StatementsService(
    database as unknown as DatabaseService,
    access as unknown as BusinessAccessService,
  );
  return {
    service,
    documentFindMany,
    allocationFindMany,
    creditNoteAllocationFindMany,
    assertAllowed,
  };
}

describe("StatementsService.customer", () => {
  it("scopes payments to the requested customer", async () => {
    const { service, allocationFindMany } = buildService({});

    await service.customer("user-1", "biz-1", CUSTOMER.publicId, { endDate: AS_OF });

    // Without customerId in this filter every customer's statement shows every other customer's
    // receipts, and the closing balance is wrong for all of them.
    expect(allocationFindMany).toHaveBeenCalledTimes(1);
    const where = allocationFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect((where.document as Record<string, unknown>).customerId).toBe(CUSTOMER.id);
    expect(where.businessId).toBe(2n);
    expect((where.payment as Record<string, unknown>).status).toBe("COMPLETED");
  });

  it("reads only issued invoices", async () => {
    const { service, documentFindMany } = buildService({});

    await service.customer("user-1", "biz-1", CUSTOMER.publicId, { endDate: AS_OF });

    const where = documentFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.type).toBe("INVOICE");
    expect(where.status).toEqual({ in: ["SENT"] });
  });

  it("interleaves invoices, credit notes, and payments by date with a running balance", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", { number: "INV-001", issueDate: "2026-01-10", totalMinor: "100000" }),
        invoice("i-2", { number: "INV-002", issueDate: "2026-03-01", totalMinor: "50000" }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-02-01",
          amountMinor: "40000",
        }),
      ],
      creditNotes: [
        creditNoteAllocation({
          id: "cna-1",
          invoicePublicId: "i-2",
          number: "CN-001",
          date: "2026-03-15",
          amountMinor: "10000",
        }),
      ],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    expect(statement.items.map((item) => item.referenceNumber)).toEqual([
      "INV-001",
      "RCP-001",
      "INV-002",
      "CN-001",
    ]);
    expect(statement.items.map((item) => item.balanceMinor)).toEqual([
      "100000",
      "60000",
      "110000",
      "100000",
    ]);
    expect(statement.totalInvoicedMinor).toBe("150000");
    expect(statement.totalPaidMinor).toBe("40000");
    expect(statement.totalCreditedMinor).toBe("10000");
    expect(statement.closingBalanceMinor).toBe("100000");
  });

  it("orders an invoice before a payment received the same day", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", { number: "INV-001", issueDate: "2026-01-10", totalMinor: "30000" }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-01-10",
          amountMinor: "30000",
        }),
      ],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    expect(statement.items.map((item) => item.type)).toEqual(["INVOICE", "PAYMENT"]);
    expect(statement.items.map((item) => item.balanceMinor)).toEqual(["30000", "0"]);
  });

  it("carries a balance from before the period into the opening balance", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", { number: "INV-001", issueDate: "2026-01-10", totalMinor: "100000" }),
        invoice("i-2", { number: "INV-002", issueDate: "2026-04-02", totalMinor: "25000" }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-02-01",
          amountMinor: "40000",
        }),
      ],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      startDate: "2026-04-01",
      endDate: AS_OF,
    });

    // The period shows only the April invoice, but the customer walked into April owing 60000, so
    // dropping the earlier lines must not drop the balance they produced.
    expect(statement.openingBalanceMinor).toBe("60000");
    expect(statement.items.map((item) => item.referenceNumber)).toEqual(["INV-002"]);
    expect(statement.closingBalanceMinor).toBe("85000");
    expect(statement.periodStart).toBe("2026-04-01");
  });

  it("excludes activity after the period end from the closing balance", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", { number: "INV-001", issueDate: "2026-01-10", totalMinor: "100000" }),
        invoice("i-2", { number: "INV-002", issueDate: "2026-07-05", totalMinor: "25000" }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-07-20",
          amountMinor: "40000",
        }),
      ],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    expect(statement.items.map((item) => item.referenceNumber)).toEqual(["INV-001"]);
    expect(statement.closingBalanceMinor).toBe("100000");
  });

  it("reports the business base currency and scale rather than a customer field", async () => {
    const { service } = buildService({ baseCurrency: "AED", currencyScale: 2 });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    expect(statement.currency).toBe("AED");
    expect(statement.currencyScale).toBe(2);
  });

  it("excludes other currencies from the totals and names them", async () => {
    const { service } = buildService({
      baseCurrency: "SAR",
      invoices: [
        invoice("i-1", { number: "INV-001", issueDate: "2026-01-10", totalMinor: "100000" }),
        invoice("i-2", {
          number: "INV-002",
          issueDate: "2026-02-10",
          totalMinor: "900000",
          currency: "USD",
        }),
      ],
    });

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    // Summing 900000 USD into a SAR total at an implied 1:1 rate would be a fabricated number.
    expect(statement.closingBalanceMinor).toBe("100000");
    expect(statement.otherCurrencies).toEqual(["USD"]);
    expect(statement.items).toHaveLength(1);
  });

  it("returns an empty settled statement when there is no activity", async () => {
    const { service } = buildService({});

    const statement = await service.customer("user-1", "biz-1", CUSTOMER.publicId, {
      endDate: AS_OF,
    });

    expect(statement.items).toEqual([]);
    expect(statement.openingBalanceMinor).toBe("0");
    expect(statement.closingBalanceMinor).toBe("0");
    expect(statement.buckets).toEqual({
      notDueMinor: "0",
      days1To30Minor: "0",
      days31To60Minor: "0",
      days61To90Minor: "0",
      daysOver90Minor: "0",
    });
  });

  it("raises NotFound for a customer outside the business", async () => {
    const { service } = buildService({ customer: null });

    await expect(service.customer("user-1", "biz-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("requires payments:read", async () => {
    const { service, assertAllowed } = buildService({});

    await service.customer("user-1", "biz-1", CUSTOMER.publicId, { endDate: AS_OF });

    expect(assertAllowed).toHaveBeenCalledWith(expect.anything(), "payments", "read");
  });
});

describe("StatementsService.receivables", () => {
  it("ages each invoice by its own due date", async () => {
    const { service } = buildService({
      invoices: [
        // 0 days late as of 2026-06-30 — due today is not late today.
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-06-01",
          dueDate: "2026-06-30",
          totalMinor: "10000",
        }),
        // 30 days late.
        invoice("i-2", {
          number: "INV-002",
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "20000",
        }),
        // 31 days late.
        invoice("i-3", {
          number: "INV-003",
          issueDate: "2026-05-01",
          dueDate: "2026-05-30",
          totalMinor: "30000",
        }),
        // 61 days late.
        invoice("i-4", {
          number: "INV-004",
          issueDate: "2026-04-01",
          dueDate: "2026-04-30",
          totalMinor: "40000",
        }),
        // 91 days late.
        invoice("i-5", {
          number: "INV-005",
          issueDate: "2026-03-01",
          dueDate: "2026-03-31",
          totalMinor: "50000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.buckets).toEqual({
      notDueMinor: "10000",
      days1To30Minor: "20000",
      days31To60Minor: "30000",
      days61To90Minor: "40000",
      daysOver90Minor: "50000",
    });
    // Every bucket is a sum of whole invoices, so they reconcile exactly to the total.
    expect(summary.totalOutstandingMinor).toBe("150000");
    expect(summary.totalOverdueMinor).toBe("140000");
  });

  it("ages an invoice with no due date from its issue date", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-06-15",
          dueDate: null,
          totalMinor: "10000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    // Treating a missing due date as "not yet due" would hide the oldest debts in the safest bucket.
    expect(summary.buckets.days1To30Minor).toBe("10000");
    expect(summary.buckets.notDueMinor).toBe("0");
    expect(summary.customers[0]!.oldestDueDate).toBe("2026-06-15");
  });

  it("drops a fully settled invoice from every bucket", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-01-01",
          dueDate: "2026-01-31",
          totalMinor: "10000",
        }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-02-01",
          amountMinor: "10000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.totalOutstandingMinor).toBe("0");
    expect(summary.customers).toEqual([]);
    expect(summary.buckets.daysOver90Minor).toBe("0");
  });

  it("nets a credit note off the invoice it was applied to", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "10000",
        }),
      ],
      creditNotes: [
        creditNoteAllocation({
          id: "cna-1",
          invoicePublicId: "i-1",
          number: "CN-001",
          date: "2026-06-01",
          amountMinor: "4000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.totalOutstandingMinor).toBe("6000");
    expect(summary.buckets.days1To30Minor).toBe("6000");
  });

  it("floors an overpaid invoice at zero instead of offsetting other debt", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-01-01",
          dueDate: "2026-01-31",
          totalMinor: "10000",
        }),
        invoice("i-2", {
          number: "INV-002",
          issueDate: "2026-06-01",
          dueDate: "2026-06-15",
          totalMinor: "5000",
        }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-02-01",
          amountMinor: "13000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    // The 3000 surplus on INV-001 must not quietly reduce the 5000 still owed on INV-002.
    expect(summary.totalOutstandingMinor).toBe("5000");
  });

  it("ignores settlement dated after the as-of date", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "10000",
        }),
      ],
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-07-15",
          amountMinor: "10000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.totalOutstandingMinor).toBe("10000");
  });

  it("groups by customer and leads with the largest debt", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "10000",
        }),
        invoice("i-2", {
          number: "INV-002",
          issueDate: "2026-05-02",
          dueDate: "2026-06-30",
          totalMinor: "70000",
          customer: OTHER_CUSTOMER,
        }),
        invoice("i-3", {
          number: "INV-003",
          issueDate: "2026-05-03",
          dueDate: "2026-06-30",
          totalMinor: "5000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.customers.map((customer) => customer.customerName)).toEqual([
      "Beta Works",
      "Acme Trading",
    ]);
    expect(summary.customers[1]!.outstandingMinor).toBe("15000");
    expect(summary.customers[1]!.openInvoiceCount).toBe(2);
    expect(summary.customers[1]!.oldestDueDate).toBe("2026-05-31");
    expect(summary.totalOutstandingMinor).toBe("85000");
  });

  it("excludes invoices issued after the as-of date", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-07-10",
          dueDate: "2026-08-10",
          totalMinor: "10000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.totalOutstandingMinor).toBe("0");
  });

  it("reads only issued credit notes", async () => {
    const { service, creditNoteAllocationFindMany } = buildService({});

    await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    const where = creditNoteAllocationFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect((where.creditNote as Record<string, unknown>).status).toEqual({ in: ["SENT"] });
  });

  it("counts only completed payments, so a reversed payment settles nothing (A7)", async () => {
    const { service, allocationFindMany } = buildService({});

    await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    // A voided receipt that still settled its invoice would hide a real debt in the one view a
    // business uses to decide who to chase. The status filter is the only thing preventing that.
    expect(allocationFindMany).toHaveBeenCalledTimes(1);
    const where = allocationFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect((where.payment as Record<string, unknown>).status).toBe("COMPLETED");
  });

  it("credits only the share a split payment applied to each invoice (A8)", async () => {
    const { service } = buildService({
      invoices: [
        invoice("i-1", {
          number: "INV-001",
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "60000",
        }),
        invoice("i-2", {
          number: "INV-002",
          issueDate: "2026-03-01",
          dueDate: "2026-03-31",
          totalMinor: "40000",
        }),
      ],
      // One receipt of 50000 spread across two invoices: 20000 to i-1, 30000 to i-2.
      payments: [
        paymentAllocation({
          id: "a-1",
          invoicePublicId: "i-1",
          reference: "RCP-001",
          date: "2026-06-01",
          amountMinor: "20000",
        }),
        paymentAllocation({
          id: "a-2",
          invoicePublicId: "i-2",
          reference: "RCP-001",
          date: "2026-06-01",
          amountMinor: "30000",
        }),
      ],
    });

    const summary = await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    // Each invoice keeps only its own share, so each ages in its own bucket for its own remainder.
    expect(summary.totalOutstandingMinor).toBe("50000");
    expect(summary.buckets).toEqual({
      // i-1 due 2026-05-31 is 30 days past AS_OF; i-2 due 2026-03-31 is 91 days past it.
      notDueMinor: "0",
      days1To30Minor: "40000",
      days31To60Minor: "0",
      days61To90Minor: "0",
      daysOver90Minor: "10000",
    });
  });

  it("requires payments:read (A11)", async () => {
    const { service, assertAllowed } = buildService({});

    await service.receivables("user-1", "biz-1", { asOf: AS_OF });

    expect(assertAllowed).toHaveBeenCalledWith(expect.anything(), "payments", "read");
  });
});
