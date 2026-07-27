import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type OnboardingAnswers } from "@bizo/contracts/onboarding";

import { type ConfigurationService } from "../configuration/configuration.service.js";
import { OnboardingService } from "./onboarding.service.js";

const DEFAULT_ERP_VERSION_ID = "v0000000-0000-4000-8000-000000000001";
const SERVICE_PO_VERSION_ID = "v0000000-0000-4000-8000-000000000002";

function createConfigurationMock(
  overrides: Partial<ConfigurationService> = {},
): ConfigurationService {
  const defaultErpVersion = {
    id: DEFAULT_ERP_VERSION_ID,
    templateId: "t0000000-0000-4000-8000-000000000001",
    templateCode: "default-erp",
    templateName: "Default bizOS ERP",
    version: "1.0.0",
    status: "PUBLISHED" as const,
    snapshot: {
      modules: [],
      workflows: [],
      roleDefaults: [],
      tax: { enabled: false, name: "Tax", ratePercent: "0", priceIncludesTax: false },
      currency: { currencyCode: "USD", currencyScale: 2 },
      numbering: {
        quotationPrefix: "Q",
        invoicePrefix: "INV",
        quotationValidityDays: 30,
        invoiceDueDays: 30,
      },
      documentTemplates: [],
      terminology: {
        customerLabel: "Customer",
        quotationLabel: "Quotation",
        invoiceLabel: "Invoice",
      },
    },
    publishedAt: "2026-07-28T00:00:00.000Z",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
  const servicePoVersion = {
    ...defaultErpVersion,
    id: SERVICE_PO_VERSION_ID,
    templateCode: "service-po-approval",
    templateName: "Service PO & Approval",
  };
  const mock = {
    getDefaultErpPublishedVersion: vi.fn().mockResolvedValue(defaultErpVersion),
    getPublishedVersion: vi.fn().mockImplementation(async (code: string) => {
      if (code === "default-erp") return defaultErpVersion;
      if (code === "service-po-approval") return servicePoVersion;
      throw new NotFoundException(
        `No published configuration version found for template "${code}".`,
      );
    }),
    assignConfiguration: vi.fn().mockResolvedValue({
      id: "a0000000-0000-4000-8000-000000000001",
      businessId: "b0000000-0000-4000-8000-000000000001",
      configurationTemplateVersionId: DEFAULT_ERP_VERSION_ID,
      templateCode: "default-erp",
      templateVersion: "1.0.0",
      isPrimary: true,
      assignedByMembershipId: null,
      reason: "guided setup",
      assignedAt: "2026-07-28T00:00:00.000Z",
    }),
  };
  return { ...mock, ...overrides } as unknown as ConfigurationService;
}

describe("OnboardingService", () => {
  describe("getQuestionnaire", () => {
    it("returns a questionnaire with stable version and ordered steps", () => {
      const service = new OnboardingService(createConfigurationMock());
      const questionnaire = service.getQuestionnaire();
      expect(questionnaire.version).toBe("1.0.0");
      expect(questionnaire.steps.length).toBeGreaterThan(0);
      expect(questionnaire.steps[0]?.id).toBe("essentials");
      // Conditional questions must declare showWhen predicates.
      const approvalQuestion = questionnaire.steps
        .flatMap((step) => step.questions)
        .find((q) => q.id === "invoiceApproval");
      expect(approvalQuestion?.showWhen?.questionId).toBe("customerPurchaseOrders");
    });

    it("surfaces unimplemented modules as disabled options", () => {
      const service = new OnboardingService(createConfigurationMock());
      const questionnaire = service.getQuestionnaire();
      const projectsQuestion = questionnaire.steps
        .flatMap((step) => step.questions)
        .find((q) => q.id === "projects");
      expect(projectsQuestion?.disabledOptions).toContain("true");
    });
  });

  describe("recommend", () => {
    it("is deterministic: same answers produce the same recommendation", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const answers: OnboardingAnswers = {
        country: "SA",
        currency: "SAR",
        businessType: "services",
        quotations: "true",
        customerPurchaseOrders: "optional",
        taxRegistration: "registered",
        numberingPreferences: "QUO-",
      };
      const first = await service.recommend({ answers });
      const second = await service.recommend({ answers });
      expect(second).toEqual(first);
    });

    it("recommends default-erp for a basic service business", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const recommendation = await service.recommend({
        answers: {
          country: "SA",
          currency: "SAR",
          businessType: "services",
          quotations: "true",
          customerPurchaseOrders: "optional",
          taxRegistration: "registered",
          numberingPreferences: "QUO-",
        },
      });
      expect(recommendation.configurationTemplateCode).toBe("default-erp");
      expect(recommendation.configurationTemplateVersionId).toBe(DEFAULT_ERP_VERSION_ID);
      expect(recommendation.fellBackToDefault).toBe(false);
      const customers = recommendation.enabledModules.find((m) => m.code === "customers");
      expect(customers?.enabled).toBe(true);
      const quotations = recommendation.enabledModules.find((m) => m.code === "quotations");
      expect(quotations?.enabled).toBe(true);
    });

    it("recommends service-po-approval when customer PO and invoice approval are required", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const recommendation = await service.recommend({
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
      expect(recommendation.configurationTemplateCode).toBe("service-po-approval");
      expect(recommendation.configurationTemplateVersionId).toBe(SERVICE_PO_VERSION_ID);
      expect(recommendation.fellBackToDefault).toBe(false);
    });

    it("falls back to default-erp when answers conflict (PO required but quotations disabled)", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const recommendation = await service.recommend({
        answers: {
          country: "SA",
          currency: "SAR",
          businessType: "services",
          quotations: "false",
          customerPurchaseOrders: "required",
          invoiceApproval: "required",
          taxRegistration: "registered",
          numberingPreferences: "QUO-",
        },
      });
      expect(recommendation.configurationTemplateCode).toBe("default-erp");
      expect(recommendation.fellBackToDefault).toBe(true);
      expect(recommendation.summary.some((line) => line.includes("conflicting"))).toBe(true);
    });

    it("never enables unimplemented modules even when the user answers yes", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const recommendation = await service.recommend({
        answers: {
          country: "SA",
          currency: "SAR",
          businessType: "both",
          quotations: "true",
          customerPurchaseOrders: "optional",
          projects: "true",
          inventory: "true",
          supplierPurchasing: "true",
          taxRegistration: "not",
          numberingPreferences: "Q-",
        },
      });
      const projects = recommendation.enabledModules.find((m) => m.code === "projects");
      expect(projects?.enabled).toBe(false);
      const inventory = recommendation.enabledModules.find((m) => m.code === "inventory");
      expect(inventory?.enabled).toBe(false);
    });

    it("disables purchase-orders module when customer PO is disabled", async () => {
      const service = new OnboardingService(createConfigurationMock());
      const recommendation = await service.recommend({
        answers: {
          country: "SA",
          currency: "SAR",
          businessType: "services",
          quotations: "true",
          customerPurchaseOrders: "disabled",
          taxRegistration: "not",
          numberingPreferences: "QUO-",
        },
      });
      const purchaseOrders = recommendation.enabledModules.find(
        (m) => m.code === "purchase-orders",
      );
      expect(purchaseOrders?.enabled).toBe(false);
    });

    it("rejects invalid answer types", async () => {
      const service = new OnboardingService(createConfigurationMock());
      await expect(
        service.recommend({
          answers: { country: 123 as unknown as string },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("applyRecommendation", () => {
    it("requires consent before applying", async () => {
      const service = new OnboardingService(createConfigurationMock());
      await expect(
        service.applyRecommendation({
          userPublicId: "u0000000-0000-4000-8000-000000000001",
          businessPublicId: "b0000000-0000-4000-8000-000000000001",
          request: {
            recommendation: {
              configurationTemplateCode: "default-erp",
              configurationTemplateVersionId: DEFAULT_ERP_VERSION_ID,
              configurationTemplateVersion: "1.0.0",
              enabledModules: [],
              workflowRefs: [],
              roleDefaults: [],
              documentTemplates: [],
              summary: [],
              fellBackToDefault: false,
            },
            consentToReview: false,
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects recommendations with an unknown template code", async () => {
      const service = new OnboardingService(createConfigurationMock());
      await expect(
        service.applyRecommendation({
          userPublicId: "u0000000-0000-4000-8000-000000000001",
          businessPublicId: "b0000000-0000-4000-8000-000000000001",
          request: {
            recommendation: {
              configurationTemplateCode: "unknown-template",
              configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000099",
              configurationTemplateVersion: "1.0.0",
              enabledModules: [],
              workflowRefs: [],
              roleDefaults: [],
              documentTemplates: [],
              summary: [],
              fellBackToDefault: false,
            },
            consentToReview: true,
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("applies the recommendation by resolving the current published version for the template code", async () => {
      const configuration = createConfigurationMock({
        assignConfiguration: vi.fn().mockResolvedValue({
          id: "a0000000-0000-4000-8000-0000000000new",
          businessId: "b0000000-0000-4000-8000-000000000001",
          configurationTemplateVersionId: DEFAULT_ERP_VERSION_ID,
          templateCode: "default-erp",
          templateVersion: "1.0.0",
          isPrimary: true,
          assignedByMembershipId: null,
          reason: "guided setup",
          assignedAt: "2026-07-28T00:00:00.000Z",
        }),
      });
      const service = new OnboardingService(configuration);

      const result = await service.applyRecommendation({
        userPublicId: "u0000000-0000-4000-8000-000000000001",
        businessPublicId: "b0000000-0000-4000-8000-000000000001",
        request: {
          recommendation: {
            configurationTemplateCode: "default-erp",
            configurationTemplateVersionId: DEFAULT_ERP_VERSION_ID,
            configurationTemplateVersion: "1.0.0",
            enabledModules: [],
            workflowRefs: [],
            roleDefaults: [],
            documentTemplates: [],
            summary: [],
            fellBackToDefault: false,
          },
          consentToReview: true,
        },
      });

      expect(result.templateCode).toBe("default-erp");
      expect(result.isPrimary).toBe(true);
      expect(configuration.assignConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationTemplateVersionId: DEFAULT_ERP_VERSION_ID,
          reason: "guided setup",
          isPrimary: true,
        }),
      );
    });
  });
});
