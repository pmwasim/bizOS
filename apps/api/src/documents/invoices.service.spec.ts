import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DocumentStatus, RoleCode } from "@bizo/database";
import { type ObjectStore } from "@bizo/storage";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type MailService } from "../mail/mail.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";
import { type PdfService } from "./pdf.service.js";
import { InvoicesService } from "./invoices.service.js";

const configuration = {
  getInvoiceConversionPolicy: vi.fn().mockResolvedValue({
    customerPoRequired: true,
    approvalEvidenceRequired: true,
    templateCode: "service-po-approval",
    templateVersion: "1.0.0",
  }),
  createDocumentWorkflowContext: vi.fn().mockResolvedValue({
    id: "ctx",
    documentId: "doc",
    documentType: "INVOICE",
    configurationTemplateVersionId: "ver",
    workflowTemplateVersionId: null,
    workflowState: null,
    capturedSnapshot: {},
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  }),
} as unknown as ConfigurationService;

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

function baseInvoiceRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-28T09:00:00.000Z");
  return {
    id: 10n,
    publicId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
    createdAt: now,
    updatedAt: now,
    currencyCode: "SAR",
    currencyScale: 2,
    customer: {
      publicId: "f3fb94c1-a48a-4f09-82fc-93477534b1f4",
      name: "Customer",
      email: "customer@example.test",
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: null,
    },
    issueDate: new Date("2026-07-28T00:00:00.000Z"),
    dueDate: new Date("2026-08-27T00:00:00.000Z"),
    validUntil: new Date("2026-08-27T00:00:00.000Z"),
    lines: [
      {
        description: "Service",
        position: 1,
        quantity: "1",
        unitPriceMinor: "10000",
        taxRatePpm: 0,
        subtotalMinor: "10000",
        taxMinor: "0",
        totalMinor: "10000",
      },
    ],
    number: "INV-0001",
    notes: null,
    poNumberSnapshot: "PO-9",
    projectReference: null,
    purchaseOrderId: 8n,
    sourceQuotationId: 7n,
    sourceQuotation: { publicId: "11111111-1111-4111-8111-111111111111", number: "Q-0001" },
    linkedPurchaseOrder: { publicId: "22222222-2222-4222-8222-222222222222", poNumber: "PO-9" },
    sentAt: null,
    archivedAt: null,
    status: DocumentStatus.READY_TO_SEND,
    subtotalMinor: "10000",
    taxMinor: "0",
    totalMinor: "10000",
    version: 1,
    ...overrides,
  };
}

