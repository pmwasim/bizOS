import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DocumentStatus, RoleCode } from "@bizo/database";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { type MailService } from "../mail/mail.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";
import { type PdfService } from "./pdf.service.js";
import { QuotationsService } from "./quotations.service.js";

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

const configuration = {
  createDocumentWorkflowContext: vi.fn().mockResolvedValue({
    id: "ctx",
    documentId: "doc",
    documentType: "QUOTATION",
    configurationTemplateVersionId: "ver",
    workflowTemplateVersionId: null,
    workflowState: null,
    capturedSnapshot: {},
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  }),
} as unknown as ConfigurationService;

describe("QuotationsService delivery", () => {
  it("lets the parent document supply scope keys for nested quotation lines", async () => {
    const now = new Date("2026-07-27T09:00:00.000Z");
    const documentCreate = vi.fn().mockResolvedValue({
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
      issueDate: new Date("2026-07-27T00:00:00.000Z"),
      validUntil: new Date("2026-08-26T00:00:00.000Z"),
      lines: [
        {
          description: "Service",
          position: 1,
          quantity: "1",
          unitPriceMinor: "10000",
          taxRatePpm: 150_000,
          subtotalMinor: "10000",
          taxMinor: "1500",
          totalMinor: "11500",
        },
      ],
      number: "Q-0001",
      sentAt: null,
      status: DocumentStatus.DRAFT,
      subtotalMinor: "10000",
      taxMinor: "1500",
      totalMinor: "11500",
      version: 1,
    });
    const transaction = {
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
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: 5n,
        }),
      },
      document: { create: documentCreate },
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
    const service = new QuotationsService(
      database,
      businessAccess,
      {} as PdfService,
      {} as MailService,
      configuration,
    );

    await service.create(
      access.userPublicId,
      access.businessPublicId,
      {
        customerId: "f3fb94c1-a48a-4f09-82fc-93477534b1f4",
        issueDate: "2026-07-27",
        validUntil: "2026-08-26",
        lines: [
          {
            description: "Service",
            quantity: "1",
            unitPrice: "100",
            taxRatePercent: "15",
          },
        ],
      },
      "request-1",
    );

    const nestedLines = documentCreate.mock.calls[0]?.[0].data.lines.create as Array<
      Record<string, unknown>
    >;
    expect(nestedLines).toHaveLength(1);
    expect(nestedLines[0]).not.toHaveProperty("tenantId");
    expect(nestedLines[0]).not.toHaveProperty("businessId");
  });

  it("records an SMTP failure without losing the finalized quotation", async () => {
    const now = new Date("2026-07-27T09:00:00.000Z");
    const record = {
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
      issueDate: now,
      validUntil: new Date("2026-08-26T00:00:00.000Z"),
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
      number: "Q-0001",
      sentAt: null,
      status: DocumentStatus.DRAFT,
      subtotalMinor: "10000",
      taxMinor: "0",
      totalMinor: "10000",
      version: 1,
    };
    const deliveryUpdate = vi.fn().mockResolvedValue(undefined);
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue(record),
        update: vi.fn().mockResolvedValue({ ...record, status: DocumentStatus.SENT, sentAt: now }),
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
      documentVersion: { create: vi.fn().mockResolvedValue(undefined) },
      documentDelivery: {
        create: vi.fn().mockResolvedValue({
          id: 20n,
          publicId: "292cbaf9-17d8-4129-8fbf-c59e32fd5587",
        }),
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
      renderQuotation: vi.fn().mockResolvedValue(Buffer.from("%PDF-test")),
    } as unknown as PdfService;
    const mail = {
      sendQuotation: vi.fn().mockRejectedValue({ code: "ECONNREFUSED" }),
    } as unknown as MailService;
    const service = new QuotationsService(database, businessAccess, pdf, mail, configuration);

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
    expect(transaction.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) }),
    );
  });

  it("renders sent quotation PDFs from the frozen document snapshot", async () => {
    const now = new Date("2026-07-27T09:00:00.000Z");
    const frozenSnapshot = {
      business: {
        name: "Frozen Business",
        legalName: null,
        email: null,
        phone: null,
        address: [],
        taxName: "VAT",
        taxRegistrationNumber: null,
      },
      customer: {
        name: "Frozen Customer",
        email: "customer@example.test",
        phone: null,
        address: [],
      },
      number: "Q-0001",
      issueDate: "2026-07-27",
      validUntil: "2026-08-26",
      currencyCode: "SAR",
      currencyScale: 2,
      subtotalMinor: "10000",
      taxMinor: "0",
      totalMinor: "10000",
      lines: [
        {
          description: "Service",
          quantity: "1",
          unitPriceMinor: "10000",
          taxRatePpm: 0,
          subtotalMinor: "10000",
          taxMinor: "0",
          totalMinor: "10000",
        },
      ],
    };
    const record = {
      id: 10n,
      publicId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
      createdAt: now,
      updatedAt: now,
      currencyCode: "SAR",
      currencyScale: 2,
      customer: {
        publicId: "f3fb94c1-a48a-4f09-82fc-93477534b1f4",
        name: "Changed Customer",
        email: "changed@example.test",
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: null,
      },
      issueDate: now,
      validUntil: new Date("2026-08-26T00:00:00.000Z"),
      lines: [],
      number: "Q-0001",
      sentAt: now,
      status: DocumentStatus.SENT,
      subtotalMinor: "10000",
      taxMinor: "0",
      totalMinor: "10000",
      version: 1,
    };
    const transaction = {
      document: {
        findFirst: vi.fn().mockResolvedValue(record),
      },
      documentVersion: {
        findFirst: vi.fn().mockResolvedValue({ snapshot: frozenSnapshot }),
      },
      business: {
        findUniqueOrThrow: vi.fn(),
      },
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
    const renderQuotation = vi.fn().mockResolvedValue(Buffer.from("%PDF-frozen"));
    const service = new QuotationsService(
      database,
      businessAccess,
      { renderQuotation } as unknown as PdfService,
      {} as MailService,
      configuration,
    );

    const result = await service.renderPdf(
      access.userPublicId,
      access.businessPublicId,
      record.publicId,
    );

    expect(result.filename).toBe("Q-0001.pdf");
    expect(renderQuotation).toHaveBeenCalledWith(frozenSnapshot);
    expect(transaction.business.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
