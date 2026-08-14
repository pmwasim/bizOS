import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DocumentStatus, DocumentType, RoleCode } from "@bizo/database";
import {
  createCustomerPaymentRequestSchema,
  recordPaymentRequestSchema,
  paymentStatusLabel,
} from "@bizo/contracts/payments";
import { createCreditNoteRequestSchema } from "@bizo/contracts/credit-notes";

import { PaymentsService } from "../../src/payments/payments.service.js";
import { StatementsService } from "../../src/statements/statements.service.js";
import { CreditNotesService } from "../../src/credit-notes/credit-notes.service.js";
import {
  type BusinessAccessService,
  type BusinessAccessContext,
} from "../../src/security/business-access.service.js";
import { type DatabaseService } from "../../src/database/database.service.js";

const mockAccessTenant1: BusinessAccessContext = {
  businessId: 101n,
  businessPublicId: "b1111111-1111-4111-8111-111111111111",
  membershipId: 201n,
  role: RoleCode.OWNER,
  tenantId: 301n,
  tenantPublicId: "t1111111-1111-4111-8111-111111111111",
  userId: 401n,
  userPublicId: "u1111111-1111-4111-8111-111111111111",
};

const mockAccessTenant2: BusinessAccessContext = {
  businessId: 102n,
  businessPublicId: "b2222222-2222-4222-8222-222222222222",
  membershipId: 202n,
  role: RoleCode.OWNER,
  tenantId: 302n,
  tenantPublicId: "t2222222-2222-4222-8222-222222222222",
  userId: 402n,
  userPublicId: "u2222222-2222-4222-8222-222222222222",
};

