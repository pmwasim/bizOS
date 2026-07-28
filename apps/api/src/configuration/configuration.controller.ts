// Phase 4 — Configuration backbone REST controller.
//
// Exposes the configuration assignment, enabled modules, and per-document
// workflow context over REST. All endpoints require an authenticated principal
// and a business-scoped URL; the service resolves tenant access from the
// principal + business and rejects cross-tenant access.

import { Controller, Get, Inject, Param } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import {
  type ActiveAssignmentSummary,
  type DocumentWorkflowContextSummary,
  type EnabledModuleSummary,
  type TransitionEvaluation,
  ConfigurationService,
} from "./configuration.service.js";

export interface ConfigurationResponse {
  assignment: ActiveAssignmentSummary;
  enabledModules: EnabledModuleSummary[];
}

export interface WorkflowResponse {
  context: DocumentWorkflowContextSummary | null;
  availableTransitions: Array<{
    action: string;
    toState: string;
    allowedRoles: string[];
    evaluation: TransitionEvaluation;
  }>;
}

@Controller("businesses/:businessId")
export class ConfigurationController {
  constructor(@Inject(ConfigurationService) private readonly configuration: ConfigurationService) {}

  @Get("configuration")
  async getConfiguration(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
  ): Promise<ConfigurationResponse> {
    const [assignment, enabledModules] = await Promise.all([
      this.configuration.getActiveAssignment(principal.userId, businessId),
      this.configuration.getEnabledModules(principal.userId, businessId),
    ]);
    return { assignment, enabledModules };
  }

  @Get("modules")
  getModules(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
  ): Promise<EnabledModuleSummary[]> {
    return this.configuration.getEnabledModules(principal.userId, businessId);
  }

  @Get("documents/:documentId/workflow")
  async getWorkflow(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("documentId") documentId: string,
  ): Promise<WorkflowResponse> {
    const context = await this.configuration.getDocumentWorkflowContextSummary(
      principal.userId,
      businessId,
      documentId,
    );
    const availableTransitions = context
      ? await this.configuration.listAvailableTransitions({
          userPublicId: principal.userId,
          businessPublicId: businessId,
          documentId,
        })
      : [];
    return { context, availableTransitions };
  }
}
