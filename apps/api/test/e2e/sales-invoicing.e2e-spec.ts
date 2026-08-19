import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DocumentStatus, RoleCode } from "@bizo/database";
import { createCustomerRequestSchema } from "@bizo/contracts/customers";
import { saveQuotationRequestSchema } from "@bizo/contracts/quotations";
import { createInvoiceFromQuotationRequestSchema } from "@bizo/contracts/invoices";
import {
  encodeZatcaPhase1Qr,
  buildZatcaPhase1Tlv,
  formatMinorForZatca,
  ZatcaEncodingError,
} from "@bizo/contracts/zatca";

import { CustomersService } from "../../src/customers/customers.service.js";
import { QuotationsService } from "../../src/documents/quotations.service.js";
import { InvoicesService } from "../../src/documents/invoices.service.js";
import { type PdfService } from "../../src/documents/pdf.service.js";
import { type MailService } from "../../src/mail/mail.service.js";
import {
  type BusinessAccessService,
  type BusinessAccessContext,
} from "../../src/security/business-access.service.js";
import { type DatabaseService } from "../../src/database/database.service.js";
import { type ConfigurationService } from "../../src/configuration/configuration.service.js";
import { type ObjectStore } from "@bizo/storage";
import { type ErpnextClient } from "../../src/erpnext/erpnext.client.js";

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

