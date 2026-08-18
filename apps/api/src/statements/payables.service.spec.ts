import { describe, expect, it, vi } from "vitest";

import { PayablesService } from "./payables.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";

const SUPPLIER = { publicId: "s0000000-0000-4000-8000-000000000001", name: "Delta Supplies" };
const OTHER_SUPPLIER = { publicId: "s0000000-0000-4000-8000-000000000002", name: "Apex Cabling" };

/** The as-of date every test ages against, so no assertion depends on the day it is run. */
const AS_OF = "2026-06-30";

function bill(
  publicId: string,
  options: {
    issueDate: string;
    dueDate?: string | null;
    totalMinor: string;
    currency?: string;
    supplier?: { publicId: string; name: string } | null;
  },
) {
  return {
    publicId,
    issueDate: new Date(`${options.issueDate}T00:00:00.000Z`),
    dueDate:
      options.dueDate === undefined || options.dueDate === null
        ? null
        : new Date(`${options.dueDate}T00:00:00.000Z`),
    currencyCode: options.currency ?? "SAR",
    totalMinor: { toString: () => options.totalMinor },
    supplier: options.supplier === undefined ? SUPPLIER : options.supplier,
  };
}

function buildService(options: {
  bills?: unknown[];
  baseCurrency?: string;
  currencyScale?: number;
}) {
  const documentFindMany = vi.fn().mockResolvedValue(options.bills ?? []);

  const transaction = {
    business: {
      findFirst: vi.fn().mockResolvedValue({
        baseCurrency: options.baseCurrency ?? "SAR",
        currencyScale: options.currencyScale ?? 2,
      }),
    },
    document: { findMany: documentFindMany },
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

  const service = new PayablesService(
    database as unknown as DatabaseService,
    access as unknown as BusinessAccessService,
  );
  return { service, documentFindMany, assertAllowed };
}

describe("PayablesService.payables", () => {
  it("reads recorded supplier bills, which are the ones the business owes (B1)", async () => {
    const { service, documentFindMany } = buildService({});

    await service.payables("user-1", "biz-1", { asOf: AS_OF });

    // A recorded bill carries DRAFT — bizOS has no bill-approval transition — so DRAFT is what "owed"
    // looks like today. Filtering on SENT (which no bill ever reaches) left payables always empty.
    const where = documentFindMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.type).toBe("SUPPLIER_BILL");
    expect(where.status).toEqual({ in: ["DRAFT"] });
    expect(where.businessId).toBe(2n);
  });

  it("ages each bill by its own due date (B2)", async () => {
    const { service } = buildService({
      bills: [
        // Due on the as-of date is not late.
        bill("b-1", { issueDate: "2026-06-01", dueDate: "2026-06-30", totalMinor: "10000" }),
        bill("b-2", { issueDate: "2026-05-01", dueDate: "2026-05-31", totalMinor: "20000" }),
        bill("b-3", { issueDate: "2026-05-01", dueDate: "2026-05-30", totalMinor: "30000" }),
        bill("b-4", { issueDate: "2026-04-01", dueDate: "2026-04-30", totalMinor: "40000" }),
        bill("b-5", { issueDate: "2026-03-01", dueDate: "2026-03-31", totalMinor: "50000" }),
      ],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.buckets).toEqual({
      notDueMinor: "10000",
      days1To30Minor: "20000",
      days31To60Minor: "30000",
      days61To90Minor: "40000",
      daysOver90Minor: "50000",
    });
    // Buckets are sums of whole bills, so they reconcile exactly to the total (B4).
    expect(summary.totalOutstandingMinor).toBe("150000");
    expect(summary.totalOverdueMinor).toBe("140000");
  });

  it("ages a bill with no due date from its bill date (B3)", async () => {
    const { service } = buildService({
      bills: [bill("b-1", { issueDate: "2026-01-15", dueDate: null, totalMinor: "70000" })],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    // Treating a missing due date as "not yet due" would file the oldest debt in the safest bucket.
    expect(summary.buckets.notDueMinor).toBe("0");
    expect(summary.buckets.daysOver90Minor).toBe("70000");
  });

  it("excludes bills dated after the as-of date (B5)", async () => {
    const { service } = buildService({
      bills: [bill("b-1", { issueDate: "2026-07-10", dueDate: "2026-08-10", totalMinor: "10000" })],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.totalOutstandingMinor).toBe("0");
    expect(summary.suppliers).toEqual([]);
  });

  it("excludes other currencies from the totals and names them (B6)", async () => {
    const { service } = buildService({
      baseCurrency: "SAR",
      bills: [
        bill("b-1", { issueDate: "2026-05-01", dueDate: "2026-05-31", totalMinor: "10000" }),
        bill("b-2", {
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "999999",
          currency: "USD",
        }),
      ],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    // There is no rate source, so a USD bill is named rather than summed at an implied 1:1 rate.
    expect(summary.currency).toBe("SAR");
    expect(summary.totalOutstandingMinor).toBe("10000");
    expect(summary.otherCurrencies).toEqual(["USD"]);
  });

  it("groups by supplier and leads with the largest balance (B7)", async () => {
    const { service } = buildService({
      bills: [
        bill("b-1", { issueDate: "2026-05-01", dueDate: "2026-05-31", totalMinor: "10000" }),
        bill("b-2", { issueDate: "2026-04-01", dueDate: "2026-04-30", totalMinor: "5000" }),
        bill("b-3", {
          issueDate: "2026-05-01",
          dueDate: "2026-05-31",
          totalMinor: "70000",
          supplier: OTHER_SUPPLIER,
        }),
      ],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    expect(summary.suppliers.map((supplier) => supplier.supplierName)).toEqual([
      "Apex Cabling",
      "Delta Supplies",
    ]);
    expect(summary.suppliers[1]!.outstandingMinor).toBe("15000");
    expect(summary.suppliers[1]!.openBillCount).toBe(2);
    expect(summary.suppliers[1]!.oldestDueDate).toBe("2026-04-30");
    expect(summary.totalOutstandingMinor).toBe("85000");
  });

  it("requires payments:read (B8)", async () => {
    const { service, assertAllowed } = buildService({});

    await service.payables("user-1", "biz-1", { asOf: AS_OF });

    expect(assertAllowed).toHaveBeenCalledWith(expect.anything(), "payments", "read");
  });

  it("reports that partial settlement is not supported", async () => {
    const { service } = buildService({
      bills: [bill("b-1", { issueDate: "2026-05-01", dueDate: "2026-05-31", totalMinor: "10000" })],
    });

    const summary = await service.payables("user-1", "biz-1", { asOf: AS_OF });

    // bizOS records no outbound payment, so a bill is outstanding in full or settled in full.
    // The flag exists so the surface can say that rather than implying these totals net
    // part-payments.
    expect(summary.partialSettlementSupported).toBe(false);
  });
});