describe("InvoicesService", () => {
  it("marks SEND_FAILED when email fails and never marks SENT", async () => {
    const record = baseInvoiceRecord();
    const documentUpdate = vi.fn().mockResolvedValue({
      ...record,
      status: DocumentStatus.SEND_FAILED,
    });
    const deliveryUpdate = vi.fn().mockResolvedValue(undefined);
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue(record),
        update: documentUpdate,
      },
      business: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          name: "Acme Services",
          legalName: null,
          email: null,
          phone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          postalCode: null,
          settings: {},
          taxProfile: { name: "Tax", registrationNumber: null },
        }),
      },
      documentVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          publicId: "33333333-3333-4333-8333-333333333333",
          pdfStorageKey: null,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      documentDelivery: {
        create: vi.fn().mockResolvedValue({
          id: 20n,
          publicId: "292cbaf9-17d8-4129-8fbf-c59e32fd5587",
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: deliveryUpdate,
      },
      auditEvent: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const pdf = {
      renderInvoice: vi.fn().mockResolvedValue(Buffer.from("%PDF-test")),
    } as unknown as PdfService;
    const mail = {
      sendInvoice: vi.fn().mockRejectedValue({ code: "ECONNREFUSED" }),
    } as unknown as MailService;
    const objectStore = {
      put: vi.fn(),
      get: vi.fn(),
    } as unknown as ObjectStore;
    const service = new InvoicesService(
      database,
      businessAccess,
      pdf,
      mail,
      objectStore,
      { isConfigured: () => false } as never,
      configuration,
    );

    await expect(
      service.send(
        access.userPublicId,
        access.businessPublicId,
        record.publicId,
        { recipientEmail: "customer@example.test", message: null },
        "request-1",
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(deliveryUpdate).toHaveBeenCalledWith({
      where: { id: 20n },
      data: {
        status: "FAILED",
        providerMessageId: undefined,
        failureReason: "ECONNREFUSED",
        sentAt: undefined,
      },
    });
    expect(documentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DocumentStatus.SEND_FAILED }),
      }),
    );
    expect(objectStore.put).toHaveBeenCalledOnce();
    const sentCalls = documentUpdate.mock.calls.filter(
      (call) => call[0]?.data?.status === DocumentStatus.SENT,
    );
    expect(sentCalls).toHaveLength(0);
  });

  it("rejects updates after the invoice is finalized", async () => {
    const record = baseInvoiceRecord({ status: DocumentStatus.SENT });
    const transaction = {
      document: { findFirst: vi.fn().mockResolvedValue(record) },
      documentDelivery: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new InvoicesService(
      database,
      businessAccess,
      {} as PdfService,
      {} as MailService,
      { put: vi.fn(), get: vi.fn() } as unknown as ObjectStore,
      { isConfigured: () => false } as never,
      configuration,
    );

    await expect(
      service.update(
        access.userPublicId,
        access.businessPublicId,
        record.publicId,
        {
          lines: [
            {
              description: "Service",
              quantity: "1",
              unitPrice: "100.00",
              taxRatePercent: "0",
            },
          ],
        },
        "request-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects create when quotation readiness is not READY_TO_INVOICE", async () => {
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 7n,
          publicId: "11111111-1111-4111-8111-111111111111",
          customerId: 5n,
          currencyCode: "SAR",
          currencyScale: 2,
          status: DocumentStatus.SENT,
          subtotalMinor: "10000",
          taxMinor: "0",
          totalMinor: "10000",
          customer: {},
          lines: [],
        }),
      },
      purchaseOrder: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new InvoicesService(
      database,
      businessAccess,
      {} as PdfService,
      {} as MailService,
      { put: vi.fn(), get: vi.fn() } as unknown as ObjectStore,
      { isConfigured: () => false } as never,
      configuration,
    );

    await expect(
      service.createFromQuotation(
        access.userPublicId,
        access.businessPublicId,
        { quotationId: "11111111-1111-4111-8111-111111111111" },
        "request-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an invoice without a customer PO when Default ERP does not require one", async () => {
    const defaultErpConfiguration = {
      getInvoiceConversionPolicy: vi.fn().mockResolvedValue({
        customerPoRequired: false,
        approvalEvidenceRequired: false,
        templateCode: "default-erp",
        templateVersion: "1.0.0",
      }),
      createDocumentWorkflowContext: vi.fn().mockResolvedValue({
        id: "ctx",
        documentId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        documentType: "INVOICE",
        configurationTemplateVersionId: "ver",
        workflowTemplateVersionId: null,
        workflowState: null,
        capturedSnapshot: {},
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }),
    } as unknown as ConfigurationService;

    const created = baseInvoiceRecord({
      purchaseOrderId: null,
      poNumberSnapshot: null,
      linkedPurchaseOrder: null,
    });
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 7n,
          publicId: "11111111-1111-4111-8111-111111111111",
          customerId: 5n,
          currencyCode: "SAR",
          currencyScale: 2,
          status: DocumentStatus.SENT,
          subtotalMinor: "10000",
          taxMinor: "0",
          totalMinor: "10000",
          customer: created.customer,
          lines: created.lines,
        }),
        create: vi.fn().mockResolvedValue(created),
      },
      purchaseOrder: { findMany: vi.fn().mockResolvedValue([]) },
      business: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          timeZone: "Asia/Riyadh",
          settings: {},
          taxProfile: {},
        }),
      },
      businessSettings: {
        update: vi.fn().mockResolvedValue({
          invoiceDueDays: 30,
          invoicePrefix: "INV",
          nextInvoiceNumber: 2,
        }),
      },
      auditEvent: { create: vi.fn() },
    };
    const database = {
      withScope: vi
        .fn()
        .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
          work(transaction as never),
        ),
    } as unknown as DatabaseService;
    const businessAccess = {
      resolve: vi.fn().mockResolvedValue(access),
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as BusinessAccessService;
    const service = new InvoicesService(
      database,
      businessAccess,
      {} as PdfService,
      {} as MailService,
      { put: vi.fn(), get: vi.fn() } as unknown as ObjectStore,
      { isConfigured: () => false } as never,
      defaultErpConfiguration,
    );

    const invoice = await service.createFromQuotation(
      access.userPublicId,
      access.businessPublicId,
      { quotationId: "11111111-1111-4111-8111-111111111111" },
      "request-1",
    );

    expect(invoice.purchaseOrder).toBeNull();
    expect(transaction.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purchaseOrderId: null,
          poNumberSnapshot: null,
        }),
      }),
    );
    expect(defaultErpConfiguration.createDocumentWorkflowContext).toHaveBeenCalled();
  });
});

