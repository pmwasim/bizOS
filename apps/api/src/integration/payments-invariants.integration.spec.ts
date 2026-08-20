import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DocumentStatus,
  DocumentType,
  InvoiceApprovalStatus,
  PaymentStatus,
  PurchaseOrderStatus,
  StoredObjectKind,
} from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { CustomersService } from "../customers/customers.service.js";
import { DatabaseService } from "../database/database.service.js";
import { InvoicesService } from "../documents/invoices.service.js";
import { PdfService } from "../documents/pdf.service.js";
import { QuotationsService } from "../documents/quotations.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { type MailService } from "../mail/mail.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { type ObjectStore } from "@bizo/storage";

/**
 * Verification gate for the Sprint-4 payments engine: the accounting invariants that must hold
 * against a real PostgreSQL boundary, not just against unit mocks. Each `INV-*` block below states a
 * guarantee in plain terms and then proves it end-to-end — seed real invoices, record real payments,
 * derive settlement from `payment_allocations`, and assert the money never leaks.
 *
 * These deliberately do NOT re-prove what the service-level unit specs already cover
 * (`payments.service.spec.ts`, `payments-stress.spec.ts`, `contracts/payments.spec.ts`); they add the
 * cross-cutting, real-DB coverage those mocks cannot give — advisory-lock serialization, RLS-scoped
 * transactions, `Decimal(38,0)` round-tripping, and the append-only refund ledger on disk.
 *
 * Gated on RUN_DATABASE_TESTS like the rest of the integration suite so a plain `vitest run` stays
 * hermetic.
 */
