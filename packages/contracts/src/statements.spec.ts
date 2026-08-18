import { describe, expect, it } from "vitest";

import {
  ageingBucketsSchema,
  customerStatementSchema,
  receivablesSummarySchema,
  statementLineItemSchema,
  statementQuerySchema,
} from "./statements.js";

const invoiceLine = {
  id: "line-1",
  date: "2026-08-01",
  type: "INVOICE",
  referenceNumber: "INV-0001",
  description: "Invoice INV-0001",
  dueDate: "2026-08-31",
  debitMinor: "150000",
  creditMinor: "0",
  balanceMinor: "150000",
  currency: "SAR",
  currencyScale: 2,
};

const paymentLine = {
  id: "line-2",
  date: "2026-08-02",
  type: "PAYMENT",
  referenceNumber: "RCP-0001",
  description: "Payment RCP-0001",
  dueDate: null,
  debitMinor: "0",
  creditMinor: "150000",
  balanceMinor: "0",
  currency: "SAR",
  currencyScale: 2,
};

const settledBuckets = {
  notDueMinor: "0",
  days1To30Minor: "0",
  days31To60Minor: "0",
  days61To90Minor: "0",
  daysOver90Minor: "0",
};

describe("Statement contracts", () => {
  it("validates statement line items", () => {
    expect(statementLineItemSchema.parse(invoiceLine)).toEqual(invoiceLine);
  });

  it("rejects a line dated as a timestamp rather than a day", () => {
    // Statements are reported in whole days; an instant would make two lines on the same day sort
    // by clock time, which is not information the business recorded.
    expect(
      statementLineItemSchema.safeParse({ ...invoiceLine, date: "2026-08-01T00:00:00.000Z" })
        .success,
    ).toBe(false);
  });

  it("allows a negative running balance when the customer is in credit", () => {
    expect(
      statementLineItemSchema.parse({ ...paymentLine, balanceMinor: "-5000" }).balanceMinor,
    ).toBe("-5000");
  });

  it("keeps a minor-unit amount above Number.MAX_SAFE_INTEGER intact as a string (ADR-0008)", () => {
    // 9007199254740993 (2^53 + 1) would round if parsed as a JS number; the string survives.
    const huge = "9007199254740993";
    expect(statementLineItemSchema.parse({ ...invoiceLine, balanceMinor: huge }).balanceMinor).toBe(
      huge,
    );
  });

  it("rejects a money amount that is not an integer string", () => {
    expect(
      statementLineItemSchema.safeParse({ ...invoiceLine, balanceMinor: 150000 }).success,
    ).toBe(false);
    expect(
      statementLineItemSchema.safeParse({ ...invoiceLine, balanceMinor: "1500.00" }).success,
    ).toBe(false);
  });

  it("validates a complete customer statement", () => {
    const statement = {
      customerId: "cust-123",
      customerName: "Acme Corp",
      currency: "SAR",
      currencyScale: 2,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      openingBalanceMinor: "0",
      totalInvoicedMinor: "150000",
      totalPaidMinor: "150000",
      totalCreditedMinor: "0",
      closingBalanceMinor: "0",
      asOf: "2026-08-31",
      buckets: settledBuckets,
      items: [invoiceLine, paymentLine],
      otherCurrencies: [],
    };

    expect(customerStatementSchema.parse(statement)).toEqual(statement);
  });

  it("validates a receivables summary", () => {
    const summary = {
      asOf: "2026-08-31",
      currency: "SAR",
      currencyScale: 2,
      totalOutstandingMinor: "150000",
      totalOverdueMinor: "150000",
      buckets: { ...settledBuckets, days1To30Minor: "150000" },
      customers: [
        {
          customerId: "cust-123",
          customerName: "Acme Corp",
          outstandingMinor: "150000",
          overdueMinor: "150000",
          openInvoiceCount: 1,
          oldestDueDate: "2026-08-01",
          buckets: { ...settledBuckets, days1To30Minor: "150000" },
        },
      ],
      otherCurrencies: ["USD"],
    };

    expect(receivablesSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects a negative bucket amount", () => {
    expect(ageingBucketsSchema.safeParse({ ...settledBuckets, days1To30Minor: "-1" }).success).toBe(
      false,
    );
  });

  it("rejects a period that ends before it starts", () => {
    expect(
      statementQuerySchema.safeParse({ startDate: "2026-08-31", endDate: "2026-08-01" }).success,
    ).toBe(false);
    expect(
      statementQuerySchema.safeParse({ startDate: "2026-08-01", endDate: "2026-08-31" }).success,
    ).toBe(true);
  });
});
