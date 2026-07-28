import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { OnboardingService } from "./onboarding.service.js";
import { OnboardingController } from "./onboarding.controller.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";

const QUESTIONNAIRE = {
  version: "1.0.0",
  steps: [
    {
      id: "essentials",
      title: "Essentials",
      questions: [
        {
          id: "country",
          type: "single-select" as const,
          prompt: "Where does your business operate?",
          options: [{ value: "SA", label: "Saudi Arabia" }],
        },
      ],
    },
  ],
};

const RECOMMENDATION = {
  configurationTemplateCode: "default-erp",
  configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  configurationTemplateVersion: "1.0.0",
  enabledModules: [{ code: "customers", enabled: true }],
  workflowRefs: [],
  roleDefaults: [],
  documentTemplates: [],
  summary: ["Default bizOS ERP"],
  fellBackToDefault: false,
};

const ASSIGNMENT_SUMMARY = {
  assignmentId: "a0000000-0000-4000-8000-000000000001",
  businessId: BUSINESS_PUBLIC_ID,
  configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  templateCode: "default-erp",
  templateVersion: "1.0.0",
  isPrimary: true,
  reason: "guided setup",
  assignedAt: "2026-07-28T00:00:00.000Z",
};

function createServiceMock(overrides: Partial<OnboardingService> = {}): OnboardingService {
  const mock = {
    getQuestionnaire: vi.fn().mockReturnValue(QUESTIONNAIRE),
    recommend: vi.fn().mockResolvedValue(RECOMMENDATION),
    applyRecommendation: vi.fn().mockResolvedValue(ASSIGNMENT_SUMMARY),
  };
  return { ...mock, ...overrides } as unknown as OnboardingService;
}

describe("OnboardingController", () => {
  it("returns the questionnaire for GET /onboarding/questionnaire", () => {
    const service = createServiceMock();
    const controller = new OnboardingController(service);

    const result = controller.getQuestionnaire();

    expect(result).toEqual(QUESTIONNAIRE);
    expect(service.getQuestionnaire).toHaveBeenCalled();
  });

  it("returns a recommendation for POST /onboarding/recommend", async () => {
    const service = createServiceMock();
    const controller = new OnboardingController(service);

    const result = await controller.recommend({
      answers: { country: "SA", businessType: "services" },
    });

    expect(result).toEqual(RECOMMENDATION);
    expect(service.recommend).toHaveBeenCalledWith({
      answers: { country: "SA", businessType: "services" },
    });
  });

  it("applies the recommendation for POST /businesses/:businessId/onboarding/apply", async () => {
    const service = createServiceMock();
    const controller = new OnboardingController(service);

    const result = await controller.apply({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID, {
      recommendation: RECOMMENDATION,
      consentToReview: true,
    });

    expect(result).toEqual(ASSIGNMENT_SUMMARY);
    expect(service.applyRecommendation).toHaveBeenCalledWith({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      request: { recommendation: RECOMMENDATION, consentToReview: true },
    });
  });

  it("propagates BadRequest when consent is missing", async () => {
    const service = createServiceMock({
      applyRecommendation: vi.fn().mockRejectedValue(
        new BadRequestException({
          code: "CONSENT_REQUIRED",
          detail: "You must confirm the recommendation before applying it.",
        }),
      ),
    });
    const controller = new OnboardingController(service);

    await expect(
      controller.apply({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID, {
        recommendation: RECOMMENDATION,
        consentToReview: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
