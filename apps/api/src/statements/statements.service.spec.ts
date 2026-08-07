import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service.js";
import type { BusinessAccessService } from "../security/business-access.service.js";
import { StatementsService } from "./statements.service.js";

describe("StatementsService", () => {
  it("calculates running balances and totals correctly for customer statements", async () => {
    const mockDb = {
      withScope: vi.fn((_access, callback) =>
        callback({
          customer: {
            findFirst: vi.fn().mockResolvedValue({
              id: 1n,
              publicId: "cust-1",
              name: "Test Customer",
              currencyCode: "SAR",
            }),
          },
          document: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 10n,
                publicId: "inv-100",
                number: "INV-001",
                type: "INVOICE",
                totalMinor: 150000n,
                currencyCode: "SAR",
                issuedAt: new Date("2026-08-01T10:00:00.000Z"),
                createdAt: new Date("2026-08-01T10:00:00.000Z"),
              },
            ]),
          },
          payment: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 20n,
                publicId: "pay-200",
                paymentNumber: "PAY-001",
                type: "RECEIPT",
                amountMinor: 50000n,
                currencyCode: "SAR",
                paymentDate: new Date("2026-08-02T10:00:00.000Z"),
                reference: "REF-123",
              },
            ]),
          },
        }),
      ),
    };

    const mockAccess = {
      resolve: vi.fn().mockResolvedValue({
        userId: "user-1",
        businessId: 1n,
        tenantId: 1n,
      }),
    };

    const service = new StatementsService(
      mockDb as unknown as DatabaseService,
      mockAccess as unknown as BusinessAccessService,
    );
    const result = await service.getCustomerStatement("user-1", "biz-1", "cust-1");

    expect(result.customerName).toBe("Test Customer");
    expect(result.totalInvoicedMinor).toBe(150000);
    expect(result.totalPaidMinor).toBe(50000);
    expect(result.closingBalanceMinor).toBe(100000);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.debitMinor).toBe(150000);
    expect(result.items[1]?.creditMinor).toBe(50000);
    expect(result.items[1]?.balanceMinor).toBe(100000);
  });
});
