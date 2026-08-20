import { type Prisma } from "@bizo/database";
import { describe, expect, it, vi } from "vitest";

import { allocateDocumentNumber } from "./numbering.js";

/**
 * A stateful stand-in for the atomic `businessSettings.update` counter bump. Each call increments
 * the stored value and returns it, exactly as `UPDATE … SET next = next + 1 RETURNING next` would.
 */
const makeCountingTx = (
  options: { prefixField: string; nextField: string; prefix: string; padWidth?: number | null } & {
    stored?: number;
    extra?: Record<string, unknown>;
  },
): { tx: Prisma.TransactionClient; update: ReturnType<typeof vi.fn> } => {
  // Mirrors the database default of 1 for a fresh counter; the atomic bump returns the incremented
  // value, so the first allocation yields sequence 1.
  let stored = options.stored ?? 1;
  const update = vi.fn(async () => {
    stored += 1;
    return {
      [options.nextField]: stored,
      [options.prefixField]: options.prefix,
      numberPadWidth: options.padWidth === undefined ? 4 : options.padWidth,
      ...options.extra,
    };
  });
  const tx = { businessSettings: { update } } as unknown as Prisma.TransactionClient;
  return { tx, update };
};

describe("allocateDocumentNumber", () => {
  it("applies the configured prefix and zero-padding width", async () => {
    const { tx } = makeCountingTx({
      prefixField: "invoicePrefix",
      nextField: "nextInvoiceNumber",
      prefix: "AX",
      padWidth: 5,
    });

    const allocated = await allocateDocumentNumber(tx, 1n, "INVOICE");

    expect(allocated.prefix).toBe("AX");
    expect(allocated.padWidth).toBe(5);
    expect(allocated.sequence).toBe(1);
    expect(allocated.number).toBe("AX-00001");
  });

  it("increments the number on each sequential allocation", async () => {
    const { tx } = makeCountingTx({
      prefixField: "salesOrderPrefix",
      nextField: "nextSalesOrderNumber",
      prefix: "SO",
    });

    const first = await allocateDocumentNumber(tx, 1n, "SALES_ORDER");
    const second = await allocateDocumentNumber(tx, 1n, "SALES_ORDER");
    const third = await allocateDocumentNumber(tx, 1n, "SALES_ORDER");

    expect([first.number, second.number, third.number]).toEqual(["SO-0001", "SO-0002", "SO-0003"]);
  });

  it("targets the counter column that matches the document type", async () => {
    const { tx, update } = makeCountingTx({
      prefixField: "creditNotePrefix",
      nextField: "nextCreditNoteNumber",
      prefix: "CN",
    });

    await allocateDocumentNumber(tx, 7n, "CREDIT_NOTE");

    const args = update.mock.calls[0]![0] as {
      where: { businessId: bigint };
      data: Record<string, unknown>;
    };
    expect(args.where.businessId).toBe(7n);
    expect(args.data).toHaveProperty("nextCreditNoteNumber");
    expect(args.data.nextCreditNoteNumber).toEqual({ increment: 1 });
  });

  it("falls back to the default pad width when the column is null", async () => {
    const { tx } = makeCountingTx({
      prefixField: "invoicePrefix",
      nextField: "nextInvoiceNumber",
      prefix: "INV",
      padWidth: null,
    });

    const allocated = await allocateDocumentNumber(tx, 1n, "INVOICE");

    expect(allocated.padWidth).toBe(4);
    expect(allocated.number).toBe("INV-0001");
  });

  it("returns extra selected settings columns for the caller", async () => {
    const { tx } = makeCountingTx({
      prefixField: "invoicePrefix",
      nextField: "nextInvoiceNumber",
      prefix: "INV",
      extra: { invoiceDueDays: 45 },
    });

    const allocated = await allocateDocumentNumber(tx, 1n, "INVOICE", { invoiceDueDays: true });

    expect(allocated.settings.invoiceDueDays).toBe(45);
  });
});
