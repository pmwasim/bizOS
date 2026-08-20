import { describe, expect, it, vi } from "vitest";

import { toReturnSummaryCsv } from "./audit-export.js";
import { TaxSummaryService } from "./tax.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type BusinessAccessService } from "../security/business-access.service.js";

/**
 * A stored document, as the aggregation reads it: money as minor-unit decimals, one counterparty.
 * `type`/`status` mirror the Prisma columns so the where-clause assertions bite on real filters.
 */
function doc(options: {
  publicId: string;
  type: "INVOICE" | "SUPPLIER_BILL";
  status?: "DRAFT" | "SENT" | "ARCHIVED";
  number: string;
  issueDate: string;
  currency?: string;
  currencyScale?: number;
  subtotalMinor: string;
  taxMinor: string;
  totalMinor: string;
  partyName?: string;
}) {
  const isInvoice = options.type === "INVOICE";
  return {
    publicId: options.publicId,
    type: options.type,
    status: options.status ?? "SENT",
    number: options.number,
    issueDate: new Date(`${options.issueDate}T00:00:00.000Z`),
    currencyCode: options.currency ?? "SAR",
    currencyScale: options.currencyScale ?? 2,
    subtotalMinor: { toString: () => options.subtotalMinor },
    taxMinor: { toString: () => options.taxMinor },
    totalMinor: { toString: () => options.totalMinor },
    customer: isInvoice ? { name: options.partyName ?? "A Customer" } : null,
    supplier: isInvoice ? null : { name: options.partyName ?? "A Supplier" },
  };
}

