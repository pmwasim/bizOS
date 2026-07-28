import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { CustomizationService } from "../customization/customization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { PlatformService } from "../platform/platform.service.js";
import * as n8nNotifier from "../customization/n8n-notifier.js";
import { BusinessAccessService } from "../security/business-access.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("customization request integration with PostgreSQL", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let configuration: ConfigurationService;
  let customization: CustomizationService;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database);
    platform = new PlatformService(database, access, configuration);
    customization = new CustomizationService(database, access, configuration);
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  it("creates, lists, and retrieves a customization request with the active configuration version", async () => {
    const owner = await identity.signUp({
      displayName: "Customization Owner",
      email: `customization-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });

    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Customization Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-customization-business",
    );

    const assignment = await configuration.getActiveAssignment(owner.id, business.id);
    expect(assignment.templateCode).toBe("default-erp");

    const notifySpy = vi
      .spyOn(n8nNotifier, "notifyCustomizationRequestCreated")
      .mockResolvedValue(undefined);

    const created = await customization.createRequest({
      userPublicId: owner.id,
      businessPublicId: business.id,
      statedProcess: "We quote, get PO approval, then invoice.",
      requestedChanges: "Add a custom invoice prefix and approval step.",
      urgency: "MEDIUM",
      notes: "Prefer email follow-up.",
      consentToReview: true,
    });

    expect(created.status).toBe("OPEN");
    expect(created.businessId).toBe(business.id);
    expect(created.currentConfigurationTemplateVersionId).toBe(
      assignment.configurationTemplateVersionId,
    );
    expect(created.statedProcess).toEqual({
      text: "We quote, get PO approval, then invoice.",
    });
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        businessId: business.id,
        currentConfigurationTemplateVersionId: assignment.configurationTemplateVersionId,
      }),
    );

    const listed = await customization.listRequests({
      userPublicId: owner.id,
      businessPublicId: business.id,
    });
    expect(listed.items.some((item) => item.id === created.id)).toBe(true);

    const fetched = await customization.getRequest({
      userPublicId: owner.id,
      businessPublicId: business.id,
      requestId: created.id,
    });
    expect(fetched.id).toBe(created.id);
    expect(fetched.requestedChanges).toEqual({
      text: "Add a custom invoice prefix and approval step.",
    });

    notifySpy.mockRestore();
  }, 60_000);

  it("rejects cross-tenant access to another business's customization requests", async () => {
    const owner = await identity.signUp({
      displayName: "Customization Tenant Owner",
      email: `customization-tenant-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Tenant Locked Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-customization-tenant-business",
    );

    const outsider = await identity.signUp({
      displayName: "Customization Outsider",
      email: `customization-outsider-${Date.now()}@example.test`,
      password: "Production2Password",
    });

    await expect(
      customization.listRequests({
        userPublicId: outsider.id,
        businessPublicId: business.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  }, 60_000);
});
