import { NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { OnboardingService } from "../onboarding/onboarding.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("onboarding assignment integration with PostgreSQL", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let configuration: ConfigurationService;
  let onboarding: OnboardingService;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database);
    platform = new PlatformService(database, access, configuration);
    onboarding = new OnboardingService(configuration);
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  it("creates a business, verifies default-erp is auto-assigned, then applies a customized recommendation", async () => {
    const owner = await identity.signUp({
      displayName: "Onboarding Owner",
      email: `onboarding-owner-${Date.now()}@example.test`,
      password: "Production1Password",
    });

    // createBusiness now auto-assigns default-erp as the primary configuration.
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Onboarding Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-onboarding-business",
    );

    // Verify the auto-assigned primary is default-erp.
    const initialAssignment = await configuration.getActiveAssignment(owner.id, business.id);
    expect(initialAssignment.templateCode).toBe("default-erp");
    expect(initialAssignment.isPrimary).toBe(true);

    // Run the customize flow: get questionnaire, recommend, apply.
    const questionnaire = onboarding.getQuestionnaire();
    expect(questionnaire.steps.length).toBeGreaterThan(0);

    const recommendation = await onboarding.recommend({
      answers: {
        country: "SA",
        currency: "SAR",
        businessType: "services",
        quotations: "true",
        customerPurchaseOrders: "required",
        invoiceApproval: "required",
        taxRegistration: "registered",
        numberingPreferences: "QUO-",
      },
    });

    // Customer PO required + invoice approval required → service-po-approval.
    expect(recommendation.configurationTemplateCode).toBe("service-po-approval");

    const applied = await onboarding.applyRecommendation({
      userPublicId: owner.id,
      businessPublicId: business.id,
      request: {
        recommendation,
        consentToReview: true,
      },
    });

    expect(applied.templateCode).toBe("service-po-approval");
    expect(applied.isPrimary).toBe(true);

    // Verify the active assignment changed to service-po-approval.
    const finalAssignment = await configuration.getActiveAssignment(owner.id, business.id);
    expect(finalAssignment.templateCode).toBe("service-po-approval");
    expect(finalAssignment.isPrimary).toBe(true);
  }, 60_000);

  it("rejects cross-tenant access to another business's onboarding apply", async () => {
    const owner = await identity.signUp({
      displayName: "Onboarding Outsider",
      email: `onboarding-outsider-${Date.now()}@example.test`,
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
      "integration-onboarding-outsider-business",
    );

    const recommendation = await onboarding.recommend({
      answers: { country: "SA", currency: "SAR", businessType: "services" },
    });

    const outsider = await identity.signUp({
      displayName: "Other User",
      email: `onboarding-other-${Date.now()}@example.test`,
      password: "Production2Password",
    });

    await expect(
      onboarding.applyRecommendation({
        userPublicId: outsider.id,
        businessPublicId: business.id,
        request: { recommendation, consentToReview: true },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  }, 60_000);
});