function sentQuotationRecord() {
  return {
    id: 7n,
    publicId: "11111111-1111-4111-8111-111111111111",
    customerId: 5n,
    currencyCode: "SAR",
    currencyScale: 2,
    status: DocumentStatus.SENT,
    subtotalMinor: "10000",
    taxMinor: "0",
    totalMinor: "10000",
    customer: { name: "Customer" },
    lines: [
      {
        description: "Service",
        position: 1,
        quantity: "1",
        unitPriceMinor: "10000",
        taxRatePpm: 0,
        subtotalMinor: "10000",
        taxMinor: "0",
        totalMinor: "10000",
      },
    ],
  };
}

function convertConfiguration() {
  return {
    getInvoiceConversionPolicy: vi.fn(),
    createDocumentWorkflowContext: vi.fn().mockResolvedValue({
      id: "ctx",
      documentId: "doc",
      documentType: "INVOICE",
      configurationTemplateVersionId: "ver",
      workflowTemplateVersionId: null,
      workflowState: null,
      capturedSnapshot: {},
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }),
  } as unknown as ConfigurationService;
}

function buildService(transaction: unknown, config: ConfigurationService) {
  const database = {
    withScope: vi
      .fn()
      .mockImplementation(async (_scope: unknown, work: (value: never) => Promise<unknown>) =>
        work(transaction as never),
      ),
  } as unknown as DatabaseService;
  const businessAccess = {
    resolve: vi.fn().mockResolvedValue(access),
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  } as unknown as BusinessAccessService;
  return new InvoicesService(
    database,
    businessAccess,
    {} as PdfService,
    {} as MailService,
    { put: vi.fn(), get: vi.fn() } as unknown as ObjectStore,
    { isConfigured: () => false } as never,
    config,
  );
}

describe("InvoicesService.convertFromQuotation", () => {
  it("creates a DRAFT invoice from a sent quotation (happy path)", async () => {
    const created = baseInvoiceRecord({
      status: DocumentStatus.DRAFT,
      purchaseOrderId: null,
      poNumberSnapshot: null,
      linkedPurchaseOrder: null,
    });
    const documentCreate = vi.fn().mockResolvedValue(created);
    const transaction = {
      document: {
        // First findFirst resolves the quotation; second is the idempotency lookup (no existing).
        findFirst: vi.fn().mockResolvedValueOnce(sentQuotationRecord()).mockResolvedValueOnce(null),
        create: documentCreate,
      },
      business: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          timeZone: "Asia/Riyadh",
          settings: {},
          taxProfile: {},
        }),
      },
      businessSettings: {
        update: vi.fn().mockResolvedValue({
          invoiceDueDays: 30,
          invoicePrefix: "INV",
          nextInvoiceNumber: 2,
        }),
      },
      auditEvent: { create: vi.fn() },
    };
    const config = convertConfiguration();
    const service = buildService(transaction, config);

    const invoice = await service.convertFromQuotation(
      access.userPublicId,
      access.businessPublicId,
      "11111111-1111-4111-8111-111111111111",
      "request-1",
    );

    expect(invoice.status).toBe("DRAFT");
    expect(documentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DocumentStatus.DRAFT,
          type: "INVOICE",
          sourceQuotationId: 7n,
        }),
      }),
    );
    expect(config.createDocumentWorkflowContext).toHaveBeenCalledOnce();
  });

  it("is idempotent: returns the existing invoice without creating a duplicate", async () => {
    const existing = baseInvoiceRecord({ status: DocumentStatus.DRAFT });
    const documentCreate = vi.fn();
    const transaction = {
      document: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(sentQuotationRecord())
          .mockResolvedValueOnce(existing),
        create: documentCreate,
      },
      auditEvent: { create: vi.fn() },
    };
    const config = convertConfiguration();
    const service = buildService(transaction, config);

    const invoice = await service.convertFromQuotation(
      access.userPublicId,
      access.businessPublicId,
      "11111111-1111-4111-8111-111111111111",
      "request-1",
    );

    expect(invoice.id).toBe(existing.publicId);
    expect(documentCreate).not.toHaveBeenCalled();
    expect(config.createDocumentWorkflowContext).not.toHaveBeenCalled();
  });

  it("throws NotFound when the quotation does not exist", async () => {
    const transaction = {
      document: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const config = convertConfiguration();
    const service = buildService(transaction, config);

    await expect(
      service.convertFromQuotation(
        access.userPublicId,
        access.businessPublicId,
        "11111111-1111-4111-8111-111111111111",
        "request-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
