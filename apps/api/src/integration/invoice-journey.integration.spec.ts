import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { InvoiceApprovalStatus, PurchaseOrderStatus, StoredObjectKind } from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { CustomersService } from "../customers/customers.service.js";
import { DatabaseService } from "../database/database.service.js";
import { InvoicesService } from "../documents/invoices.service.js";
import { PdfService } from "../documents/pdf.service.js";
import { QuotationsService } from "../documents/quotations.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { type MailService } from "../mail/mail.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { type ObjectStore } from "@bizo/storage";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("invoice journey with PostgreSQL boundaries", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let customers: CustomersService;
  let quotations: QuotationsService;
  let invoices: InvoicesService;
  let mail: { sendInvoice: ReturnType<typeof vi.fn>; sendQuotation: ReturnType<typeof vi.fn> };
  let objectStore: ObjectStore;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    const configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database);
    platform = new PlatformService(database, access, configuration);
    customers = new CustomersService(database, access, {} as any);
    mail = {
      sendQuotation: vi.fn().mockResolvedValue("integration-quotation-1"),
      sendInvoice: vi.fn().mockResolvedValue("integration-invoice-1"),
    };
    objectStore = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi
        .fn()
        .mockResolvedValue({ body: Buffer.from("%PDF-stored"), contentType: "application/pdf" }),
    };
    quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      mail as unknown as MailService,
      {} as any,
      configuration,
    );
    invoices = new InvoicesService(
      database,
      access,
      new PdfService(),
      mail as unknown as MailService,
      objectStore,
      {} as any,
      configuration,
    );
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  async function seedReadyQuotation() {
    const owner = await identity.signUp({
      displayName: "Invoice Owner",
      email: `invoice-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Invoice Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-invoice-business",
    );
    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: "Invoice Customer",
        email: "invoice-customer@example.test",
        phone: null,
        addressLine1: "King Fahd Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: null,
        countryCode: "SA",
      },
      "integration-invoice-customer",
    );
    const quotation = await quotations.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          {
            description: "Professional services",
            quantity: "2",
            unitPrice: "100.00",
            taxRatePercent: "15",
          },
        ],
      },
      "integration-invoice-quotation",
    );

    const accessCtx = await new BusinessAccessService(database).resolve(owner.id, business.id);
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
          poNumber: `PO-${Date.now()}`,
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

    return { owner, business, customer, quotation };
  }

  it("creates from a ready quotation, sends, and denies cross-tenant access", async () => {
    const { owner, business, quotation } = await seedReadyQuotation();

    await expect(
      invoices.createFromQuotation(
        owner.id,
        business.id,
        { quotationId: quotation.id },
        "integration-create-not-ready-yet",
      ),
    ).resolves.toMatchObject({
      status: "READY_TO_SEND",
      number: "INV-0001",
      sourceQuotation: { id: quotation.id, number: quotation.number },
      totalMinor: quotation.totalMinor,
    });

    const invoice = await invoices.createFromQuotation(
      owner.id,
      business.id,
      { quotationId: quotation.id },
      "integration-create-second",
    );
    expect(invoice.number).toBe("INV-0002");

    const sent = await invoices.send(
      owner.id,
      business.id,
      invoice.id,
      { recipientEmail: "invoice-customer@example.test", message: null },
      "integration-send",
    );
    expect(sent.invoice.status).toBe("SENT");
    expect(sent.delivery.status).toBe("SENT");
    expect(objectStore.put).toHaveBeenCalled();
    expect(mail.sendInvoice).toHaveBeenCalled();

    const outsider = await identity.signUp({
      displayName: "Other Owner",
      email: `other-invoice-${Date.now()}@example.test`,
      password: "Production2Password",
    });
    await expect(invoices.list(outsider.id, business.id)).rejects.toBeInstanceOf(NotFoundException);
  }, 60_000);

  it("rejects create when quotation is not ready to invoice", async () => {
    const owner = await identity.signUp({
      displayName: "Not Ready Owner",
      email: `not-ready-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Not Ready Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-not-ready-business",
    );
    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: "Customer",
        email: "c@example.test",
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: "SA",
      },
      "integration-not-ready-customer",
    );
    const quotation = await quotations.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          {
            description: "Work",
            quantity: "1",
            unitPrice: "50.00",
            taxRatePercent: "0",
          },
        ],
      },
      "integration-not-ready-quotation",
    );

    await expect(
      invoices.createFromQuotation(
        owner.id,
        business.id,
        { quotationId: quotation.id },
        "integration-reject-not-ready",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  }, 30_000);

  it("keeps SEND_FAILED when email fails and recovers on resend", async () => {
    const { owner, business, quotation } = await seedReadyQuotation();
    const invoice = await invoices.createFromQuotation(
      owner.id,
      business.id,
      { quotationId: quotation.id },
      "integration-fail-create",
    );

    mail.sendInvoice.mockRejectedValueOnce({ code: "ECONNREFUSED" });
    await expect(
      invoices.send(
        owner.id,
        business.id,
        invoice.id,
        { recipientEmail: "invoice-customer@example.test", message: null },
        "integration-fail-send",
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "DELIVERY_FAILED" }) });

    const failed = await invoices.get(owner.id, business.id, invoice.id);
    expect(failed.status).toBe("SEND_FAILED");

    mail.sendInvoice.mockResolvedValueOnce("integration-retry-1");
    const resent = await invoices.send(
      owner.id,
      business.id,
      invoice.id,
      { recipientEmail: "invoice-customer@example.test", message: null },
      "integration-retry-send",
    );
    expect(resent.invoice.status).toBe("SENT");
  }, 60_000);
});
