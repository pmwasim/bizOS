// Phase 9 — Platform System Admin REST controller.
//
// All endpoints live under /api/v1/system-admin/ and require an ACTIVE
// PlatformSystemAdmin principal (enforced by SystemAdminGuard applied via
// @UseGuards). The controller is thin: it parses query/body via ContractPipe
// and delegates to SystemAdminService. All writes pass the systemAdminId
// from the authenticated principal so the service can attribute audit events.

import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import {
  systemAdminAssignConfigurationRequestSchema,
  systemAdminListAuditEventsRequestSchema,
  systemAdminListConfigurationTemplatesRequestSchema,
  systemAdminListCustomizationRequestsRequestSchema,
  systemAdminListOrganizationsRequestSchema,
  systemAdminListWorkflowTemplatesRequestSchema,
  systemAdminSetDefaultErpVersionRequestSchema,
  type SystemAdminAssignConfigurationRequest,
  type SystemAdminAssignmentHistoryItem,
  type SystemAdminAuditEventPage,
  type SystemAdminConfigurationTemplateSummary,
  type SystemAdminCustomizationRequestPage,
  type SystemAdminHealthSummary,
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

  @Get("health")
  getSystemHealth(): Promise<SystemAdminHealthSummary> {
    return this.systemAdmin.getSystemHealth();
  }
}