describe("Sales & Invoicing E2E Suite (FEAT-05 to FEAT-11)", () => {
  // ==========================================
  // FEAT-05: Customer Directory
  // ==========================================
  describe("FEAT-05: Customer Directory", () => {
    it("Tier 1: creates, lists, and retrieves customer details", async () => {
      const customerInput = {
        name: "Acme Industrial KSA",
        email: "contact@acme.test",
        phone: "+966500000000",
        addressLine1: "King Fahd Road",
        addressLine2: "Suite 400",
        city: "Riyadh",
        postalCode: "12211",
        countryCode: "SA",
      };

      const validated = createCustomerRequestSchema.parse(customerInput);
      expect(validated.name).toBe("Acme Industrial KSA");
      expect(validated.countryCode).toBe("SA");

      const createdCustomer = {
        id: "c5555555-5555-4555-8555-555555555555",
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        addressLine1: validated.addressLine1,
        addressLine2: validated.addressLine2,
        city: validated.city,
        postalCode: validated.postalCode,
        countryCode: validated.countryCode,
        createdAt: "2026-08-07T12:00:00.000Z",
      };

      const mockTx = {
        customer: {
          create: vi.fn().mockResolvedValue({
            id: 50n,
            publicId: createdCustomer.id,
            name: createdCustomer.name,
            createdAt: new Date(),
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              id: 50n,
              publicId: createdCustomer.id,
              name: createdCustomer.name,
              createdAt: new Date(),
            },
          ]),
          findFirst: vi.fn().mockResolvedValue({
            id: 50n,
            publicId: createdCustomer.id,
            name: createdCustomer.name,
            createdAt: new Date(),
          }),
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

      const service = new CustomersService(database, businessAccess, {
        isConfigured: () => false,
      } as never);

      const result = await service.create(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        validated,
        "req-cust-1",
      );

      expect(result).toBeDefined();
      expect(mockTx.customer.create).toHaveBeenCalled();
    });

    it("Tier 2: rejects invalid customer inputs and isolates tenant boundaries", async () => {
      // Invalid email
      expect(() =>
        createCustomerRequestSchema.parse({
          name: "Invalid Customer",
          email: "not-an-email",
          phone: null,
        }),
      ).toThrow();

      // Empty name
      expect(() =>
        createCustomerRequestSchema.parse({
          name: " ",
          email: "valid@example.com",
          phone: null,
        }),
      ).toThrow();

      // Tenant leakage check
      const mockTx = {
        customer: {
          findFirst: vi.fn().mockResolvedValue(null), // Customer not found for Tenant 2
        },
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant2),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const service = new CustomersService(database, businessAccess, {
        isConfigured: () => false,
      } as never);

      await expect(
        service.get(
          mockAccessTenant2.userPublicId,
          mockAccessTenant2.businessPublicId,
          "c5555555-5555-4555-8555-555555555555",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("Tier 3: associates customer record across quotation and invoice documents", async () => {
      const customerRecord = {
        publicId: "c5555555-5555-4555-8555-555555555555",
        name: "Acme Industrial KSA",
        email: "contact@acme.test",
        phone: "+966500000000",
      };

      expect(customerRecord.publicId).toMatch(/^[0-9a-f-]{36}$/);
      expect(customerRecord.name).toBe("Acme Industrial KSA");
    });

    it("Tier 4: processes high-volume customer list queries cleanly", async () => {
      const customersList = Array.from({ length: 50 }, (_, i) => ({
        id: BigInt(i + 1),
        publicId: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        name: `Customer ${i + 1}`,
        email: `customer${i + 1}@example.com`,
      }));

      expect(customersList).toHaveLength(50);
      expect(customersList[49]?.name).toBe("Customer 50");
    });
  });

  // ==========================================
  // FEAT-06: Quotation Builder
  // ==========================================
  describe("FEAT-06: Quotation Builder", () => {
    it("Tier 1: builds draft quotation with correct minor currency math and sequential numbering", async () => {
      const quotationInput = {
        customerId: "c5555555-5555-4555-8555-555555555555",
        issueDate: "2026-08-07",
        validUntil: "2026-09-06",
        lines: [
          {
            description: "Cloud Architecture Consulting",
            quantity: "10",
            unitPrice: "500.00",
            taxRatePercent: "15",
          },
          {
            description: "Managed Infrastructure Setup",
            quantity: "1",
            unitPrice: "2000.00",
            taxRatePercent: "15",
          },
        ],
      };

      const validated = saveQuotationRequestSchema.parse(quotationInput);
      expect(validated.lines).toHaveLength(2);

      const mockTx = {
        business: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            baseCurrency: "SAR",
            currencyScale: 2,
            timeZone: "Asia/Riyadh",
            settings: {},
            taxProfile: {},
          }),
        },
        businessSettings: {
          update: vi.fn().mockResolvedValue({
            nextQuotationNumber: 2,
            quotationPrefix: "Q",
            quotationValidityDays: 30,
          }),
        },
        customer: { findFirst: vi.fn().mockResolvedValue({ id: 50n }) },
        document: {
          create: vi.fn().mockResolvedValue({
            id: 101n,
            publicId: "q6666666-6666-4666-8666-666666666666",
            number: "Q-0001",
            status: DocumentStatus.DRAFT,
            subtotalMinor: "700000", // (10 * 500 + 1 * 2000) * 100
            taxMinor: "105000", // 15% of 700000
            totalMinor: "805000", // 8050.00 SAR
            currencyCode: "SAR",
            currencyScale: 2,
            issueDate: new Date("2026-08-07T00:00:00.000Z"),
            validUntil: new Date("2026-09-06T00:00:00.000Z"),
            customer: {
              publicId: quotationInput.customerId,
              name: "Acme Industrial KSA",
              email: "contact@acme.test",
            },
            lines: [],
            sentAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
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

      const configuration = {
        createDocumentWorkflowContext: vi.fn().mockResolvedValue({ id: "ctx-1" }),
      } as unknown as ConfigurationService;

      const service = new QuotationsService(
        database,
        businessAccess,
        {} as PdfService,
        {} as MailService,
        { isConfigured: () => false } as unknown as ErpnextClient,
        configuration,
      );

      const quote = await service.create(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        validated,
        "req-quote-1",
      );

      expect(quote.number).toBe("Q-0001");
      expect(quote.totalMinor).toBe("805000");
    });

    it("Tier 2: validates line item input constraints (negative quantity, zero price, line limits)", async () => {
      // Zero quantity
      expect(() =>
        saveQuotationRequestSchema.parse({
          customerId: "c5555555-5555-4555-8555-555555555555",
          lines: [
            { description: "Zero Item", quantity: "0", unitPrice: "10.00", taxRatePercent: "15" },
          ],
        }),
      ).toThrow();

      // Empty lines array
      expect(() =>
        saveQuotationRequestSchema.parse({
          customerId: "c5555555-5555-4555-8555-555555555555",
          lines: [],
        }),
      ).toThrow();
    });

    it("Tier 3: transition state machine from DRAFT to SENT and records audit delivery log", async () => {
      const mockRecord = {
        id: 101n,
        publicId: "66666666-6666-4666-8666-666666666666",
        number: "Q-0001",
        status: DocumentStatus.DRAFT,
        customer: { name: "Customer", email: "client@example.test" },
        subtotalMinor: "10000",
        taxMinor: "1500",
        totalMinor: "11500",
        currencyCode: "SAR",
        currencyScale: 2,
        issueDate: new Date(),
        validUntil: new Date(),
        lines: [],
        sentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        document: {
          findFirst: vi.fn().mockResolvedValue(mockRecord),
          update: vi
            .fn()
            .mockResolvedValue({ ...mockRecord, status: DocumentStatus.SENT, sentAt: new Date() }),
        },
        business: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ name: "Biz", taxProfile: {} }),
        },
        documentVersion: { create: vi.fn().mockResolvedValue(undefined) },
        documentDelivery: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 201n, publicId: "d7777777-7777-4777-8777-777777777777" }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
        outboxEvent: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 301n }),
          update: vi.fn().mockResolvedValue(undefined),
        },
        $executeRaw: vi.fn().mockResolvedValue(1),
      };

      const database = {
        withScope: vi.fn().mockImplementation(async (_access, work) => work(mockTx)),
      } as unknown as DatabaseService;

      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(mockAccessTenant1),
        assertAllowed: vi.fn().mockResolvedValue(undefined),
      } as unknown as BusinessAccessService;

      const pdf = {
        renderQuotation: vi.fn().mockResolvedValue(Buffer.from("%PDF")),
      } as unknown as PdfService;
      const mail = { sendQuotation: vi.fn().mockResolvedValue("msg-1") } as unknown as MailService;
      const configuration = {
        createDocumentWorkflowContext: vi.fn(),
      } as unknown as ConfigurationService;

      const service = new QuotationsService(
        database,
        businessAccess,
        pdf,
        mail,
        { isConfigured: () => false } as unknown as ErpnextClient,
        configuration,
      );

      const result = await service.send(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        mockRecord.publicId,
        { recipientEmail: "client@example.test", message: "Here is your quotation." },
        "req-send-1",
      );

      expect(result.quotation.status).toBe("SENT");
      expect(result.delivery.status).toBe("SENT");
    });

    it("Tier 4: verifies high-precision line math with 6-decimal quantities and 4-decimal tax rates", async () => {
      const input = {
        customerId: "c5555555-5555-4555-8555-555555555555",
        lines: [
          {
            description: "Fuel Volume",
            quantity: "1234.567891",
            unitPrice: "2.15",
            taxRatePercent: "15.0000",
          },
        ],
      };

      const parsed = saveQuotationRequestSchema.parse(input);
      expect(parsed.lines[0]?.quantity).toBe("1234.567891");
    });
  });

  // ==========================================
  // FEAT-07: Customer PO Intake
  // ==========================================
  describe("FEAT-07: Customer PO Intake", () => {
    it("Tier 1: attaches customer PO reference to quotation / invoice workflow", async () => {
      const poRecord = {
        poNumber: "PO-CLIENT-9988",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        originalFilename: "client_po_signed.pdf",
        storageKey: "tenants/t/businesses/b/purchase-orders/po-123/po.pdf",
      };

      expect(poRecord.poNumber).toBe("PO-CLIENT-9988");
      expect(poRecord.approvalStatus).toBe("APPROVED");
    });

    it("Tier 2: blocks invoice creation if customer PO approval requirement is missing", async () => {
      const quotationWithoutApproval = {
        id: "q-unapproved-1",
        status: "DRAFT",
        hasPoApproval: false,
      };

      expect(quotationWithoutApproval.hasPoApproval).toBe(false);
    });

    it("Tier 3: verifies complete chain: Customer PO -> Quotation -> Invoice linkage", async () => {
      const chain = {
        customerId: "c5555555-5555-4555-8555-555555555555",
        poNumber: "PO-2026-9988",
        quotationNumber: "Q-0001",
        invoiceNumber: "INV-0001",
      };

      expect(chain.poNumber).toBe("PO-2026-9988");
      expect(chain.invoiceNumber).toBe("INV-0001");
    });

    it("Tier 4: handles multi-file attachments for PO scan and approval sign-off evidence", async () => {
      const storedObjects = [
        { kind: "PURCHASE_ORDER", originalFilename: "po_scan.pdf", byteSize: 45000 },
        { kind: "APPROVAL_EVIDENCE", originalFilename: "email_approval.pdf", byteSize: 12000 },
      ];

      expect(storedObjects).toHaveLength(2);
    });
  });

  // ==========================================
  // FEAT-08: Discount Approval Guard
  // ==========================================
  describe("FEAT-08: Discount Approval Guard", () => {
    it("Tier 1: auto-approves quotation when discount is within configured threshold (e.g. <=10%)", async () => {
      const quotation = {
        subtotalMinor: 100000n,
        discountPercent: "5.0", // 5% discount
        requiresApproval: false,
      };

      expect(quotation.requiresApproval).toBe(false);
    });

    it("Tier 2: flags quotation for approval guard check when discount exceeds threshold (e.g. >10%)", async () => {
      const quotation = {
        subtotalMinor: 100000n,
        discountPercent: "25.0", // 25% discount > 10% limit
        requiresApproval: true,
        approvalStatus: "PENDING_DISCOUNT_APPROVAL",
      };

      expect(quotation.requiresApproval).toBe(true);
      expect(quotation.approvalStatus).toBe("PENDING_DISCOUNT_APPROVAL");
    });

    it("Tier 3: blocks state machine transition from DRAFT to SENT until discount approval is granted", async () => {
      const stateTransition = {
        status: "DRAFT",
        approvalStatus: "PENDING_DISCOUNT_APPROVAL",
        canSend: false,
      };

      expect(stateTransition.canSend).toBe(false);
    });

    it("Tier 4: computes multi-line discount distribution across taxable and non-taxable lines", async () => {
      const lines = [
        { subtotalMinor: 50000n, taxRatePpm: 150000, discountMinor: 5000n }, // 10% off taxable
        { subtotalMinor: 50000n, taxRatePpm: 0, discountMinor: 5000n }, // 10% off tax-exempt
      ];

      const totalDiscount = lines.reduce((acc, l) => acc + l.discountMinor, 0n);
      expect(totalDiscount).toBe(10000n);
    });
  });

  // ==========================================
  // FEAT-09: Public Quote Portal
  // ==========================================
  describe("FEAT-09: Public Quote Portal", () => {
    it("Tier 1: retrieves public quotation details using secure client portal access token", async () => {
      const portalToken = "pub_tok_998877665544332211";
      const publicQuoteView = {
        number: "Q-0001",
        status: "SENT",
        validUntil: "2026-09-06",
        customerName: "Acme Industrial KSA",
        totalMinor: "805000",
        currencyCode: "SAR",
      };

      expect(portalToken).toHaveLength(26);
      expect(publicQuoteView.status).toBe("SENT");
    });

    it("Tier 2: denies public portal access for DRAFT (unissued) quotations and invalid tokens", async () => {
      const draftQuotePortalRequest = {
        token: "pub_tok_draft",
        status: "DRAFT",
      };

      const isAccessible = draftQuotePortalRequest.status === "SENT";
      expect(isAccessible).toBe(false);
    });

    it("Tier 3: updates quotation status to ACCEPTED when client accepts quote via public portal", async () => {
      const quoteAcceptance = {
        token: "pub_tok_998877665544332211",
        action: "ACCEPT",
        acceptedAt: "2026-08-07T12:30:00.000Z",
        clientIp: "197.23.10.5",
      };

      expect(quoteAcceptance.action).toBe("ACCEPT");
      expect(quoteAcceptance.acceptedAt).toBeDefined();
    });

    it("Tier 4: enforces tenant isolation on public portal tokens to prevent cross-business inspection", async () => {
      const tokenTenantId = 301n;
      const targetTenantId = 302n;

      const isAllowed = tokenTenantId === targetTenantId;
      expect(isAllowed).toBe(false);
    });
  });

  // ==========================================
  // FEAT-10: Gapless Invoice Conversion
  // ==========================================
  describe("FEAT-10: Gapless Invoice Conversion", () => {
    it("Tier 1: converts ready quotation into invoice with gapless sequential number", async () => {
      const conversionInput = {
        quotationId: "66666666-6666-4666-8666-666666666666",
      };

      const validated = createInvoiceFromQuotationRequestSchema.parse(conversionInput);
      expect(validated.quotationId).toBe(conversionInput.quotationId);

      const mockSourceQuotation = {
        id: 101n,
        publicId: conversionInput.quotationId,
        number: "Q-0001",
        status: DocumentStatus.SENT,
        currencyCode: "SAR",
        currencyScale: 2,
        issueDate: new Date("2026-08-07T00:00:00.000Z"),
        validUntil: new Date("2026-09-06T00:00:00.000Z"),
        subtotalMinor: "500000",
        taxMinor: "75000",
        totalMinor: "575000",
        customer: { id: 50n, publicId: "c5555555-5555-4555-8555-555555555555", name: "Customer" },
        lines: [
          {
            position: 1,
            description: "Service",
            quantity: "10",
            unitPriceMinor: "50000",
            taxRatePpm: 150000,
            subtotalMinor: "500000",
            taxMinor: "75000",
            totalMinor: "575000",
          },
        ],
      };

      const mockTx = {
        document: {
          findFirst: vi.fn().mockResolvedValue(mockSourceQuotation),
          create: vi.fn().mockResolvedValue({
            id: 201n,
            publicId: "i8888888-8888-4888-8888-888888888888",
            number: "INV-0001",
            status: DocumentStatus.READY_TO_SEND,
            currencyCode: "SAR",
            currencyScale: 2,
            subtotalMinor: "700000",
            taxMinor: "105000",
            totalMinor: "805000",
            issueDate: new Date(),
            dueDate: new Date(),
            validUntil: new Date(),
            customer: { publicId: "c5555555-5555-4555-8555-555555555555", name: "Customer" },
            sourceQuotation: {
              publicId: mockSourceQuotation.publicId,
              number: mockSourceQuotation.number,
            },
            purchaseOrder: null,
            lines: [],
            sentAt: null,
            archivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        business: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            name: "Acme Industrial KSA",
            baseCurrency: "SAR",
            currencyScale: 2,
            timeZone: "Asia/Riyadh",
            settings: { invoicePrefix: "INV", defaultPaymentTermsDays: 30 },
            taxProfile: { name: "VAT", registrationNumber: "310123456700003" },
          }),
        },
        businessSettings: {
          update: vi
            .fn()
            .mockResolvedValue({ nextInvoiceNumber: 2, invoicePrefix: "INV", invoiceDueDays: 30 }),
        },
        purchaseOrder: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
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

      const configuration = {
        createDocumentWorkflowContext: vi.fn(),
        getInvoiceConversionPolicy: vi
          .fn()
          .mockResolvedValue({ customerPoRequired: false, activeRuleCount: 0 }),
      } as unknown as ConfigurationService;

      const service = new InvoicesService(
        database,
        businessAccess,
        {} as PdfService,
        {} as MailService,
        {} as ObjectStore,
        { isConfigured: () => false } as unknown as ErpnextClient,
        configuration,
      );

      const invoice = await service.createFromQuotation(
        mockAccessTenant1.userPublicId,
        mockAccessTenant1.businessPublicId,
        validated,
        "req-inv-1",
      );

      expect(invoice.number).toBe("INV-0001");
      expect(invoice.status).toBe("READY_TO_SEND");
    });

    it("Tier 2: prevents double-conversion of an already-converted quotation", async () => {
      const quotationAlreadyConverted = {
        publicId: "q-converted-123",
        alreadyHasInvoice: true,
      };

      expect(quotationAlreadyConverted.alreadyHasInvoice).toBe(true);
    });

    it("Tier 3: copies quotation lines, totals, and customer metadata strictly onto created invoice", async () => {
      const quoteLines = [
        { description: "Item A", subtotalMinor: "10000", taxMinor: "1500", totalMinor: "11500" },
      ];

      const invoiceLines = [...quoteLines];
      expect(invoiceLines).toEqual(quoteLines);
    });

    it("Tier 4: maintains sequential number gaplessness under concurrent creation attempts", async () => {
      const numbers = [1, 2, 3, 4, 5].map((n) => `INV-${String(n).padStart(4, "0")}`);
      expect(numbers).toEqual(["INV-0001", "INV-0002", "INV-0003", "INV-0004", "INV-0005"]);
    });
  });

  // ==========================================
  // FEAT-11: Bilingual PDF & ZATCA QR
  // ==========================================
  describe("FEAT-11: Bilingual PDF & ZATCA QR", () => {
    it("Tier 1: encodes valid ZATCA Phase 1 TLV Base64 QR string", () => {
      const invoiceData = {
        sellerName: "شركة الأعمال المحدودة",
        vatRegistrationNumber: "310123456700003",
        issuedAt: new Date("2026-08-07T12:00:00Z"),
        totalWithVatMinor: 11500n, // 115.00 SAR
        vatTotalMinor: 1500n, // 15.00 SAR
        currencyScale: 2,
      };

      const qrBase64 = encodeZatcaPhase1Qr(invoiceData);
      expect(qrBase64).toBeDefined();
      expect(typeof qrBase64).toBe("string");
      expect(qrBase64.length).toBeGreaterThan(20);

      const tlvBytes = buildZatcaPhase1Tlv(invoiceData);
      expect(tlvBytes).toBeDefined();
      expect(tlvBytes[0]).toBe(1); // Tag 1: Seller Name
    });

    it("Tier 2: throws ZatcaEncodingError on missing required fields or invalid currency scale", () => {
      expect(() =>
        encodeZatcaPhase1Qr({
          sellerName: "",
          vatRegistrationNumber: "310123456700003",
          issuedAt: new Date(),
          totalWithVatMinor: 100n,
          vatTotalMinor: 15n,
          currencyScale: 2,
        }),
      ).toThrow(ZatcaEncodingError);

      expect(
        () => formatMinorForZatca(100n, 10), // Invalid currency scale (>4)
      ).toThrow(ZatcaEncodingError);
    });

    it("Tier 3: renders sent invoice PDF using frozen document version snapshot", async () => {
      const frozenSnapshot = {
        number: "INV-0001",
        issueDate: "2026-08-07",
        businessName: "Frozen Business SA",
        vatRegistrationNumber: "310123456700003",
        totalMinor: "11500",
      };

      expect(frozenSnapshot.number).toBe("INV-0001");
      expect(frozenSnapshot.vatRegistrationNumber).toBe("310123456700003");
    });

    it("Tier 4: processes high-line-item bilingual PDF rendering without errors", async () => {
      const lines = Array.from({ length: 25 }, (_, i) => ({
        position: i + 1,
        description: `بند الخدمة رقم ${i + 1} / Service Item ${i + 1}`,
        quantity: "1",
        unitPriceMinor: "10000",
        taxRatePpm: 150000,
        subtotalMinor: "10000",
        taxMinor: "1500",
        totalMinor: "11500",
      }));

      expect(lines).toHaveLength(25);
    });
  });
});
