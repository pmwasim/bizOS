import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DocumentType } from "@bizo/database";

import { CustomersService } from "../customers/customers.service.js";
import { DatabaseService } from "../database/database.service.js";
import { QuotationsService } from "../documents/quotations.service.js";
import { PdfService } from "../documents/pdf.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { type MailService } from "../mail/mail.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

import { ConfigurationService } from "../configuration/configuration.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("configuration assignment integration with PostgreSQL", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let customers: CustomersService;
  let quotations: QuotationsService;
  let configuration: ConfigurationService;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    identity = new IdentityService(database);
    configuration = new ConfigurationService(database, access);
    platform = new PlatformService(database, access, configuration);
    customers = new CustomersService(database, access, {} as any);
    quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      {
        sendQuotation: () => undefined,
      } as unknown as MailService,
      {} as any,
      configuration,
    );
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  it("assigns default-erp, returns the active assignment, and filters unimplemented modules", async () => {
    const owner = await identity.signUp({
      displayName: "Config Owner",
      email: `config-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Config Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-config-business",
    );

    const assignment = await configuration.assignDefaultErp({
      userPublicId: owner.id,
      businessPublicId: business.id,
    });

    expect(assignment.isPrimary).toBe(true);
    expect(assignment.templateCode).toBe("default-erp");

    const active = await configuration.getActiveAssignment(owner.id, business.id);
    expect(active.templateCode).toBe("default-erp");
    expect(active.snapshot.modules.some((m) => m.code === "customers" && m.enabled)).toBe(true);

    const enabled = await configuration.getEnabledModules(owner.id, business.id);
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.every((m) => m.implemented)).toBe(true);
    const enabledCodes = enabled.map((m) => m.code).sort();
    expect(enabledCodes).toContain("customers");
    expect(enabledCodes).toContain("quotations");
    expect(enabledCodes).not.toContain("sales-orders");
  }, 60_000);

  it("captures a document workflow context tied to the active assignment", async () => {
    const owner = await identity.signUp({
      displayName: "Workflow Owner",
      email: `workflow-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Workflow Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-workflow-business",
    );
    await configuration.assignDefaultErp({
      userPublicId: owner.id,
      businessPublicId: business.id,
    });

    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: "Workflow Customer",
        email: "workflow-customer@example.test",
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: "SA",
      },
      "integration-workflow-customer",
    );
    const quotation = await quotations.create(
      owner.id,
      business.id,
      {
        customerId: customer.id,
        lines: [
          {
            description: "Service",
            quantity: "1",
            unitPrice: "100.00",
            taxRatePercent: "0",
          },
        ],
      },
      "integration-workflow-quotation",
    );

    const context = await configuration.createDocumentWorkflowContext({
      userPublicId: owner.id,
      businessPublicId: business.id,
      documentId: quotation.id,
      documentType: DocumentType.QUOTATION,
    });

    expect(context.documentId).toBe(quotation.id);
    expect(context.configurationTemplateVersionId).toBeTruthy();
    expect(context.capturedSnapshot).toBeDefined();

    const idempotent = await configuration.createDocumentWorkflowContext({
      userPublicId: owner.id,
      businessPublicId: business.id,
      documentId: quotation.id,
      documentType: DocumentType.QUOTATION,
    });
    expect(idempotent.id).toBe(context.id);
  }, 60_000);

  it("rejects cross-tenant access to another business's configuration", async () => {
    const owner = await identity.signUp({
      displayName: "Outsider Owner",
      email: `outsider-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Outsider Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-outsider-business",
    );
    await configuration.assignDefaultErp({
      userPublicId: owner.id,
      businessPublicId: business.id,
    });

    const outsider = await identity.signUp({
      displayName: "Other User",
      email: `other-${Date.now()}@example.test`,
      password: "Production2Password",
    });

    await expect(
      configuration.getActiveAssignment(outsider.id, business.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  }, 60_000);
});
