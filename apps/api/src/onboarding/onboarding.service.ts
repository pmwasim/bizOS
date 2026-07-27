// Phase 7 — Guided onboarding service.
//
// Exposes the questionnaire, computes deterministic recommendations from
// answers, and applies a reviewed recommendation as a new primary
// configuration assignment. Tenant isolation is enforced by
// ConfigurationService (which resolves access via BusinessAccessService and
// runs inside DatabaseService.withScope). The recommendation engine itself
// is pure and stateless.

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type ApplyOnboardingRequest,
  type OnboardingAnswers,
  type OnboardingAssignmentSummary,
  type OnboardingQuestionnaire,
  type OnboardingRecommendation,
  type RecommendOnboardingRequest,
} from "@bizo/contracts/onboarding";

import {
  DEFAULT_ERP_TEMPLATE_CODE,
  type AssignmentSummary,
  ConfigurationService,
} from "../configuration/configuration.service.js";
import { ONBOARDING_QUESTIONNAIRE } from "./onboarding-questionnaire.js";
import {
  recommendConfiguration,
  SERVICE_PO_APPROVAL_TEMPLATE_CODE,
} from "./recommendation-engine.js";

@Injectable()
export class OnboardingService {
  constructor(@Inject(ConfigurationService) private readonly configuration: ConfigurationService) {}

  getQuestionnaire(): OnboardingQuestionnaire {
    return ONBOARDING_QUESTIONNAIRE;
  }

  async recommend(request: RecommendOnboardingRequest): Promise<OnboardingRecommendation> {
    const answers = request.answers ?? {};
    this.validateAnswers(answers);

    // Resolve the published version IDs for both candidate templates up front
    // so the engine can produce a complete recommendation without touching
    // the database. If a template is missing we fall back to default-erp.
    const defaultErpVersion = await this.configuration.getDefaultErpPublishedVersion();
    let servicePoVersionId: string;
    let servicePoVersion: string;
    try {
      const published = await this.configuration.getPublishedVersion(
        SERVICE_PO_APPROVAL_TEMPLATE_CODE,
      );
      servicePoVersionId = published.id;
      servicePoVersion = published.version;
    } catch {
      // service-po-approval is optional. If it's missing, fall back to default-erp.
      servicePoVersionId = defaultErpVersion.id;
      servicePoVersion = defaultErpVersion.version;
    }

    return recommendConfiguration({
      answers,
      defaultErpVersionId: defaultErpVersion.id,
      defaultErpVersion: defaultErpVersion.version,
      servicePoVersionId,
      servicePoVersion,
    });
  }

  async applyRecommendation(args: {
    userPublicId: string;
    businessPublicId: string;
    request: ApplyOnboardingRequest;
  }): Promise<OnboardingAssignmentSummary> {
    const { userPublicId, businessPublicId, request } = args;

    if (!request.consentToReview) {
      throw new BadRequestException({
        code: "CONSENT_REQUIRED",
        detail: "You must confirm the recommendation before applying it.",
      });
    }

    const recommendation = request.recommendation;
    // Resolve the published version for the recommended template code. This
    // validates that the recommendation points at a real, published template
    // version and prevents the client from injecting an arbitrary version ID.
    const published = await this.resolvePublishedVersionForRecommendation(recommendation);

    const assignment: AssignmentSummary = await this.configuration.assignConfiguration({
      userPublicId,
      businessPublicId,
      configurationTemplateVersionId: published.id,
      reason: "guided setup",
      isPrimary: true,
    });

    return {
      assignmentId: assignment.id,
      businessId: assignment.businessId,
      configurationTemplateVersionId: assignment.configurationTemplateVersionId,
      templateCode: assignment.templateCode,
      templateVersion: assignment.templateVersion,
      isPrimary: assignment.isPrimary,
      reason: assignment.reason,
      assignedAt: assignment.assignedAt,
    };
  }

  private async resolvePublishedVersionForRecommendation(
    recommendation: OnboardingRecommendation,
  ): Promise<{ id: string; version: string }> {
    // The recommendation's configurationTemplateCode must be one of the two
    // templates the engine can produce. We resolve by template code (not by
    // the client-supplied version ID) so a stale or tampered recommendation
    // always maps to the current published version.
    const code = recommendation.configurationTemplateCode;
    if (code !== DEFAULT_ERP_TEMPLATE_CODE && code !== SERVICE_PO_APPROVAL_TEMPLATE_CODE) {
      throw new BadRequestException({
        code: "UNKNOWN_TEMPLATE",
        detail: `Recommendation references an unknown configuration template "${code}".`,
      });
    }

    try {
      const version = await this.configuration.getPublishedVersion(code);
      return { id: version.id, version: version.version };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException({
          code: "TEMPLATE_NOT_PUBLISHED",
          detail: `Configuration template "${code}" is not published.`,
        });
      }
      throw error;
    }
  }

  private validateAnswers(answers: OnboardingAnswers): void {
    // Answers are a free-form record keyed by question ID. We only validate
    // that the values are well-formed strings or arrays of strings — the
    // recommendation engine tolerates missing answers by falling back to
    // defaults.
    for (const [key, value] of Object.entries(answers)) {
      if (typeof value !== "string" && !Array.isArray(value)) {
        throw new BadRequestException({
          code: "INVALID_ANSWER",
          detail: `Answer for "${key}" must be a string or an array of strings.`,
        });
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item !== "string") {
            throw new BadRequestException({
              code: "INVALID_ANSWER",
              detail: `Answer for "${key}" contains a non-string value.`,
            });
          }
        }
      }
    }
  }
}
