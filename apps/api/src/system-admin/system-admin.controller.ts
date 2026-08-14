// Phase 9 — Platform System Admin REST controller.
//
// All endpoints live under /api/v1/system-admin/ and require an ACTIVE
// PlatformSystemAdmin principal (enforced by SystemAdminGuard applied via
// @UseGuards). The controller is thin: it parses query/body via ContractPipe
// and delegates to SystemAdminService. All writes pass the systemAdminId
// from the authenticated principal so the service can attribute audit events.

import { Body, Controller, Get, Inject, Param, Post, Put, Query, UseGuards } from "@nestjs/common";

import {
  createConfigurationTemplateRequestSchema,
  createWorkflowTemplateRequestSchema,
  systemAdminAssignConfigurationRequestSchema,
  systemAdminImpersonateRequestSchema,
  systemAdminListAuditEventsRequestSchema,
  systemAdminListConfigurationTemplatesRequestSchema,
  systemAdminListCustomizationRequestsRequestSchema,
  systemAdminListOrganizationsRequestSchema,
  systemAdminListWorkflowTemplatesRequestSchema,
  systemAdminSetDefaultErpVersionRequestSchema,
  templateMigrationPreviewRequestSchema,
  updateTemplateVersionStatusRequestSchema,
  type CreateConfigurationTemplateRequest,
  type CreateWorkflowTemplateRequest,
  type SystemAdminAssignConfigurationRequest,
  type SystemAdminAssignmentHistoryItem,
  type SystemAdminAuditEventPage,
  type SystemAdminConfigurationTemplateSummary,
  type SystemAdminCustomizationRequestPage,
  type SystemAdminHealthSummary,
  type SystemAdminImpersonateRequest,
  type SystemAdminImpersonateResponse,
  type SystemAdminListAuditEventsRequest,
  type SystemAdminListConfigurationTemplatesRequest,
  type SystemAdminListCustomizationRequestsRequest,
  type SystemAdminListOrganizationsRequest,
  type SystemAdminListWorkflowTemplatesRequest,
  type SystemAdminOrganizationDetail,
  type SystemAdminOrganizationPage,
  type SystemAdminPrincipal,
  type SystemAdminSetDefaultErpVersionRequest,
  type SystemAdminWorkflowTemplateSummary,
  type TemplateMigrationPreviewRequest,
  type TemplateMigrationPreviewResponse,
  type UpdateTemplateVersionStatusRequest,
} from "@bizo/contracts/system-admin";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { SystemAdminGuard } from "../security/system-admin.guard.js";
import { SystemAdmin } from "../security/system-admin.decorator.js";
import { SystemAdminService } from "./system-admin.service.js";

@SystemAdmin()
@UseGuards(SystemAdminGuard)
@Controller("system-admin")
export class SystemAdminController {
  constructor(@Inject(SystemAdminService) private readonly systemAdmin: SystemAdminService) {}

  @Get("me")
  me(@Principal() principal: AuthenticatedPrincipal): SystemAdminPrincipal {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return {
      systemAdminId: principal.systemAdminId,
      userId: principal.userId,
      status: "ACTIVE",
      isActive: true,
    };
  }

