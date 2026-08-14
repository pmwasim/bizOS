import { describe, expect, it } from "vitest";

import { customerStatementSchema, statementLineItemSchema } from "./statements.js";

describe("Statement contracts", () => {
  it("validates statement line items", () => {
    const validItem = {
      id: "line-1",
      date: "2026-08-01T00:00:00.000Z",
      type: "INVOICE",
      referenceNumber: "INV-0001",
      description: "Service Invoice #INV-0001",
      debitMinor: 150000,
      creditMinor: 0,
      balanceMinor: 150000,
      currency: "SAR",
    };

    expect(statementLineItemSchema.parse(validItem)).toEqual(validItem);
  });

  it("validates complete customer statement structure", () => {
    const statement = {
      customerId: "cust-123",
      customerName: "Acme Corp",
      currency: "SAR",
      openingBalanceMinor: 0,
      totalInvoicedMinor: 150000,
      totalPaidMinor: 150000,
      closingBalanceMinor: 0,
      items: [
        {
          id: "line-1",
          date: "2026-08-01T00:00:00.000Z",
          type: "INVOICE",
          referenceNumber: "INV-0001",
          description: "Invoice #INV-0001",
          debitMinor: 150000,
          creditMinor: 0,
          balanceMinor: 150000,
          currency: "SAR",
        },
        {
          id: "line-2",
          date: "2026-08-02T00:00:00.000Z",
          type: "PAYMENT",
          referenceNumber: "PAY-0001",
          description: "Payment for INV-0001",
          debitMinor: 0,
          creditMinor: 150000,
          balanceMinor: 0,
          currency: "SAR",
        },
      ],
    };

    expect(customerStatementSchema.parse(statement)).toEqual(statement);
  });
});
