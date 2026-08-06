import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "./app.module.js";
import { ConfigurationService } from "./configuration/configuration.service.js";
import { CustomersService } from "./customers/customers.service.js";
import { DatabaseService } from "./database/database.service.js";
import { PdfService } from "./documents/pdf.service.js";
import { QuotationsService } from "./documents/quotations.service.js";
import { IdentityService } from "./identity/identity.service.js";
import { MailService } from "./mail/mail.service.js";
import { PlatformService } from "./platform/platform.service.js";
import { BusinessAccessService } from "./security/business-access.service.js";
import { InternalAuthGuard } from "./security/internal-auth.guard.js";
import { ERPNEXT_CLIENT } from "./erpnext/erpnext.module.js";

describe("Nest dependency injection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves application services from explicit runtime tokens", async () => {
    const database = { client: {}, withScope: () => undefined };
    const access = { resolve: () => undefined, assertAllowed: () => undefined };
    const pdf = { renderQuotation: () => undefined };
    const mail = { sendQuotation: () => undefined };
    const configuration = {
      assignDefaultErp: () => undefined,
      assignConfiguration: () => undefined,
      getActiveAssignment: () => undefined,
      getEnabledModules: () => undefined,
      getInvoiceConversionPolicy: () => undefined,
      getDefaultErpPublishedVersion: () => undefined,
      getPublishedVersion: () => undefined,
      createDocumentWorkflowContext: () => undefined,
    };
    const module = await Test.createTestingModule({
      providers: [
        IdentityService,
        CustomersService,
        PlatformService,
        QuotationsService,
        { provide: DatabaseService, useValue: database },
        { provide: BusinessAccessService, useValue: access },
        { provide: ConfigurationService, useValue: configuration },
        { provide: PdfService, useValue: pdf },
        { provide: MailService, useValue: mail },
        { provide: ERPNEXT_CLIENT, useValue: { isConfigured: () => false, createDocument: () => undefined } },
      ],
    }).compile();

    expect(module.get(IdentityService)).toBeInstanceOf(IdentityService);
    expect(module.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(module.get(PlatformService)).toBeInstanceOf(PlatformService);
    expect(module.get(QuotationsService)).toBeInstanceOf(QuotationsService);

    await module.close();
  });

  it("resolves the global authentication guard from its runtime token", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/bizo");
    vi.stubEnv("INTERNAL_AUTH_SECRET", "test-only-internal-auth-secret-32-bytes");
    vi.stubEnv("SMTP_FROM", "quotes@example.test");
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");

    const module = await Test.createTestingModule({
      providers: [Reflector, InternalAuthGuard],
    }).compile();

    expect(module.get(InternalAuthGuard)).toBeInstanceOf(InternalAuthGuard);

    await module.close();
  });

  it("compiles the complete application dependency graph", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/bizo");
    vi.stubEnv("INTERNAL_AUTH_SECRET", "test-only-internal-auth-secret-32-bytes");
    vi.stubEnv("SMTP_FROM", "quotes@example.test");
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025");

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppModule)).toBeInstanceOf(AppModule);

    await module.close();
  });
});
