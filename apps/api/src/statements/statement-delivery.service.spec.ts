import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RoleCode } from "@bizo/database";

import { type CustomerStatement } from "@bizo/contracts/statements";

import { type DatabaseService } from "../database/database.service.js";
import { type PdfService } from "../documents/pdf.service.js";
import { type MailService } from "../mail/mail.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";
import { type StatementsService } from "./statements.service.js";
import { StatementDeliveryService } from "./statement-delivery.service.js";

const access: BusinessAccessContext = {
  businessId: 2n,
  businessPublicId: "ea056132-f071-43c4-b725-66b9998411aa",
  membershipId: 3n,
  role: RoleCode.OWNER,
  tenantId: 1n,
  tenantPublicId: "e8385805-a91b-4409-aad0-c093756bdb1b",
  userId: 4n,
  userPublicId: "e847ab9b-700e-4640-a3c7-75af19426954",
};

const customerId = "f3fb94c1-a48a-4f09-82fc-93477534b1f4";

function statement(): CustomerStatement {
  return {
    customerId,
    customerName: "Example Customer",
    currency: "SAR",
    currencyScale: 2,
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    openingBalanceMinor: "0",
    totalInvoicedMinor: "11500",
    totalPaidMinor: "0",
    totalCreditedMinor: "0",
    closingBalanceMinor: "11500",
    asOf: "2026-07-31",
    buckets: {
      notDueMinor: "11500",
      days1To30Minor: "0",
      days31To60Minor: "0",
      days61To90Minor: "0",
      daysOver90Minor: "0",
    },
    items: [
      {
        id: "line-1",
        date: "2026-07-05",
        type: "INVOICE",
        referenceNumber: "INV-0001",
        description: "Invoice INV-0001",
        dueDate: "2026-08-04",
        debitMinor: "11500",
        creditMinor: "0",
        balanceMinor: "11500",
        currency: "SAR",
        currencyScale: 2,
      },
    ],
    otherCurrencies: [],
  };
}

interface OutboxRow {
  id: string;
  payload: { idempotencyKey: string } & Record<string, unknown>;
  publishedAt: Date | null;
}

/**
 * A minimal transactional outbox backed by an in-memory array, so the dedupe query and the publish
 * update behave across calls the way the real table does: only a published row blocks a resend.
 */
function makeTransaction(rows: OutboxRow[], executeRaw?: ReturnType<typeof vi.fn>) {
  let sequence = 0;
  return {
    $executeRaw: executeRaw ?? vi.fn().mockResolvedValue(1),
    outboxEvent: {
      findFirst: vi.fn(async ({ where }: { where: { payload: { equals: string } } }) => {
        const key = where.payload.equals;
        return (
          rows.find((row) => row.publishedAt !== null && row.payload.idempotencyKey === key) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: { payload: OutboxRow["payload"] } }) => {
        sequence += 1;
        const row: OutboxRow = { id: `evt-${sequence}`, publishedAt: null, payload: data.payload };
        rows.push(row);
        return { id: row.id };
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: { publishedAt?: Date } }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (row && data.publishedAt) row.publishedAt = data.publishedAt;
          return row;
        },
      ),
    },
    business: {
      findUniqueOrThrow: vi.fn(async () => ({
        name: "Acme Services",
        legalName: null,
        email: "hello@acme.test",
        phone: null,
        addressLine1: "1 Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: "11564",
        taxProfile: { name: "VAT", registrationNumber: "300000000000003" },
      })),
    },
    customer: {
      findFirstOrThrow: vi.fn(async () => ({
        name: "Example Customer",
        email: "customer@example.test",
        phone: null,
        addressLine1: "King Fahd Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: null,
      })),
    },
  };
}

function makeService(overrides: {
  rows?: OutboxRow[];
  sendStatement?: ReturnType<typeof vi.fn>;
  assertAllowed?: ReturnType<typeof vi.fn>;
  customer?: ReturnType<typeof vi.fn>;
  executeRaw?: ReturnType<typeof vi.fn>;
}) {
  const rows = overrides.rows ?? [];
  const executeRaw = overrides.executeRaw ?? vi.fn().mockResolvedValue(1);
  const transaction = makeTransaction(rows, executeRaw);
  const database = {
    withScope: vi.fn(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
      work(transaction as never),
    ),
  } as unknown as DatabaseService;
  const assertAllowed = overrides.assertAllowed ?? vi.fn().mockResolvedValue(undefined);
  const businessAccess = {
    resolve: vi.fn().mockResolvedValue(access),
    assertAllowed,
  } as unknown as BusinessAccessService;
  const statements = {
    customer: overrides.customer ?? vi.fn().mockResolvedValue(statement()),
  } as unknown as StatementsService;
  const pdf = {
    renderStatement: vi.fn().mockResolvedValue(Buffer.from("%PDF-statement")),
  } as unknown as PdfService;
  const sendStatement = overrides.sendStatement ?? vi.fn().mockResolvedValue("mail-1");
  const mail = { sendStatement } as unknown as MailService;

  const service = new StatementDeliveryService(database, businessAccess, statements, pdf, mail);
  return { service, sendStatement, transaction, rows, assertAllowed, executeRaw };
}