function buildService(options: {
  documents?: ReturnType<typeof doc>[];
  countryCode?: string;
  baseCurrency?: string;
  currencyScale?: number;
}) {
  const all = options.documents ?? [];
  // The service queries invoices and bills separately; the mock filters the seeded rows the same way
  // the database would, so status/type filtering is exercised rather than assumed.
  const documentFindMany = vi
    .fn()
    .mockImplementation((args: { where: Record<string, unknown> }) => {
      const where = args.where;
      return Promise.resolve(
        all.filter((row) => row.type === where.type && row.status === where.status),
      );
    });

  const transaction = {
    business: {
      findFirst: vi.fn().mockResolvedValue({
        countryCode: options.countryCode ?? "SA",
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

  const service = new TaxSummaryService(
    database as unknown as DatabaseService,
    access as unknown as BusinessAccessService,
  );
  return { service, documentFindMany, assertAllowed };
}

function currency(summary: Awaited<ReturnType<TaxSummaryService["taxReturn"]>>, code: string) {
  return summary.summary.currencies.find((entry) => entry.currency === code);
}

describe("TaxSummaryService.taxReturn", () => {
  it("nets output tax (SENT invoices) against input tax (APPROVED bills) — Saudi VAT", async () => {
    const { service } = buildService({
      countryCode: "SA",
      baseCurrency: "SAR",
      documents: [
        doc({
          publicId: "i-1",
          type: "INVOICE",
          number: "INV-1",
          issueDate: "2026-02-10",
          subtotalMinor: "100000",
          taxMinor: "15000",
          totalMinor: "115000",
        }),
        doc({
          publicId: "b-1",
          type: "SUPPLIER_BILL",
          number: "BILL-1",
          issueDate: "2026-02-12",
          subtotalMinor: "40000",
          taxMinor: "6000",
          totalMinor: "46000",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});

    expect(result.summary.countryCode).toBe("SA");
    expect(result.summary.taxSystem).toBe("VAT");
    expect(result.summary.taxAuthority).toBe("ZATCA");
    expect(result.summary.standardRatePpm).toBe(150_000);

    const sar = currency(result, "SAR")!;
    expect(sar.outputTaxMinor).toBe("15000");
    expect(sar.inputTaxMinor).toBe("6000");
    // Net VAT due = 15000 output − 6000 input = 9000 payable.
    expect(sar.netTaxMinor).toBe("9000");
    expect(sar.netPosition).toBe("PAYABLE");
    expect(sar.salesCount).toBe(1);
    expect(sar.purchaseCount).toBe(1);
    // The net box reconciles to output − input.
    expect(sar.boxes.find((box) => box.source === "NET_TAX")!.amountMinor).toBe("9000");
  });

  it("reports a refund when input tax exceeds output tax — UAE VAT at 5%", async () => {
    const { service } = buildService({
      countryCode: "AE",
      baseCurrency: "AED",
      documents: [
        doc({
          publicId: "i-1",
          type: "INVOICE",
          number: "INV-1",
          issueDate: "2026-02-10",
          currency: "AED",
          subtotalMinor: "20000",
          taxMinor: "1000",
          totalMinor: "21000",
        }),
        doc({
          publicId: "b-1",
          type: "SUPPLIER_BILL",
          number: "BILL-1",
          issueDate: "2026-02-12",
          currency: "AED",
          subtotalMinor: "60000",
          taxMinor: "3000",
          totalMinor: "63000",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});
    expect(result.summary.taxAuthority).toBe("Federal Tax Authority");
    const aed = currency(result, "AED")!;
    // 1000 output − 3000 input = −2000, a refund.
    expect(aed.netTaxMinor).toBe("-2000");
    expect(aed.netPosition).toBe("REFUNDABLE");
  });

  it("labels the return for India GST", async () => {
    const { service } = buildService({
      countryCode: "IN",
      baseCurrency: "INR",
      documents: [
        doc({
          publicId: "i-1",
          type: "INVOICE",
          number: "INV-1",
          issueDate: "2026-02-10",
          currency: "INR",
          subtotalMinor: "100000",
          taxMinor: "18000",
          totalMinor: "118000",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});
    expect(result.summary.taxSystem).toBe("GST");
    expect(result.summary.returnName).toBe("GSTR-3B Summary");
    const inr = currency(result, "INR")!;
    expect(inr.netPosition).toBe("PAYABLE");
    expect(inr.boxes.some((box) => /input tax credit/i.test(box.label))).toBe(true);
  });

  it("keeps each currency separate and never nets across them (per-currency, fail-closed)", async () => {
    const { service } = buildService({
      countryCode: "SA",
      baseCurrency: "SAR",
      documents: [
        doc({
          publicId: "i-1",
          type: "INVOICE",
          number: "INV-1",
          issueDate: "2026-02-10",
          currency: "SAR",
          subtotalMinor: "100000",
          taxMinor: "15000",
          totalMinor: "115000",
        }),
        doc({
          publicId: "i-2",
          type: "INVOICE",
          number: "INV-2",
          issueDate: "2026-02-11",
          currency: "USD",
          subtotalMinor: "50000",
          taxMinor: "0",
          totalMinor: "50000",
        }),
        doc({
          publicId: "b-1",
          type: "SUPPLIER_BILL",
          number: "BILL-1",
          issueDate: "2026-02-12",
          currency: "USD",
          subtotalMinor: "20000",
          taxMinor: "3000",
          totalMinor: "23000",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});

    // Two independent currency blocks; the base currency (SAR) leads.
    expect(result.summary.currencies.map((entry) => entry.currency)).toEqual(["SAR", "USD"]);
    expect(result.summary.currencies[0]!.isBaseCurrency).toBe(true);

    const sar = currency(result, "SAR")!;
    const usd = currency(result, "USD")!;
    // SAR nets to 15000 payable; USD nets to 0 output − 3000 input = −3000 refundable. Neither figure
    // bleeds into the other — there is no single blended total (ADR-0024).
    expect(sar.netTaxMinor).toBe("15000");
    expect(usd.netTaxMinor).toBe("-3000");
    expect(usd.netPosition).toBe("REFUNDABLE");
  });

  it("counts only SENT invoices and SENT (APPROVED) bills, excluding drafts", async () => {
    const { service, documentFindMany } = buildService({
      countryCode: "SA",
      documents: [
        doc({
          publicId: "i-sent",
          type: "INVOICE",
          status: "SENT",
          number: "INV-1",
          issueDate: "2026-02-10",
          subtotalMinor: "100000",
          taxMinor: "15000",
          totalMinor: "115000",
        }),
        doc({
          publicId: "i-draft",
          type: "INVOICE",
          status: "DRAFT",
          number: "INV-2",
          issueDate: "2026-02-10",
          subtotalMinor: "999999",
          taxMinor: "999999",
          totalMinor: "999999",
        }),
        doc({
          publicId: "b-approved",
          type: "SUPPLIER_BILL",
          status: "SENT",
          number: "BILL-1",
          issueDate: "2026-02-12",
          subtotalMinor: "40000",
          taxMinor: "6000",
          totalMinor: "46000",
        }),
        doc({
          publicId: "b-draft",
          type: "SUPPLIER_BILL",
          status: "DRAFT",
          number: "BILL-2",
          issueDate: "2026-02-12",
          subtotalMinor: "999999",
          taxMinor: "999999",
          totalMinor: "999999",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});

    // The query itself filters on SENT for both document types.
    for (const call of documentFindMany.mock.calls) {
      expect((call[0].where as Record<string, unknown>).status).toBe("SENT");
    }

    const sar = currency(result, "SAR")!;
    // Only the SENT invoice and APPROVED (SENT) bill are counted; the drafts are excluded entirely.
    expect(sar.outputTaxMinor).toBe("15000");
    expect(sar.inputTaxMinor).toBe("6000");
    expect(sar.salesCount).toBe(1);
    expect(sar.purchaseCount).toBe(1);
    expect(result.documents.map((document) => document.id).sort()).toEqual([
      "b-approved",
      "i-sent",
    ]);
  });

  it("passes a period filter through to the issue-date query", async () => {
    const { service, documentFindMany } = buildService({ countryCode: "SA" });

    await service.taxReturn("user-1", "biz-1", {
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });

    const where = documentFindMany.mock.calls[0]![0].where as {
      issueDate?: { gte?: Date; lte?: Date };
    };
    expect(where.issueDate?.gte?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(where.issueDate?.lte?.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("fails closed for a country with no shipped tax pack", async () => {
    const { service } = buildService({ countryCode: "US", baseCurrency: "USD" });

    // No regime is defined for the country, so the return is refused rather than fabricated.
    await expect(service.taxReturn("user-1", "biz-1", {})).rejects.toMatchObject({
      response: { code: "TAX_COUNTRY_UNSUPPORTED" },
    });
  });

  it("authorizes the read with invoices:read", async () => {
    const { service, assertAllowed } = buildService({ countryCode: "SA" });

    await service.taxReturn("user-1", "biz-1", {});

    expect(assertAllowed).toHaveBeenCalledWith(expect.anything(), "invoices", "read");
  });

  it("produces a return-summary CSV whose box amounts reconcile to the service figures", async () => {
    const { service } = buildService({
      countryCode: "SA",
      baseCurrency: "SAR",
      documents: [
        doc({
          publicId: "i-1",
          type: "INVOICE",
          number: "INV-1",
          issueDate: "2026-02-10",
          subtotalMinor: "100000",
          taxMinor: "15000",
          totalMinor: "115000",
        }),
        doc({
          publicId: "b-1",
          type: "SUPPLIER_BILL",
          number: "BILL-1",
          issueDate: "2026-02-12",
          subtotalMinor: "40000",
          taxMinor: "6000",
          totalMinor: "46000",
        }),
      ],
    });

    const result = await service.taxReturn("user-1", "biz-1", {});
    const sar = currency(result, "SAR")!;
    const csv = toReturnSummaryCsv(result.summary);

    // Parse the CSV back into rows and confirm each SAR box amount equals the service's own figure —
    // the export is a pure view over the aggregation, never a re-computation of it.
    const rows = csv
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((line) => line.split(","));
    const amountByCode = new Map(
      rows.filter((cells) => cells[2] === "SAR").map((cells) => [cells[5], cells[8]] as const),
    );
    expect(amountByCode.get("1")).toBe(sar.outputTaxableBaseMinor);
    expect(amountByCode.get("1-VAT")).toBe(sar.outputTaxMinor);
    expect(amountByCode.get("7")).toBe(sar.inputTaxableBaseMinor);
    expect(amountByCode.get("7-VAT")).toBe(sar.inputTaxMinor);
    expect(amountByCode.get("14")).toBe(sar.netTaxMinor);
    // And the boxes the CSV rendered are exactly the boxes the service put on the summary.
    for (const box of sar.boxes) {
      expect(amountByCode.get(box.code)).toBe(box.amountMinor);
    }
  });
});