const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("payments accounting invariants (PostgreSQL)", () => {
  let database: DatabaseService;
  let accessService: BusinessAccessService;
  let identity: IdentityService;
  let platform: PlatformService;
  let customers: CustomersService;
  let quotations: QuotationsService;
  let invoices: InvoicesService;
  let payments: PaymentsService;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    accessService = new BusinessAccessService(database);
    const configuration = new ConfigurationService(database, accessService);
    identity = new IdentityService(database, {
      sendPasswordReset: async () => "test-message-id",
    } as never);
    platform = new PlatformService(database, accessService, configuration);
    customers = new CustomersService(database, accessService, {
      isConfigured: () => false,
    } as never);
    const mail = {
      sendQuotation: vi.fn().mockResolvedValue("invariants-quotation-1"),
      sendInvoice: vi.fn().mockResolvedValue("invariants-invoice-1"),
    };
    const objectStore: ObjectStore = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi
        .fn()
        .mockResolvedValue({ body: Buffer.from("%PDF-stored"), contentType: "application/pdf" }),
    } as unknown as ObjectStore;
    quotations = new QuotationsService(
      database,
      accessService,
      new PdfService(),
      mail as unknown as MailService,
      { isConfigured: () => false } as never,
      configuration,
    );
    invoices = new InvoicesService(
      database,
      accessService,
      new PdfService(),
      mail as unknown as MailService,
      objectStore,
      { isConfigured: () => false } as never,
      configuration,
    );
    payments = new PaymentsService(database, accessService, new PdfService());
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  let businessSeq = 0;

  /**
   * A fresh owner + business + customer, isolated per call so RLS boundaries and per-business figures
   * never blend across tests. Base currency SAR, scale 2, tax disabled so invoice totals equal the
   * line arithmetic exactly.
   */
  async function seedBusiness() {
    businessSeq += 1;
    const unique = `${Date.now()}-${businessSeq}`;
    const owner = await identity.signUp({
      displayName: "Invariants Owner",
      email: `invariants-owner-${unique}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: `Invariants Co ${unique}`,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      `invariants-business-${unique}`,
    );
    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: "Invariants Customer",
        email: "invariants-customer@example.test",
        phone: null,
        addressLine1: "King Fahd Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: null,
        countryCode: "SA",
      },
      `invariants-customer-${unique}`,
    );
    return { owner, business, customer };
  }

  /**
   * Seed a READY_TO_SEND invoice from an approved quotation with the same PO + evidence gate the
   * invoice journey uses, then create the invoice. `lines` control the total exactly.
   */
  async function seedInvoice(
    context: Awaited<ReturnType<typeof seedBusiness>>,
    lines: Array<{ description: string; quantity: string; unitPrice: string }>,
  ) {
    const { owner, business, customer } = context;
    const quotation = await quotations.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: lines.map((line) => ({ ...line, taxRatePercent: "0" })),
      },
      `invariants-quotation-${Date.now()}-${Math.random()}`,
    );

    const accessCtx = await accessService.resolve(owner.id, business.id);
    await database.withScope(accessCtx, async (transaction) => {
      const quotationRow = await transaction.document.findFirstOrThrow({
        where: { publicId: quotation.id },
      });
      const customerRow = await transaction.customer.findFirstOrThrow({
        where: { publicId: customer.id },
      });
      const purchaseOrder = await transaction.purchaseOrder.create({
        data: {
          tenantId: accessCtx.tenantId,
          businessId: accessCtx.businessId,
          customerId: customerRow.id,
          quotationId: quotationRow.id,
          poNumber: `PO-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          status: PurchaseOrderStatus.ACTIVE,
          approvalStatus: InvoiceApprovalStatus.APPROVED,
          approvalChangedAt: new Date(),
          approvalChangedByUserId: accessCtx.userId,
          createdByMembershipId: accessCtx.membershipId,
        },
      });
      await transaction.storedObject.create({
        data: {
          tenantId: accessCtx.tenantId,
          businessId: accessCtx.businessId,
          purchaseOrderId: purchaseOrder.id,
          kind: StoredObjectKind.PURCHASE_ORDER,
          storageKey: `tenants/t/businesses/b/purchase-orders/${purchaseOrder.publicId}/f/po.pdf`,
          originalFilename: "po.pdf",
          contentType: "application/pdf",
          byteSize: 12,
          checksumSha256: "a".repeat(64),
          uploadedByUserId: accessCtx.userId,
        },
      });
      await transaction.storedObject.create({
        data: {
          tenantId: accessCtx.tenantId,
          businessId: accessCtx.businessId,
          purchaseOrderId: purchaseOrder.id,
          kind: StoredObjectKind.APPROVAL_EVIDENCE,
          storageKey: `tenants/t/businesses/b/approval-evidence/${purchaseOrder.publicId}/f/ev.pdf`,
          originalFilename: "ev.pdf",
          contentType: "application/pdf",
          byteSize: 12,
          checksumSha256: "b".repeat(64),
          uploadedByUserId: accessCtx.userId,
        },
      });
    });

    const invoice = await invoices.createFromQuotation(
      owner.id,
      business.id,
      { quotationId: quotation.id },
      `invariants-invoice-${Date.now()}-${Math.random()}`,
    );
    return invoice;
  }

  type Ctx = Awaited<ReturnType<typeof seedBusiness>>;

  async function recordDraft(
    ctx: Ctx,
    amountMinor: string,
    allocations: Array<{ documentId: string; amountMinor: string }>,
  ) {
    return payments.create(
      ctx.owner.id,
      ctx.business.id,
      {
        type: "INBOUND",
        paymentDate: "2026-08-18",
        amountMinor,
        currencyCode: "SAR",
        reference: null,
        notes: null,
        allocations,
      },
      `req-create-${Date.now()}-${Math.random()}`,
    );
  }

  async function recordCompleted(
    ctx: Ctx,
    amountMinor: string,
    allocations: Array<{ documentId: string; amountMinor: string }>,
  ) {
    const draft = await recordDraft(ctx, amountMinor, allocations);
    return payments.markAsCompleted(
      ctx.owner.id,
      ctx.business.id,
      draft.id,
      `req-complete-${Date.now()}-${Math.random()}`,
    );
  }

  function summary(ctx: Ctx, invoiceId: string) {
    return payments.invoicePaymentSummary(ctx.owner.id, ctx.business.id, invoiceId);
  }

  // INV-1 — Allocation conservation: Σ(completed allocations to an invoice) never exceeds the invoice
  // total; the over-allocating write is rejected fail-closed.
  describe("INV-1 allocation conservation", () => {
    it("rejects a second completion that would push completed allocations past the invoice total", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Widgets", quantity: "1", unitPrice: "100.00" },
      ]);
      expect(invoice.totalMinor).toBe("10000");

      // Settle 60% for real.
      await recordCompleted(ctx, "6000", [{ documentId: invoice.id, amountMinor: "6000" }]);

      // A second payment claiming 6000 more would make 12000 > 10000. Completion must fail closed,
      // and the invoice's paid figure must be unchanged (still exactly 6000).
      await expect(
        recordCompleted(ctx, "6000", [{ documentId: invoice.id, amountMinor: "6000" }]),
      ).rejects.toBeInstanceOf(BadRequestException);

      const afterReject = await summary(ctx, invoice.id);
      expect(afterReject.paidMinor).toBe("6000");
      expect(BigInt(afterReject.paidMinor) <= BigInt(afterReject.totalMinor)).toBe(true);
      expect(afterReject.settlementStatus).toBe("PARTIALLY_PAID");
    }, 60_000);

    it("allows a second completion that exactly fills the remaining balance and reaches PAID", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Widgets", quantity: "1", unitPrice: "100.00" },
      ]);
      await recordCompleted(ctx, "6000", [{ documentId: invoice.id, amountMinor: "6000" }]);
      await recordCompleted(ctx, "4000", [{ documentId: invoice.id, amountMinor: "4000" }]);

      const paid = await summary(ctx, invoice.id);
      expect(paid.paidMinor).toBe("10000");
      expect(paid.outstandingMinor).toBe("0");
      expect(paid.settlementStatus).toBe("PAID");
    }, 60_000);
  });

  // INV-2 — Payment conservation: Σ(a payment's allocations) never exceeds the payment amount.
  describe("INV-2 payment conservation", () => {
    it("rejects creating a payment whose allocations exceed its amount", async () => {
      const ctx = await seedBusiness();
      const a = await seedInvoice(ctx, [{ description: "A", quantity: "1", unitPrice: "100.00" }]);
      const b = await seedInvoice(ctx, [{ description: "B", quantity: "1", unitPrice: "100.00" }]);
      await expect(
        recordDraft(ctx, "10000", [
          { documentId: a.id, amountMinor: "6000" },
          { documentId: b.id, amountMinor: "5000" },
        ]),
      ).rejects.toThrow("Payment allocations cannot exceed the payment amount.");
    }, 60_000);

    it("accepts a payment split across two invoices whose allocations sum to the amount", async () => {
      const ctx = await seedBusiness();
      const a = await seedInvoice(ctx, [{ description: "A", quantity: "1", unitPrice: "100.00" }]);
      const b = await seedInvoice(ctx, [{ description: "B", quantity: "1", unitPrice: "100.00" }]);
      await recordCompleted(ctx, "10000", [
        { documentId: a.id, amountMinor: "6000" },
        { documentId: b.id, amountMinor: "4000" },
      ]);
      expect((await summary(ctx, a.id)).paidMinor).toBe("6000");
      expect((await summary(ctx, b.id)).paidMinor).toBe("4000");
    }, 60_000);
  });

  // INV-3 — Derived settlement correctness: status is a pure function of COMPLETED allocations.
  // Progressive multi-payment settlement reaches PAID; reversing reverts with NO compensating writes.
  describe("INV-3 derived settlement is a pure function of completed allocations", () => {
    it("progresses UNPAID -> PARTIALLY_PAID -> PAID across multiple payments", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Work", quantity: "1", unitPrice: "300.00" },
      ]);
      expect((await summary(ctx, invoice.id)).settlementStatus).toBe("UNPAID");

      await recordCompleted(ctx, "10000", [{ documentId: invoice.id, amountMinor: "10000" }]);
      expect((await summary(ctx, invoice.id)).settlementStatus).toBe("PARTIALLY_PAID");

      await recordCompleted(ctx, "10000", [{ documentId: invoice.id, amountMinor: "10000" }]);
      expect((await summary(ctx, invoice.id)).settlementStatus).toBe("PARTIALLY_PAID");

      await recordCompleted(ctx, "10000", [{ documentId: invoice.id, amountMinor: "10000" }]);
      const paid = await summary(ctx, invoice.id);
      expect(paid.settlementStatus).toBe("PAID");
      expect(paid.outstandingMinor).toBe("0");
    }, 90_000);

    it("reverts to PARTIALLY_PAID when one of several payments is reversed, with no compensating writes", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Work", quantity: "1", unitPrice: "100.00" },
      ]);
      const first = await recordCompleted(ctx, "6000", [
        { documentId: invoice.id, amountMinor: "6000" },
      ]);
      await recordCompleted(ctx, "4000", [{ documentId: invoice.id, amountMinor: "4000" }]);
      expect((await summary(ctx, invoice.id)).settlementStatus).toBe("PAID");

      // Snapshot the allocation rows so we can prove reversal writes nothing compensating: it must
      // be a pure status flip on the payment, leaving every allocation row byte-for-byte in place.
      const accessCtx = await accessService.resolve(ctx.owner.id, ctx.business.id);
      const before = await database.withScope(accessCtx, (tx) =>
        tx.paymentAllocation.findMany({ orderBy: { id: "asc" } }),
      );

      await payments.reverse(ctx.owner.id, ctx.business.id, first.id, "req-reverse");

      const after = await database.withScope(accessCtx, (tx) =>
        tx.paymentAllocation.findMany({ orderBy: { id: "asc" } }),
      );
      // No allocation rows created, deleted, or mutated by the reversal.
      expect(after).toStrictEqual(before);

      const reverted = await summary(ctx, invoice.id);
      expect(reverted.settlementStatus).toBe("PARTIALLY_PAID");
      expect(reverted.paidMinor).toBe("4000");
      expect(reverted.outstandingMinor).toBe("6000");
    }, 90_000);

    it("reverts all the way to UNPAID when the only settling payment is reversed", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Work", quantity: "1", unitPrice: "100.00" },
      ]);
      const only = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      expect((await summary(ctx, invoice.id)).settlementStatus).toBe("PAID");

      await payments.reverse(ctx.owner.id, ctx.business.id, only.id, "req-reverse-only");
      const reverted = await summary(ctx, invoice.id);
      expect(reverted.settlementStatus).toBe("UNPAID");
      expect(reverted.paidMinor).toBe("0");
      expect(reverted.outstandingMinor).toBe("10000");
    }, 60_000);
  });

  // INV-4 — Void/reverse/refund state machine: void only DRAFT, reverse only COMPLETED, refund only
  // COMPLETED and never past the balance, no double-reverse; each failure carries its own code and
  // concurrent double-undo is serialized by the advisory lock.
  describe("INV-4 lifecycle state machine fails closed", () => {
    it("void accepts DRAFT and rejects COMPLETED with PAYMENT_NOT_DRAFT", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      const draft = await recordDraft(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      const voided = await payments.void(ctx.owner.id, ctx.business.id, draft.id, "req-void");
      expect(voided.status).toBe(PaymentStatus.VOIDED);

      const completed = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      await expect(
        payments.void(ctx.owner.id, ctx.business.id, completed.id, "req-void-2"),
      ).rejects.toMatchObject({ response: { code: "PAYMENT_NOT_DRAFT" } });
    }, 90_000);

    it("reverse rejects a DRAFT with PAYMENT_NOT_COMPLETED and a re-reverse with PAYMENT_ALREADY_REVERSED", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      const draft = await recordDraft(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      await expect(
        payments.reverse(ctx.owner.id, ctx.business.id, draft.id, "req-rev-draft"),
      ).rejects.toMatchObject({ response: { code: "PAYMENT_NOT_COMPLETED" } });

      const completed = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      await payments.reverse(ctx.owner.id, ctx.business.id, completed.id, "req-rev-1");
      await expect(
        payments.reverse(ctx.owner.id, ctx.business.id, completed.id, "req-rev-2"),
      ).rejects.toMatchObject({ response: { code: "PAYMENT_ALREADY_REVERSED" } });
    }, 90_000);

    it("serializes a concurrent double-reverse against the real advisory lock: exactly one wins", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      const completed = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);

      const [first, second] = await Promise.allSettled([
        payments.reverse(ctx.owner.id, ctx.business.id, completed.id, "req-conc-1"),
        payments.reverse(ctx.owner.id, ctx.business.id, completed.id, "req-conc-2"),
      ]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual(["fulfilled", "rejected"]);

      const rejected = (first.status === "rejected" ? first : second) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ response: { code: "PAYMENT_ALREADY_REVERSED" } });

      const finalState = await payments.get(ctx.owner.id, ctx.business.id, completed.id);
      expect(finalState.status).toBe(PaymentStatus.REVERSED);
    }, 90_000);
  });

  // INV-5 — Money conservation & currency isolation: minor-unit BigInt math neither creates nor
  // loses money across odd splits and large magnitudes; cross-currency allocation is rejected.
  describe("INV-5 money conservation and currency isolation", () => {
    it("settles exactly across an indivisible-by-three split with no rounding drift", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "Thirds", quantity: "1", unitPrice: "100.00" },
      ]);
      // 10000 minor units split 3333 + 3333 + 3334 — a float-thirds split would drift; BigInt must
      // land exactly on the total.
      await recordCompleted(ctx, "3333", [{ documentId: invoice.id, amountMinor: "3333" }]);
      await recordCompleted(ctx, "3333", [{ documentId: invoice.id, amountMinor: "3333" }]);
      const mid = await summary(ctx, invoice.id);
      expect(mid.paidMinor).toBe("6666");
      expect(mid.outstandingMinor).toBe("3334");

      await recordCompleted(ctx, "3334", [{ documentId: invoice.id, amountMinor: "3334" }]);
      const paid = await summary(ctx, invoice.id);
      expect(paid.paidMinor).toBe("10000");
      expect(paid.outstandingMinor).toBe("0");
      expect(paid.settlementStatus).toBe("PAID");
    }, 90_000);

    it("round-trips a large minor-unit total through Decimal(38,0) without loss", async () => {
      const ctx = await seedBusiness();
      // 99 x 9,999,999.99 = 98,999,999,901 minor units — beyond a currency's everyday range but well
      // within Decimal(38,0); proves the amount is not narrowed to a float anywhere on the path.
      const invoice = await seedInvoice(ctx, [
        { description: "Bulk", quantity: "99", unitPrice: "9999999.99" },
      ]);
      expect(invoice.totalMinor).toBe("98999999901");

      await recordCompleted(ctx, "98999999901", [
        { documentId: invoice.id, amountMinor: "98999999901" },
      ]);
      const paid = await summary(ctx, invoice.id);
      expect(paid.paidMinor).toBe("98999999901");
      expect(paid.outstandingMinor).toBe("0");
      expect(paid.settlementStatus).toBe("PAID");
    }, 90_000);

    it("rejects allocating a payment to an invoice denominated in another currency", async () => {
      const ctx = await seedBusiness();
      // Seed a USD invoice directly — the business base currency is SAR, so this can only arise from
      // a mismatch, and allocating SAR minor units to it would compare unlike quantities.
      const accessCtx = await accessService.resolve(ctx.owner.id, ctx.business.id);
      const usdInvoiceId = await database.withScope(accessCtx, async (tx) => {
        const customerRow = await tx.customer.findFirstOrThrow({
          where: { publicId: ctx.customer.id },
        });
        const doc = await tx.document.create({
          data: {
            tenantId: accessCtx.tenantId,
            businessId: accessCtx.businessId,
            customerId: customerRow.id,
            type: DocumentType.INVOICE,
            status: DocumentStatus.SENT,
            number: `INV-USD-${Math.floor(Math.random() * 1e6)}`,
            issueDate: new Date("2026-08-18T00:00:00.000Z"),
            validUntil: new Date("2026-09-18T00:00:00.000Z"),
            dueDate: new Date("2026-09-18T00:00:00.000Z"),
            currencyCode: "USD",
            currencyScale: 2,
            subtotalMinor: "10000",
            taxMinor: "0",
            totalMinor: "10000",
            createdByMembershipId: accessCtx.membershipId,
          },
        });
        return doc.publicId;
      });

      await expect(
        recordDraft(ctx, "10000", [{ documentId: usdInvoiceId, amountMinor: "10000" }]),
      ).rejects.toThrow("Payment currency SAR does not match invoice currency USD.");
    }, 60_000);

    it("rejects a payment whose currency is not the business base currency", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      await expect(
        payments.create(
          ctx.owner.id,
          ctx.business.id,
          {
            type: "INBOUND",
            paymentDate: "2026-08-18",
            amountMinor: "10000",
            currencyCode: "USD",
            reference: null,
            notes: null,
            allocations: [{ documentId: invoice.id, amountMinor: "10000" }],
          },
          "req-wrong-currency",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }, 60_000);
  });

  // INV-6 — Refund ledger: netAmountMinor = amount - Σrefunds; refunds are append-only and the
  // original payment amount is immutable.
  describe("INV-6 refund ledger is append-only and derives net", () => {
    it("accumulates refunds, derives net, keeps the payment amount immutable, and fails closed past the balance", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      const completed = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);

      const afterFirst = await payments.refund(
        ctx.owner.id,
        ctx.business.id,
        completed.id,
        { amountMinor: "3000", reason: "Partial return" },
        "req-refund-1",
      );
      expect(afterFirst.refundedMinor).toBe("3000");
      expect(afterFirst.netAmountMinor).toBe("7000");
      expect(afterFirst.amountMinor).toBe("10000");

      const afterSecond = await payments.refund(
        ctx.owner.id,
        ctx.business.id,
        completed.id,
        { amountMinor: "4000", reason: "Second return" },
        "req-refund-2",
      );
      // Ledger is append-only: two rows, cumulative sum, net derived — the payment amount untouched.
      expect(afterSecond.refunds).toHaveLength(2);
      expect(afterSecond.refundedMinor).toBe("7000");
      expect(afterSecond.netAmountMinor).toBe("3000");
      expect(afterSecond.amountMinor).toBe("10000");

      // A further refund past the 3000 remaining balance is rejected with its code, and nothing is
      // appended.
      await expect(
        payments.refund(
          ctx.owner.id,
          ctx.business.id,
          completed.id,
          { amountMinor: "4000", reason: "Too much" },
          "req-refund-3",
        ),
      ).rejects.toMatchObject({ response: { code: "PAYMENT_REFUND_EXCEEDS_BALANCE" } });

      const reread = await payments.get(ctx.owner.id, ctx.business.id, completed.id);
      expect(reread.refunds).toHaveLength(2);
      expect(reread.refundedMinor).toBe("7000");
      expect(reread.amountMinor).toBe("10000");

      // A final refund of exactly the remaining balance is allowed and drives net to zero.
      const afterFull = await payments.refund(
        ctx.owner.id,
        ctx.business.id,
        completed.id,
        { amountMinor: "3000", reason: "Remainder" },
        "req-refund-4",
      );
      expect(afterFull.refundedMinor).toBe("10000");
      expect(afterFull.netAmountMinor).toBe("0");
      expect(afterFull.amountMinor).toBe("10000");
    }, 90_000);

    it("rejects refunding a REVERSED payment with PAYMENT_NOT_COMPLETED", async () => {
      const ctx = await seedBusiness();
      const invoice = await seedInvoice(ctx, [
        { description: "A", quantity: "1", unitPrice: "100.00" },
      ]);
      const completed = await recordCompleted(ctx, "10000", [
        { documentId: invoice.id, amountMinor: "10000" },
      ]);
      await payments.reverse(ctx.owner.id, ctx.business.id, completed.id, "req-rev");
      await expect(
        payments.refund(
          ctx.owner.id,
          ctx.business.id,
          completed.id,
          { amountMinor: "1000", reason: null },
          "req-refund-reversed",
        ),
      ).rejects.toMatchObject({ response: { code: "PAYMENT_NOT_COMPLETED" } });
    }, 60_000);
  });

  // Guard: cross-tenant isolation of the payment summary — a foreign owner cannot read a business's
  // settlement, so per-business figures never blend.
  it("INV-7 denies cross-business access to an invoice payment summary", async () => {
    const ctx = await seedBusiness();
    const invoice = await seedInvoice(ctx, [
      { description: "A", quantity: "1", unitPrice: "100.00" },
    ]);
    const outsider = await seedBusiness();
    await expect(
      payments.invoicePaymentSummary(outsider.owner.id, ctx.business.id, invoice.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  }, 90_000);
});
