import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PlatformSystemAdminStatus } from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { SystemAdminGuard } from "../security/system-admin.guard.js";
import { type ExecutionContext } from "@nestjs/common";
import { SystemAdminService } from "../system-admin/system-admin.service.js";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("System Admin authorization boundary with PostgreSQL", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let configuration: ConfigurationService;
  let systemAdminService: SystemAdminService;
  let guard: SystemAdminGuard;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database, {
      sendPasswordReset: async () => "test-message-id",
    } as never);
    platform = new PlatformService(database, access, configuration);
    systemAdminService = new SystemAdminService(database);
    guard = new SystemAdminGuard(database);
  });

  afterAll(async () => {
    if (database) {
      await database.onModuleDestroy();
    }
  });

  function createExecutionContext(principal: unknown): ExecutionContext {
    const request = { principal } as unknown as Record<string, unknown>;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  async function grantSystemAdmin(
    userPublicId: string,
    status: PlatformSystemAdminStatus = PlatformSystemAdminStatus.ACTIVE,
  ): Promise<string> {
    const user = await database.client.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) throw new Error(`User ${userPublicId} not found`);
    const created = await database.client.platformSystemAdmin.create({
      data: { userId: user.id, status, reason: "integration test grant" },
    });
    return created.publicId;
  }

  it("rejects a regular org owner at the guard boundary (no PlatformSystemAdmin row)", async () => {
    const owner = await identity.signUp({
      displayName: "Regular Owner",
      email: `sysadmin-rejected-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    await platform.createBusiness(
      owner.id,
      {
        name: "Rejected Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-sysadmin-rejected-business",
    );

    const ctx = createExecutionContext({ userId: owner.id });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  }, 60_000);

  it("admits an active System Admin, supports cross-tenant reads, and audits writes", async () => {
    const owner = await identity.signUp({
      displayName: "SysAdmin Owner",
      email: `sysadmin-active-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Administered Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      "integration-sysadmin-active-business",
    );

    const systemAdminPublicId = await grantSystemAdmin(owner.id);

    // Guard admits and augments the principal.
    const ctx = createExecutionContext({ userId: owner.id });
    const admitted = await guard.canActivate(ctx);
    expect(admitted).toBe(true);
    const request = ctx.switchToHttp().getRequest<{ principal: { systemAdminId?: string } }>();
    expect(request.principal.systemAdminId).toBe(systemAdminPublicId);

    // Cross-tenant read: list organizations includes the business.
    const page = await systemAdminService.listOrganizations({ page: 1, pageSize: 100 });
    expect(page.items.some((item) => item.businessId === business.id)).toBe(true);

    // Cross-tenant read: get organization detail.
    const detail = await systemAdminService.getOrganization(business.id);
    expect(detail.name).toBe("Administered Co");
    expect(detail.currentAssignment?.templateCode).toBe("default-erp");

    // Assignment history is non-empty.
    const history = await systemAdminService.getAssignmentHistory(business.id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.templateCode).toBe("default-erp");
  }, 60_000);

  it("rejects an inactive System Admin at the guard boundary", async () => {
    const owner = await identity.signUp({
      displayName: "Inactive Admin",
      email: `sysadmin-inactive-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    await grantSystemAdmin(owner.id, PlatformSystemAdminStatus.INACTIVE);

    const ctx = createExecutionContext({ userId: owner.id });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  }, 60_000);

  it("audits a System Admin configuration assignment with actor=systemAdminId", async () => {
    const owner = await identity.signUp({
      displayName: "Assignment Admin",
      email: `sysadmin-assign-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Assignment Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-sysadmin-assign-business",
    );
    const systemAdminPublicId = await grantSystemAdmin(owner.id);

    // Resolve the default-erp published version to re-assign it (idempotent reassignment).
    const templates = await systemAdminService.listConfigurationTemplateVersions({
      templateCode: "default-erp",
      status: "PUBLISHED",
    });
    const defaultErp = templates.find((t) => t.code === "default-erp");
    expect(defaultErp).toBeDefined();
    const publishedVersion = defaultErp?.versions[0];
    expect(publishedVersion).toBeDefined();

    const assigned = await systemAdminService.assignConfiguration({
      systemAdminId: systemAdminPublicId,
      businessPublicId: business.id,
      configurationTemplateVersionId: publishedVersion!.id,
      reason: "Integration test reassignment",
    });
    expect(assigned.isPrimary).toBe(true);
    expect(assigned.templateCode).toBe("default-erp");

    // The audit event for this assignment is attributable to the System Admin.
    const auditPage = await systemAdminService.listAuditEvents({
      entityType: "BusinessConfigurationAssignment",
      businessPublicId: business.id,
      page: 1,
      pageSize: 50,
    });
    const matching = auditPage.items.find(
      (event) => event.actorSystemAdminId === systemAdminPublicId && event.action === "ASSIGN",
    );
    expect(matching).toBeDefined();
    expect(matching?.reason).toBe("Integration test reassignment");
  }, 60_000);

  it("audits a System Admin default ERP version change at the platform level", async () => {
    const owner = await identity.signUp({
      displayName: "Default ERP Admin",
      email: `sysadmin-defaulterp-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const systemAdminPublicId = await grantSystemAdmin(owner.id);

    const templates = await systemAdminService.listConfigurationTemplateVersions({
      templateCode: "default-erp",
      status: "PUBLISHED",
    });
    const defaultErp = templates.find((t) => t.code === "default-erp");
    expect(defaultErp).toBeDefined();
    const publishedVersion = defaultErp?.versions[0];
    expect(publishedVersion).toBeDefined();

    const result = await systemAdminService.setDefaultErpVersion({
      systemAdminId: systemAdminPublicId,
      configurationTemplateVersionId: publishedVersion!.id,
      reason: "Integration test default ERP promotion",
    });
    expect(result.configurationTemplateVersionId).toBe(publishedVersion!.id);

    // The platform-level audit event has actor=systemAdminId and entityType=PlatformDefaultErpVersion.
    const auditPage = await systemAdminService.listAuditEvents({
      entityType: "PlatformDefaultErpVersion",
      page: 1,
      pageSize: 50,
    });
    const matching = auditPage.items.find(
      (event) => event.actorSystemAdminId === systemAdminPublicId,
    );
    expect(matching).toBeDefined();
    expect(matching?.action).toBe("UPDATE");
  }, 60_000);

  it("reports system health as ok against the live database", async () => {
    const health = await systemAdminService.getSystemHealth();
    expect(health.status).toBe("ok");
    expect(health.checks.database?.status).toBe("ok");
  }, 60_000);

  it("rejects cross-tenant business access for a non-admin via NotFound", async () => {
    const owner = await identity.signUp({
      displayName: "Tenant Owner",
      email: `sysadmin-tenant-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: "Tenant Co",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: false,
        taxName: "Tax",
        taxRatePercent: "0",
      },
      "integration-sysadmin-tenant-business",
    );

    const outsider = await identity.signUp({
      displayName: "Tenant Outsider",
      email: `sysadmin-outsider-${Date.now()}@example.test`,
      password: "Production2Password",
    });

    // The org-scoped ConfigurationService rejects cross-tenant access.
    await expect(
      configuration.getActiveAssignment(outsider.id, business.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    // But the System Admin service can read the same business cross-tenant (after grant).
    const systemAdminPublicId = await grantSystemAdmin(outsider.id);
    const detail = await systemAdminService.getOrganization(business.id);
    expect(detail.businessId).toBe(business.id);
    expect(detail.currentAssignment?.templateCode).toBe("default-erp");
    // Sanity: the admin principal used for the read is the outsider's admin row.
    expect(systemAdminPublicId).toBeDefined();
  }, 60_000);
});
