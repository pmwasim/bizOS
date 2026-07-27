import { describe, expect, it } from "vitest";

import {
  applyOnboardingRequestSchema,
  onboardingAnswersSchema,
  onboardingQuestionnaireSchema,
  onboardingRecommendationSchema,
  recommendOnboardingRequestSchema,
} from "./onboarding.js";

const QUESTIONNAIRE = {
  version: "1.0.0",
  steps: [
    {
      id: "essentials",
      title: "Essentials",
      questions: [
        {
          id: "country",
          type: "single-select",
          prompt: "Where does your business operate?",
          options: [
            { value: "SA", label: "Saudi Arabia" },
            { value: "AE", label: "United Arab Emirates" },
          ],
        },
        {
          id: "businessType",
          type: "single-select",
          prompt: "What do you sell?",
          options: [
            { value: "goods", label: "Goods" },
            { value: "services", label: "Services" },
            { value: "both", label: "Both" },
          ],
        },
      ],
    },
    {
      id: "workflow",
      title: "Workflow",
      questions: [
        {
          id: "customerPurchaseOrders",
          type: "single-select",
          prompt: "Do your customers send purchase orders?",
          options: [
            { value: "required", label: "Required" },
            { value: "optional", label: "Optional" },
            { value: "disabled", label: "Not used" },
          ],
        },
      ],
    },
  ],
} as const;

const RECOMMENDATION = {
  configurationTemplateCode: "default-erp",
  configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  configurationTemplateVersion: "1.0.0",
  enabledModules: [
    { code: "customers", enabled: true },
    { code: "quotations", enabled: true },
  ],
  workflowRefs: [{ documentType: "QUOTATION", workflowTemplateCode: "default-quotation-workflow" }],
  summary: ["Default bizOS ERP", "Customers and quotations enabled"],
  fellBackToDefault: false,
} as const;

describe("onboarding contracts", () => {
  it("accepts a questionnaire with conditional steps", () => {
    expect(onboardingQuestionnaireSchema.safeParse(QUESTIONNAIRE).success).toBe(true);
  });

  it("accepts a recommendation with optional fields omitted", () => {
    expect(onboardingRecommendationSchema.safeParse(RECOMMENDATION).success).toBe(true);
  });

  it("applies default empty answers when none are provided", () => {
    expect(onboardingAnswersSchema.parse(undefined)).toEqual({});
  });

  it("accepts a recommend request with answers", () => {
    expect(
      recommendOnboardingRequestSchema.safeParse({
        answers: { country: "SA", businessType: "services" },
      }).success,
    ).toBe(true);
  });

  it("accepts an apply request with consent", () => {
    expect(
      applyOnboardingRequestSchema.safeParse({
        recommendation: RECOMMENDATION,
        consentToReview: true,
      }).success,
    ).toBe(true);
  });

  it("defaults consentToReview to false when omitted", () => {
    const parsed = applyOnboardingRequestSchema.parse({
      recommendation: RECOMMENDATION,
    });
    expect(parsed.consentToReview).toBe(false);
  });

  it("rejects a recommendation without a template code", () => {
    expect(
      onboardingRecommendationSchema.safeParse({
        ...RECOMMENDATION,
        configurationTemplateCode: "",
      }).success,
    ).toBe(false);
  });
});
