import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CustomersService } from "../customers/customers.service.js";
import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { PdfService } from "../documents/pdf.service.js";
import { QuotationsService } from "../documents/quotations.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { type MailService } from "../mail/mail.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("quotation journey with PostgreSQL boundaries", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let customers: CustomersService;
  let quotations: QuotationsService;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    const configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database);
    platform = new PlatformService(database, access, configuration);
    customers = new CustomersService(database, access, { isConfigured: () => false } as never);
    quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      {
        sendQuotation: vi.fn().mockResolvedValue("integration-message-1"),
      } as unknown as MailService,
      { isConfigured: () => false } as never,
      configuration,
    );
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  it("creates and sends a tenant-scoped quotation while denying another tenant", async () => {
    const owner = await identity.signUp({
      displayName: "MVP Owner",
      email: "owner@example.test",
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Acme Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-business",
    );
    const customer = await customers.create(
      owner.id,
      business.id,
      {
        name: "Example Customer",
        email: "customer@example.test",
        phone: null,
        addressLine1: "King Fahd Road",
        addressLine2: null,
        city: "Riyadh",
        postalCode: null,
        countryCode: "SA",
      },
      "integration-customer",
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
      "integration-quotation",
    );
    const result = await quotations.send(
      owner.id,
      business.id,
      quotation.id,
      { recipientEmail: "customer@example.test", message: null },
      "integration-send",
    );

    expect(quotation.number).toBe("Q-0001");
    expect(quotation.totalMinor).toBe("23000");
    expect(result.quotation.status).toBe("SENT");
    expect(result.delivery.status).toBe("SENT");

    const outsider = await identity.signUp({
      displayName: "Other Owner",
      email: "other@example.test",
      password: "Production2Password",
    });
    await expect(quotations.list(outsider.id, business.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  }, 30_000);
});