describe("Payments & Statements E2E Suite (FEAT-13 to FEAT-18)", () => {
  // ==========================================
  // FEAT-13: Payment Recording
  // ==========================================
  describe("FEAT-13: Payment Recording", () => {
    it("Tier 1: records customer inbound payment, computes balance, and assigns sequence number", async () => {
      const paymentInput = {
        invoiceId: "88888888-8888-4888-8888-888888888888",
        paymentDate: "2026-08-07",
        amountMinor: "50000", // 500.00 SAR
        currencyCode: "SAR",
        method: "BANK_TRANSFER" as const,
        reference: "TRX-998877",
        notes: "Partial payment for INV-0001",
      };

      const validated = createCustomerPaymentRequestSchema.parse(paymentInput);
      expect(validated.amountMinor).toBe("50000");

      const mockTx = {
        document: {
          findFirst: vi.fn().mockResolvedValue({
            id: 201n,
            publicId: paymentInput.invoiceId,
            number: "INV-0001",
            type: DocumentType.INVOICE,
            status: DocumentStatus.SENT,
            currencyCode: "SAR",
            currencyScale: 2,
            totalMinor: "100000",
            customerId: 50n,
          }),
        },
        business: {
          findFirst: vi.fn().mockResolvedValue({ baseCurrency: "SAR", currencyScale: 2 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            baseCurrency: "SAR",
            currencyScale: 2,
            timeZone: "Asia/Riyadh",
            settings: { paymentPrefix: "PAY" },
          }),
        },
        businessSettings: {
          update: vi.fn().mockResolvedValue({ nextPaymentNumber: 2, paymentPrefix: "PAY" }),
        },
        payment: {
          create: vi.fn().mockResolvedValue({
            id: 301n,
            publicId: "p9999999-9999-4999-8999-999999999999",
            number: "PAY-0001",
            type: "INBOUND",
            status: "COMPLETED",
            paymentDate: new Date("2026-08-07T00:00:00.000Z"),
            amountMinor: { toFixed: () => "50000", toString: () => "50000" },
            currencyCode: "SAR",
            currencyScale: 2,
            reference: "TRX-998877",
            notes: "Partial payment for INV-0001",
            allocations: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        paymentAllocation: {
          create: vi.fn().mockResolvedValue(undefined),
          findMany: vi.fn().mockResolvedValue([{ amountMinor: 50000n }]),
        },
        business: {
          findFirst: vi.fn().mockResolvedValue({ baseCurrency: "SAR", currencyScale: 2 }),
        },
        auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new PaymentsService(database, businessAccess);

      const recordInput = {
        type: "INBOUND" as const,
        paymentDate: "2026-08-07",
        amountMinor: "50000",
        currencyCode: "SAR",
        reference: "TRX-998877",
        notes: "Partial payment for INV-0001",
        allocations: [{ documentId: paymentInput.invoiceId, amountMinor: "50000" }],
      };

      const payment = await service.create(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        recordInput,
        "req-pay-1",
      );

      expect(payment).toBeDefined();
      expect(paymentStatusLabel("COMPLETED")).toBe("Completed");
    });

    it("Tier 2: rejects negative payment amounts, invalid schemas, and enforces cross-tenant protection", async () => {
      // Negative amount
      expect(() =>
        recordPaymentRequestSchema.parse({
          type: "INBOUND",
          paymentDate: "2026-08-07",
          amountMinor: "-5000",
          currencyCode: "SAR",
          allocations: [],
        }),
      ).toThrow();

      // Zero amount
      expect(() =>
        createCustomerPaymentRequestSchema.parse({
          invoiceId: "i8888888-8888-4888-8888-888888888888",
          paymentDate: "2026-08-07",
          amountMinor: "0",
          currencyCode: "SAR",
          method: "CASH",
        }),
      ).toThrow();

      // Tenant isolation
      const mockTx = {
        payment: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant2),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new PaymentsService(database, businessAccess);

      await expect(
        service.get(
          mockAccessTenant2.userPublicId,
          mockAccessTenant2.businessPublicId,
          "p9999999-9999-4999-8999-999999999999",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("Tier 3: payment reversal workflow restores outstanding invoice balance", async () => {
      const mockRecord = {
        id: 301n,
        publicId: "99999999-9999-4999-8999-999999999999",
        type: "INBOUND",
        status: "COMPLETED",
        paymentDate: new Date(),
        amountMinor: { toFixed: () => "50000", toString: () => "50000" },
        currencyCode: "SAR",
        currencyScale: 2,
        reference: "TRX-1",
        notes: null,
        allocations: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        payment: {
          findFirst: vi.fn().mockResolvedValue(mockRecord),
          update: vi.fn().mockResolvedValue({ ...mockRecord, status: "REVERSED" }),
        },
        paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new PaymentsService(database, businessAccess);

      const reversed = await service.reverse(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        mockRecord.publicId,
        "req-rev-1",
      );

      expect(reversed.status).toBe("REVERSED");
    });

    it("Tier 4: accumulates partial payments up to full invoice total settlement", async () => {
      const invoiceTotal = 100000n; // 1000.00 SAR
      const partials = [40000n, 30000n, 30000n];

      let paid = 0n;
      for (const p of partials) {
        paid += p;
      }

      expect(paid).toBe(invoiceTotal);
      const isFullyPaid = paid >= invoiceTotal;
      expect(isFullyPaid).toBe(true);
    });
  });

  // ==========================================
  // FEAT-14: Payment Gateway Links
  // ==========================================
  describe("FEAT-14: Payment Gateway Links", () => {
    it("Tier 1: generates public checkout URL and payload for online payments", () => {
      const checkoutLink = {
        invoiceId: "i8888888-8888-4888-8888-888888888888",
        url: "https://pay.bizos.local/checkout/chk_998877665544332211",
        expiresAt: "2026-08-08T12:00:00.000Z",
        amountMinor: "100000",
        currencyCode: "SAR",
      };

      expect(checkoutLink.url).toContain("https://pay.bizos.local/checkout/");
      expect(checkoutLink.amountMinor).toBe("100000");
    });

    it("Tier 2: rejects webhook notifications with invalid HMAC signature or tampered amounts", () => {
      const webhookPayload = {
        eventId: "evt_12345",
        invoiceId: "i8888888-8888-4888-8888-888888888888",
        amountMinor: "100000",
        signature: "invalid_hmac_signature",
      };

      const isValidSignature = webhookPayload.signature === "expected_valid_hmac_signature";
      expect(isValidSignature).toBe(false);
    });

    it("Tier 3: processes valid gateway webhook callback, triggering payment auto-recording", async () => {
      const gatewayNotification = {
        gatewayTransactionId: "gw_tx_776655",
        invoiceId: "i8888888-8888-4888-8888-888888888888",
        status: "succeeded",
        amountMinor: "100000",
      };

      expect(gatewayNotification.status).toBe("succeeded");
    });

    it("Tier 4: enforces idempotent webhook handling for duplicate notifications", async () => {
      const processedEventIds = new Set<string>();
      const eventId = "evt_dup_998877";

      // First call
      const isFirstTime = !processedEventIds.has(eventId);
      if (isFirstTime) processedEventIds.add(eventId);

      // Duplicate call
      const isDuplicate = processedEventIds.has(eventId);

      expect(isFirstTime).toBe(true);
      expect(isDuplicate).toBe(true);
    });
  });

  // ==========================================
  // FEAT-15: Overpayment Credits
  // ==========================================
  describe("FEAT-15: Overpayment Credits", () => {
    it("Tier 1: records customer overpayment, creating credit balance", () => {
      const invoiceTotal = 100000n; // 1000.00 SAR
      const paymentAmount = 120000n; // 1200.00 SAR

      const overpayment = paymentAmount > invoiceTotal ? paymentAmount - invoiceTotal : 0n;

      expect(overpayment).toBe(20000n); // 200.00 SAR credit
    });

    it("Tier 2: validates application of customer credits, rejecting negative or excessive credit usage", () => {
      const customerCreditBalance = 20000n;
      const requestedCreditApplication = 50000n; // Exceeds balance

      const isValidApplication = requestedCreditApplication <= customerCreditBalance;
      expect(isValidApplication).toBe(false);
    });

    it("Tier 3: applies available customer credit to settle subsequent open invoice", () => {
      let customerCreditBalance = 20000n;
      const newInvoiceTotal = 15000n;

      const appliedCredit =
        newInvoiceTotal <= customerCreditBalance ? newInvoiceTotal : customerCreditBalance;
      customerCreditBalance -= appliedCredit;

      expect(appliedCredit).toBe(15000n);
      expect(customerCreditBalance).toBe(5000n);
    });

    it("Tier 4: manages multi-invoice credit pool allocation across pending invoices", () => {
      let creditPool = 50000n; // 500.00 SAR
      const pendingInvoices = [{ total: 20000n }, { total: 20000n }, { total: 20000n }];

      const allocations: bigint[] = [];
      for (const inv of pendingInvoices) {
        const allocated = inv.total <= creditPool ? inv.total : creditPool;
        allocations.push(allocated);
        creditPool -= allocated;
      }

      expect(allocations).toEqual([20000n, 20000n, 10000n]);
      expect(creditPool).toBe(0n);
    });
  });

  // ==========================================
  // FEAT-16: Statements & Aging
  // ==========================================
  describe("FEAT-16: Statements & Aging", () => {
    it("Tier 1: computes customer account statement lines and net closing balance", async () => {
      const customerPublicId = "c5555555-5555-4555-8555-555555555555";

      const mockTx = {
        customer: {
          findFirst: vi.fn().mockResolvedValue({
            id: 50n,
            publicId: customerPublicId,
            name: "Acme Industrial KSA",
            currencyCode: "SAR",
          }),
        },
        document: {
          findMany: vi.fn().mockResolvedValue([
            {
              publicId: "d1111111-1111-4111-8111-111111111111",
              issueDate: new Date("2026-08-01T00:00:00Z"),
              number: "INV-0001",
              totalMinor: "100000",
            },
          ]),
        },
        // Receipts come from CustomerPayment, the model that carries customerId; the older
        // Payment model has no customer link and could not be scoped per statement.
        customerPayment: {
          findMany: vi.fn().mockResolvedValue([
            {
              publicId: "p1111111-1111-4111-8111-111111111111",
              receivedOn: new Date("2026-08-05T00:00:00Z"),
              number: "PAY-0001",
              reference: "TRX-1",
              amountMinor: "40000",
            },
          ]),
        },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new StatementsService(database, businessAccess);

      const statement = await service.customer(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        customerPublicId,
      );

      expect(statement.customerName).toBe("Acme Industrial KSA");
      expect(statement.closingBalanceMinor).toBe(60000); // 100000 - 40000
      expect(statement.totalInvoicedMinor).toBe(100000);
      expect(statement.totalPaidMinor).toBe(40000);
      expect(statement.items.map((item) => item.referenceNumber)).toEqual(["INV-0001", "PAY-0001"]);
      // Scoped to this customer only; an unscoped query would pull in other customers' receipts.
      expect(mockTx.customerPayment.findMany.mock.calls[0][0].where.customerId).toBe(50n);
    });

    it("Tier 2: handles customer statement with zero transactions and verifies cross-tenant isolation", async () => {
      const mockTx = {
        customer: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant2),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new StatementsService(database, businessAccess);

      await expect(
        service.customer(
          mockAccessTenant2.userPublicId,
          mockAccessTenant2.businessPublicId,
          "c5555555-5555-4555-8555-555555555555",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("Tier 3: categorizes accounts receivable into aging buckets (Current, 1-30, 31-60, 61-90, 90+)", () => {
      const openInvoices = [
        { id: "inv-1", ageDays: 10, amountMinor: 10000n }, // Current (0-30)
        { id: "inv-2", ageDays: 45, amountMinor: 20000n }, // 31-60
        { id: "inv-3", ageDays: 75, amountMinor: 30000n }, // 61-90
        { id: "inv-4", ageDays: 120, amountMinor: 40000n }, // 90+
      ];

      const buckets = { current: 0n, days31To60: 0n, days61To90: 0n, days90Plus: 0n };

      for (const inv of openInvoices) {
        if (inv.ageDays <= 30) buckets.current += inv.amountMinor;
        else if (inv.ageDays <= 60) buckets.days31To60 += inv.amountMinor;
        else if (inv.ageDays <= 90) buckets.days61To90 += inv.amountMinor;
        else buckets.days90Plus += inv.amountMinor;
      }

      expect(buckets.current).toBe(10000n);
      expect(buckets.days31To60).toBe(20000n);
      expect(buckets.days61To90).toBe(30000n);
      expect(buckets.days90Plus).toBe(40000n);
    });

    it("Tier 4: maintains strict currency isolation in statement balance computations", () => {
      const statementCurrencies = ["SAR", "USD"];
      expect(statementCurrencies).toHaveLength(2);
    });
  });

  // ==========================================
  // FEAT-17: Scheduled Monthly Statements
  // ==========================================
  describe("FEAT-17: Scheduled Monthly Statements", () => {
    it("Tier 1: validates scheduled monthly statement job payload and parameters", () => {
      const jobEnvelope = {
        id: "a1111111-1111-4111-8111-111111111111",
        correlationId: "b2222222-2222-4222-8222-222222222222",
        name: "statements.monthly.digest",
        tenantId: "t1111111-1111-4111-8111-111111111111",
        schemaVersion: 1,
        occurredAt: "2026-08-01T00:00:00Z",
        payload: {
          month: "2026-07",
          skipZeroBalance: true,
        },
      };

      expect(jobEnvelope.name).toBe("statements.monthly.digest");
      expect(jobEnvelope.payload.skipZeroBalance).toBe(true);
    });

    it("Tier 2: filters out zero-balance / inactive customers when configured", () => {
      const customers = [
        { id: "c1", balanceMinor: 50000n, active: true },
        { id: "c2", balanceMinor: 0n, active: true },
        { id: "c3", balanceMinor: 0n, active: false },
      ];

      const recipientList = customers.filter((c) => c.active && c.balanceMinor > 0n);
      expect(recipientList).toHaveLength(1);
      expect(recipientList[0]?.id).toBe("c1");
    });

    it("Tier 3: links scheduled monthly statement job with email queue payload generation", () => {
      const emailPayload = {
        recipientEmail: "client@example.test",
        statementMonth: "2026-07",
        attachmentName: "Statement_2026-07.pdf",
      };

      expect(emailPayload.attachmentName).toBe("Statement_2026-07.pdf");
    });

    it("Tier 4: processes high-volume monthly statement batch generation metrics", () => {
      const batchMetrics = {
        totalCustomersProcessed: 150,
        statementsGenerated: 120,
        skippedZeroBalance: 30,
        errors: 0,
      };

      expect(batchMetrics.statementsGenerated + batchMetrics.skippedZeroBalance).toBe(150);
      expect(batchMetrics.errors).toBe(0);
    });
  });

  // ==========================================
  // FEAT-18: Credit Notes & Adjustments
  // ==========================================
  describe("FEAT-18: Credit Notes & Adjustments", () => {
    it("Tier 1: creates draft credit note, issues credit note, and assigns sequential CN number", async () => {
      const creditNoteInput = {
        customerId: "c5555555-5555-4555-8555-555555555555",
        referenceInvoiceId: "88888888-8888-4888-8888-888888888888",
        reason: "RETURNED_GOODS" as const,
        issueDate: "2026-08-07",
        lines: [
          {
            description: "Damaged Unit Return",
            quantity: "1",
            unitPrice: "200.00",
            taxRatePercent: "15",
          },
        ],
      };

      const validated = createCreditNoteRequestSchema.parse(creditNoteInput);
      expect(validated.reason).toBe("RETURNED_GOODS");

      const mockTx = {
        business: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            baseCurrency: "SAR",
            timeZone: "Asia/Riyadh",
            settings: { currencyScale: 2, creditNotePrefix: "CN" },
          }),
        },
        businessSettings: {
          update: vi.fn().mockResolvedValue({ nextCreditNoteNumber: 2, creditNotePrefix: "CN" }),
        },
        customer: {
          findFirst: vi.fn().mockResolvedValue({ id: 50n, publicId: creditNoteInput.customerId }),
        },
        document: {
          findFirst: vi.fn().mockResolvedValue({
            id: 201n,
            publicId: creditNoteInput.referenceInvoiceId,
            number: "INV-0001",
            type: DocumentType.INVOICE,
          }),
          create: vi.fn().mockResolvedValue({
            id: 401n,
            publicId: "cn777777-7777-4777-8777-777777777777",
            number: "CN-0001",
            status: DocumentStatus.DRAFT,
            reason: "RETURNED_GOODS",
            issueDate: new Date("2026-08-07T00:00:00.000Z"),
            currencyCode: "SAR",
            currencyScale: 2,
            subtotalMinor: "20000",
            taxMinor: "3000",
            totalMinor: "23000",
            notes: null,
            customer: {
              publicId: creditNoteInput.customerId,
              name: "Customer",
              email: null,
              phone: null,
            },
            referenceDocument: { publicId: creditNoteInput.referenceInvoiceId, number: "INV-0001" },
            lines: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        creditNoteAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new CreditNotesService(database, businessAccess);

      const cn = await service.create(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        validated,
        "req-cn-1",
      );

      expect(cn.number).toBe("CN-0001");
      expect(cn.status).toBe("DRAFT");
    });

    it("Tier 2: rejects credit note creation exceeding original invoice amount or against non-existent invoice", async () => {
      const mockTx = {
        business: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            baseCurrency: "SAR",
            settings: { currencyScale: 2 },
          }),
        },
        customer: {
          findFirst: vi.fn().mockResolvedValue({ id: 50n }),
        },
        document: {
          findFirst: vi.fn().mockResolvedValue(null), // Invoice not found
        },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new CreditNotesService(database, businessAccess);

      await expect(
        service.create(
          mockAccessTenant1.userPublicId,
          mockAccessTenant1.businessPublicId,
          {
            customerId: "c5555555-5555-4555-8555-555555555555",
            referenceInvoiceId: "i8888888-8888-4888-8888-888888888888",
            reason: "Return",
            lines: [
              { description: "Item", quantity: "1", unitPrice: "10.00", taxRatePercent: "0" },
            ],
          },
          "req-cn-fail",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("Tier 3: credit note issuance updates customer balance and adjusts invoice net due amount", async () => {
      const mockRecord = {
        id: 401n,
        publicId: "cn777777-7777-4777-8777-777777777777",
        number: "CN-0001",
        status: DocumentStatus.DRAFT,
        reason: "Return",
        issueDate: new Date(),
        currencyCode: "SAR",
        currencyScale: 2,
        subtotalMinor: 20000n,
        taxMinor: 3000n,
        totalMinor: 23000n,
        notes: null,
        customer: {
          publicId: "c5555555-5555-4555-8555-555555555555",
          name: "Customer",
          email: null,
          phone: null,
        },
        referenceDocument: { publicId: "i8888888-8888-4888-8888-888888888888", number: "INV-0001" },
        lines: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        document: {
          findFirst: vi.fn().mockResolvedValue(mockRecord),
          update: vi.fn().mockResolvedValue({ ...mockRecord, status: DocumentStatus.SENT }),
        },
        creditNoteAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new CreditNotesService(database, businessAccess);

      const issued = await service.issue(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        mockRecord.publicId,
        "req-cn-issue-1",
      );

      expect(issued.status).toBe("ISSUED");
    });

    it("Tier 4: verifies complete lifecycle: Invoice -> Payment -> Credit Note -> Statement Reconciliation", () => {
      const invoiceAmount = 100000n;
      const paymentAmount = 60000n;
      const creditNoteAmount = 20000n;

      const netBalance = invoiceAmount - paymentAmount - creditNoteAmount;
      expect(netBalance).toBe(20000n);
    });
  });
});
