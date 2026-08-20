import { describe, expect, it } from "vitest";

import { PdfService } from "./pdf.service.js";
import { type QuotationSnapshot } from "./quotation-snapshot.js";
import { type ReceiptSnapshot } from "./receipt-snapshot.js";
import { type StatementSnapshot } from "./statement-snapshot.js";

const snapshot: QuotationSnapshot = {
  business: {
    name: "Acme Services",
    legalName: "Acme Services LLC",
    email: "hello@acme.test",
    phone: "+966 50 000 0000",
    address: ["Riyadh", "Saudi Arabia"],
    taxName: "VAT",
    taxRegistrationNumber: "300000000000003",
  },
  customer: {
    name: "Example Customer",
    email: "customer@example.test",
    phone: null,
    address: ["King Fahd Road", "Riyadh"],
  },
  number: "Q-0001",
  issueDate: "2026-07-27",
  validUntil: "2026-08-26",
  currencyCode: "SAR",
  currencyScale: 2,
  subtotalMinor: "10000",
  taxMinor: "1500",
  totalMinor: "11500",
  lines: [
    {
      position: 1,
      description: "Professional services",
      quantity: "1",
      unitPriceMinor: "10000",
      taxRatePpm: 150000,
      subtotalMinor: "10000",
      taxMinor: "1500",
      totalMinor: "11500",
    },
  ],
};

describe("PdfService", () => {
  it("renders a non-empty PDF from the immutable quotation snapshot", async () => {
    const result = await new PdfService().renderQuotation(snapshot);

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a non-empty invoice PDF with PO metadata", async () => {
    const result = await new PdfService().renderInvoice({
      ...snapshot,
      number: "INV-0001",
      dueDate: "2026-08-26",
      poNumber: "PO-100",
      projectReference: "Job A",
    });

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a non-empty statement PDF, including a customer-in-credit negative balance", async () => {
    const result = await new PdfService().renderStatement(statementSnapshot);

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a statement with no activity in the period", async () => {
    const result = await new PdfService().renderStatement({
      ...statementSnapshot,
      lines: [],
      periodStart: null,
      periodEnd: null,
    });

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a non-empty receipt PDF with invoice allocations and remaining balances", async () => {
    const result = await new PdfService().renderReceipt(receiptSnapshot);

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });

  it("renders a receipt with a surplus left on account and no customer", async () => {
    const result = await new PdfService().renderReceipt({
      ...receiptSnapshot,
      customer: null,
      allocations: [],
      allocatedMinor: "0",
      unallocatedMinor: "11500",
      notes: null,
    });

    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.byteLength).toBeGreaterThan(1_000);
  });
});

const statementSnapshot: StatementSnapshot = {
  business: {
    name: "Acme Services",
    legalName: "Acme Services LLC",
    email: "hello@acme.test",
    phone: "+966 50 000 0000",
    address: ["Riyadh", "Saudi Arabia"],
    taxName: "VAT",
    taxRegistrationNumber: "300000000000003",
  },
  customer: {
    name: "Example Customer",
    email: "customer@example.test",
    phone: null,
    address: ["King Fahd Road", "Riyadh"],
  },
  currencyCode: "SAR",
  currencyScale: 2,
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  asOf: "2026-07-31",
  openingBalanceMinor: "5000",
  totalInvoicedMinor: "11500",
  totalPaidMinor: "20000",
  totalCreditedMinor: "0",
  closingBalanceMinor: "-3500",
  lines: [
    {
      date: "2026-07-05",
      description: "Invoice INV-0001",
      reference: "INV-0001",
      debitMinor: "11500",
      creditMinor: "0",
      balanceMinor: "16500",
    },
    {
      date: "2026-07-20",
      description: "Payment REF-9",
      reference: "REF-9",
      debitMinor: "0",
      creditMinor: "20000",
      balanceMinor: "-3500",
    },
  ],
  buckets: {
    notDueMinor: "0",
    days1To30Minor: "0",
    days31To60Minor: "0",
    days61To90Minor: "0",
    daysOver90Minor: "0",
  },
  otherCurrencies: ["USD"],
};

const receiptSnapshot: ReceiptSnapshot = {
  business: {
    name: "Acme Services",
    legalName: "Acme Services LLC",
    email: "hello@acme.test",
    phone: "+966 50 000 0000",
    address: ["Riyadh", "Saudi Arabia"],
    taxName: "VAT",
    taxRegistrationNumber: "300000000000003",
  },
  customer: {
    name: "Example Customer",
    email: "customer@example.test",
    phone: null,
    address: ["King Fahd Road", "Riyadh"],
  },
  currencyCode: "SAR",
  currencyScale: 2,
  receiptNumber: "RCPT-1A2B3C4D",
  reference: "TXN-889",
  paymentDate: "2026-07-20",
  method: "Payment received",
  status: "Completed",
  notes: "Received with thanks.",
  amountMinor: "11500",
  allocatedMinor: "11500",
  unallocatedMinor: "0",
  allocations: [
    {
      kind: "INVOICE",
      reference: "INV-0001",
      amountMinor: "8000",
      remainingMinor: "3500",
    },
    {
      kind: "INVOICE",
      reference: "INV-0002",
      amountMinor: "3500",
      remainingMinor: "0",
    },
  ],
};