  @Get("organizations")
  listOrganizations(
    @Query(new ContractPipe(systemAdminListOrganizationsRequestSchema))
    query: SystemAdminListOrganizationsRequest,
  ): Promise<SystemAdminOrganizationPage> {
    return this.systemAdmin.listOrganizations({
      ...(query.search !== undefined ? { search: query.search } : {}),
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get("organizations/:businessPublicId")
  getOrganization(
    @Param("businessPublicId") businessPublicId: string,
  ): Promise<SystemAdminOrganizationDetail> {
    return this.systemAdmin.getOrganization(businessPublicId);
  }

  @Get("organizations/:businessPublicId/assignments")
  getAssignmentHistory(
    @Param("businessPublicId") businessPublicId: string,
  ): Promise<SystemAdminAssignmentHistoryItem[]> {
    return this.systemAdmin.getAssignmentHistory(businessPublicId);
  }

  @Get("configuration-templates")
  listConfigurationTemplates(
    @Query(new ContractPipe(systemAdminListConfigurationTemplatesRequestSchema))
    query: SystemAdminListConfigurationTemplatesRequest,
  ): Promise<SystemAdminConfigurationTemplateSummary[]> {
    return this.systemAdmin.listConfigurationTemplateVersions({
      templateCode: query.templateCode,
      status: query.status,
    });
  }

  @Get("workflow-templates")
  listWorkflowTemplates(
    @Query(new ContractPipe(systemAdminListWorkflowTemplatesRequestSchema))
    query: SystemAdminListWorkflowTemplatesRequest,
  ): Promise<SystemAdminWorkflowTemplateSummary[]> {
    return this.systemAdmin.listWorkflowTemplateVersions({
      workflowTemplateCode: query.workflowTemplateCode,
      status: query.status,
    });
  }

  @Post("organizations/:businessPublicId/assignment")
  async assignConfiguration(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessPublicId") businessPublicId: string,
    @Body(new ContractPipe(systemAdminAssignConfigurationRequestSchema))
    body: SystemAdminAssignConfigurationRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.assignConfiguration({
      systemAdminId: principal.systemAdminId,
      businessPublicId,
      configurationTemplateVersionId: body.configurationTemplateVersionId,
      reason: body.reason,
    });
  }

  @Post("configuration/default-erp-version")
  async setDefaultErpVersion(
    @Principal() principal: AuthenticatedPrincipal,
    @Body(new ContractPipe(systemAdminSetDefaultErpVersionRequestSchema))
    body: SystemAdminSetDefaultErpVersionRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.setDefaultErpVersion({
      systemAdminId: principal.systemAdminId,
      configurationTemplateVersionId: body.configurationTemplateVersionId,
      reason: body.reason,
    });
  }

  @Get("customization-requests")
  listCustomizationRequests(
    @Query(new ContractPipe(systemAdminListCustomizationRequestsRequestSchema))
    query: SystemAdminListCustomizationRequestsRequest,
  ): Promise<SystemAdminCustomizationRequestPage> {
    return this.systemAdmin.listCustomizationRequests({
      ...(query.status !== undefined ? { status: query.status } : {}),
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get("audit-events")
  listAuditEvents(
    @Query(new ContractPipe(systemAdminListAuditEventsRequestSchema))
    query: SystemAdminListAuditEventsRequest,
  ): Promise<SystemAdminAuditEventPage> {
    return this.systemAdmin.listAuditEvents({
      ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
      ...(query.businessPublicId !== undefined ? { businessPublicId: query.businessPublicId } : {}),
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Post("configuration-templates")
  async createConfigurationTemplate(
    @Principal() principal: AuthenticatedPrincipal,
    @Body(new ContractPipe(createConfigurationTemplateRequestSchema))
    body: CreateConfigurationTemplateRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.createConfigurationTemplate({
      systemAdminId: principal.systemAdminId,
      code: body.code,
      name: body.name,
      ...(body.description ? { description: body.description } : {}),
      kind: body.kind,
      version: body.version,
      snapshotJson: body.snapshotJson,
    });
  }

  @Put("configuration-templates/:versionPublicId/status")
  async updateConfigurationTemplateVersionStatus(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("versionPublicId") versionPublicId: string,
    @Body(new ContractPipe(updateTemplateVersionStatusRequestSchema))
    body: UpdateTemplateVersionStatusRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.updateConfigurationTemplateVersionStatus({
      systemAdminId: principal.systemAdminId,
      versionPublicId,
      status: body.status,
      reason: body.reason,
    });
  }

  @Post("workflow-templates")
  async createWorkflowTemplate(
    @Principal() principal: AuthenticatedPrincipal,
    @Body(new ContractPipe(createWorkflowTemplateRequestSchema))
    body: CreateWorkflowTemplateRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.createWorkflowTemplate({
      systemAdminId: principal.systemAdminId,
      code: body.code,
      name: body.name,
      ...(body.description ? { description: body.description } : {}),
      documentType: body.documentType,
      version: body.version,
      definitionJson: body.definitionJson,
    });
  }

  @Put("workflow-templates/:versionPublicId/status")
  async updateWorkflowTemplateVersionStatus(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("versionPublicId") versionPublicId: string,
    @Body(new ContractPipe(updateTemplateVersionStatusRequestSchema))
    body: UpdateTemplateVersionStatusRequest,
  ) {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.updateWorkflowTemplateVersionStatus({
      systemAdminId: principal.systemAdminId,
      versionPublicId,
      status: body.status,
      reason: body.reason,
    });
  }

  @Post("organizations/:businessPublicId/impersonate")
  async impersonateOrganization(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessPublicId") businessPublicId: string,
    @Body(new ContractPipe(systemAdminImpersonateRequestSchema))
    body: SystemAdminImpersonateRequest,
  ): Promise<SystemAdminImpersonateResponse> {
    if (!principal.systemAdminId) {
      throw new Error("System Admin principal was not resolved by the guard.");
    }
    return this.systemAdmin.impersonateOrganization({
      systemAdminId: principal.systemAdminId,
      userId: principal.userId,
      businessPublicId,
      ticketReference: body.ticketReference,
      reason: body.reason,
      durationMinutes: body.durationMinutes,
    });
  }

  @Post("organizations/:businessPublicId/preview-migration")
  async previewMigration(
    @Param("businessPublicId") businessPublicId: string,
    @Body(new ContractPipe(templateMigrationPreviewRequestSchema))
    body: TemplateMigrationPreviewRequest,
  ): Promise<TemplateMigrationPreviewResponse> {
    return this.systemAdmin.previewMigration({
      businessPublicId,
      targetConfigurationTemplateVersionId: body.targetConfigurationTemplateVersionId,
    });
  }

  @Get("health")
  getSystemHealth(): Promise<SystemAdminHealthSummary> {
    return this.systemAdmin.getSystemHealth();
  }
}
