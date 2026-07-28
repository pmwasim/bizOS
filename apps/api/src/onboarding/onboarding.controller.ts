// Phase 7 — Guided onboarding REST controller.
//
// Endpoints:
//   GET  /api/v1/onboarding/questionnaire
//   POST /api/v1/onboarding/recommend
//   POST /api/v1/businesses/:businessId/onboarding/apply
//
// The questionnaire and recommend endpoints are not business-scoped (the
// question set is global and recommendation is pure). The apply endpoint is
// business-scoped so ConfigurationService can resolve tenant access from
// the principal + business and reject cross-tenant access.

import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  applyOnboardingRequestSchema,
  type ApplyOnboardingRequest,
  type OnboardingQuestionnaire,
  type OnboardingRecommendation,
  recommendOnboardingRequestSchema,
  type RecommendOnboardingRequest,
} from "@bizo/contracts/onboarding";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { OnboardingService } from "./onboarding.service.js";

@Controller()
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly onboarding: OnboardingService) {}

  @Get("onboarding/questionnaire")
  getQuestionnaire(): OnboardingQuestionnaire {
    return this.onboarding.getQuestionnaire();
  }

  @Post("onboarding/recommend")
  recommend(
    @Body(new ContractPipe(recommendOnboardingRequestSchema)) input: RecommendOnboardingRequest,
  ): Promise<OnboardingRecommendation> {
    return this.onboarding.recommend(input);
  }

  @Post("businesses/:businessId/onboarding/apply")
  apply(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(applyOnboardingRequestSchema)) input: ApplyOnboardingRequest,
  ) {
    return this.onboarding.applyRecommendation({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      request: input,
    });
  }
}