describe("StatementDeliveryService", () => {
  it("emails the statement once and dedupes an identical resend", async () => {
    const { service, sendStatement } = makeService({});

    const first = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-1",
    );
    expect(first.status).toBe("SENT");
    expect(sendStatement).toHaveBeenCalledTimes(1);

    const second = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-2",
    );
    expect(second.status).toBe("ALREADY_SENT");
    // The second request must not put another message on the wire.
    expect(sendStatement).toHaveBeenCalledTimes(1);
    expect(second.sentAt).toBe(first.sentAt);
  });

  it("treats a different recipient as a distinct send", async () => {
    const { service, sendStatement } = makeService({});

    await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-1",
    );
    const other = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "accounts@example.test", message: null },
      "req-2",
    );

    expect(other.status).toBe("SENT");
    expect(sendStatement).toHaveBeenCalledTimes(2);
  });

  it("leaves the outbox row unpublished when the mail fails, so a resend is allowed", async () => {
    const failing = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue("mail-2");
    const { service, rows } = makeService({ sendStatement: failing });

    await expect(
      service.send(
        access.userPublicId,
        access.businessPublicId,
        customerId,
        { recipientEmail: "customer@example.test", message: null },
        "req-1",
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.publishedAt).toBeNull();

    // A retry now succeeds because no published row blocks it.
    const retry = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-2",
    );
    expect(retry.status).toBe("SENT");
  });

  // F3: emailing must require a send-capable permission. A read-only user whose "send" authorization
  // is denied cannot dispatch the statement, and no mail leaves.
  it("denies the send to a payments:read-only user and authorizes on the send action", async () => {
    const assertAllowed = vi.fn(async (_access: unknown, _object: unknown, action: string) => {
      if (action === "send") throw new NotFoundException("We could not find that resource.");
    });
    const { service, sendStatement } = makeService({ assertAllowed });

    await expect(
      service.send(
        access.userPublicId,
        access.businessPublicId,
        customerId,
        { recipientEmail: "customer@example.test", message: null },
        "req-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(assertAllowed).toHaveBeenCalledWith(access, "payments", "send");
    expect(sendStatement).not.toHaveBeenCalled();
  });

  // F4: a statement whose content has advanced (new asOf and balances) must re-send rather than be
  // wrongly deduped, even though the customer, period, and recipient are unchanged.
  it("re-sends when the statement content has advanced but dedupes identical content", async () => {
    const advanced = statement();
    advanced.asOf = "2026-08-31";
    advanced.totalPaidMinor = "5000";
    advanced.closingBalanceMinor = "6500";
    advanced.buckets.notDueMinor = "6500";
    const customer = vi
      .fn()
      .mockResolvedValueOnce(statement())
      .mockResolvedValueOnce(statement())
      .mockResolvedValueOnce(advanced);
    const { service, sendStatement } = makeService({ customer });

    const first = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-1",
    );
    expect(first.status).toBe("SENT");

    // Identical content dedupes.
    const identical = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-2",
    );
    expect(identical.status).toBe("ALREADY_SENT");
    expect(sendStatement).toHaveBeenCalledTimes(1);

    // Advanced content re-sends.
    const fresh = await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-3",
    );
    expect(fresh.status).toBe("SENT");
    expect(sendStatement).toHaveBeenCalledTimes(2);
  });

  // F5: the advisory lock keyed on the idempotency key is taken before the no-published-row check,
  // so identical concurrent sends serialize on it.
  it("acquires the advisory lock before checking for a published outbox row", async () => {
    const callOrder: string[] = [];
    const executeRaw = vi.fn().mockImplementation(async () => {
      callOrder.push("lock");
      return 1;
    });
    const { service, transaction } = makeService({ executeRaw });
    const findFirst = transaction.outboxEvent.findFirst;
    findFirst.mockImplementation(async () => {
      callOrder.push("check");
      return null;
    });

    await service.send(
      access.userPublicId,
      access.businessPublicId,
      customerId,
      { recipientEmail: "customer@example.test", message: null },
      "req-1",
    );

    expect(executeRaw).toHaveBeenCalled();
    expect(callOrder[0]).toBe("lock");
    expect(callOrder).toContain("check");
  });
});
