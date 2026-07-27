import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { CustomersService } from "./customers/customers.service.js";
import { DatabaseService } from "./database/database.service.js";
import { QuotationsService } from "./documents/quotations.service.js";
import { PdfService } from "./documents/pdf.service.js";
import { IdentityService } from "./identity/identity.service.js";
import { MailService } from "./mail/mail.service.js";
import { PlatformService } from "./platform/platform.service.js";
import { BusinessAccessService } from "./security/business-access.service.js";

describe("Nest dependency injection", () => {
  it("resolves application services from explicit runtime tokens", async () => {
    const database = { client: {}, withScope: () => undefined };
    const access = { resolve: () => undefined, assertAllowed: () => undefined };
    const pdf = { renderQuotation: () => undefined };
    const mail = { sendQuotation: () => undefined };
    const module = await Test.createTestingModule({
      providers: [
        IdentityService,
        CustomersService,
        PlatformService,
        QuotationsService,
        { provide: DatabaseService, useValue: database },
        { provide: BusinessAccessService, useValue: access },
        { provide: PdfService, useValue: pdf },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    expect(module.get(IdentityService)).toBeInstanceOf(IdentityService);
    expect(module.get(CustomersService)).toBeInstanceOf(CustomersService);
    expect(module.get(PlatformService)).toBeInstanceOf(PlatformService);
    expect(module.get(QuotationsService)).toBeInstanceOf(QuotationsService);

    await module.close();
  });
});
