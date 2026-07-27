// Phase 10 — Business Admin boundary integration tests.
//
// Proves the authorization separation between organization Owner/Admin and
// platform System Admin. Organization Owners/Admins may manage safe
// organization-level settings (business identity, tax defaults, numbering,
// re-running guided setup); they may NOT perform platform-structural actions
// (listing organizations cross-tenant, assigning configurations as a System
// Admin, changing the platform default ERP version, reading audit events, or
// listing customization requests).
//
// The boundary is enforced server-side:
//   - SystemAdminGuard rejects any principal without an ACTIVE
//     PlatformSystemAdmin row (403 Forbidden), so org Owner/Admin/Member
//     cannot reach /api/v1/system-admin/* endpoints.
//   - BusinessAccessService.resolve throws NotFound (404) when the caller has
//     no BusinessAccess record for the target business, so cross-tenant access
//     is denied for business-scoped endpoints.
//
// DB-gated via RUN_DATABASE_TESTS=true, following the existing
// invoice-journey / configuration-assignment integration pattern. Service
// calls are used (not HTTP) so the tests exercise the same authorization
// code paths the controllers delegate to.

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { type ExecutionContext } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MembershipStatus, PlatformSystemAdminStatus, RoleCode } from "@bizo/database";

import { ConfigurationService } from "../configuration/configuration.service.js";
import { DatabaseService } from "../database/database.service.js";
import { IdentityService } from "../identity/identity.service.js";
import { OnboardingService } from "../onboarding/onboarding.service.js";
import { PlatformService } from "../platform/platform.service.js";
import { BusinessAccessService } from "../security/business-access.service.js";
import { SystemAdminGuard } from "../security/system-admin.guard.js";
import { SystemAdminService } from "../system-admin/system-admin.service.js";
import { updateBusinessSettingsRequestSchema } from "@bizo/contracts/platform";

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true";

describe.runIf(databaseEnabled)("Business Admin authorization boundary with PostgreSQL", () => {
  let database: DatabaseService;
  let identity: IdentityService;
  let platform: PlatformService;
  let configuration: ConfigurationService;
  let onboarding: OnboardingService;
  let systemAdminService: SystemAdminService;
  let guard: SystemAdminGuard;

  beforeAll(async () => {
    database = new DatabaseService();
    await database.onModuleInit();
    const access = new BusinessAccessService(database);
    configuration = new ConfigurationService(database, access);
    identity = new IdentityService(database);
    platform = new PlatformService(database, access, configuration);
    onboarding = new OnboardingService(configuration);
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

  // Adds an ADMIN or MEMBER role for a user on an existing business. The
  // business was created by platform.createBusiness which seeds the OWNER
  // role and the tenant's three role rows (OWNER, ADMIN, MEMBER).
  async function addBusinessMember(
    userPublicId: string,
    businessPublicId: string,
    roleCode: RoleCode.ADMIN | RoleCode.MEMBER,
  ): Promise<void> {
    const user = await database.client.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    const business = await database.client.business.findUnique({
      where: { publicId: businessPublicId },
      select: { id: true, tenantId: true },
    });
    if (!user || !business) {
      throw new Error("User or business not found while adding member.");
    }
    const role = await database.client.role.findUnique({
      where: { tenantId_code: { tenantId: business.tenantId, code: roleCode } },
      select: { id: true },
    });
    if (!role) {
      throw new Error(`Role ${roleCode} not found for tenant.`);
    }
    const membership = await database.client.membership.create({
      data: { tenantId: business.tenantId, userId: user.id, status: MembershipStatus.ACTIVE },
    });
    await database.client.businessAccess.create({
      data: {
        tenantId: business.tenantId,
        businessId: business.id,
        membershipId: membership.id,
        roleId: role.id,
      },
    });
  }

  async function seedBusiness(suffix: string) {
    const owner = await identity.signUp({
      displayName: `Boundary Owner ${suffix}`,
      email: `boundary-owner-${suffix}-${Date.now()}@example.test`,
      password: "Production1Password",
    });
    const business = await platform.createBusiness(
      owner.id,
      {
        name: `Boundary Co ${suffix}`,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        taxEnabled: true,
        taxName: "VAT",
        taxRatePercent: "15",
      },
      `integration-boundary-${suffix}`,
    );
    return { owner, business };
  }

  async function countAuditEvents(businessPublicId: string, action: string): Promise<number> {
    const business = await database.client.business.findUnique({
      where: { publicId: businessPublicId },
      select: { tenantId: true },
    });
    if (!business) return 0;
    return database.client.configurationAuditEvent.count({
      where: { tenantId: business.tenantId, action },
    });
  }

  // ---------------------------------------------------------------------
  // System Admin functions are denied to org Owner, org Admin, and MEMBER.
  // The SystemAdminGuard is the boundary; it rejects any principal without
  // an ACTIVE PlatformSystemAdmin row, so org roles cannot reach
  // /api/v1/system-admin/* endpoints regardless of their org role.
  // ---------------------------------------------------------------------

  describe("System Admin functions denied to org Owner, org Admin, and MEMBER", () => {
    it("rejects an org Owner at the SystemAdminGuard (listOrganizations → 403)", async () => {
      const { owner } = await seedBusiness("owner-sa-list");
      const ctx = createExecutionContext({ userId: owner.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects an org Admin at the SystemAdminGuard (listOrganizations → 403)", async () => {
      const { business } = await seedBusiness("admin-sa-list");
      const admin = await identity.signUp({
        displayName: "Boundary Admin SA List",
        email: `boundary-admin-sa-list-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const ctx = createExecutionContext({ userId: admin.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects an org Owner at the SystemAdminGuard (assignConfiguration → 403)", async () => {
      const { owner } = await seedBusiness("owner-sa-assign");
      const ctx = createExecutionContext({ userId: owner.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects an org Admin at the SystemAdminGuard (setDefaultErpVersion → 403)", async () => {
      const { business } = await seedBusiness("admin-sa-default-erp");
      const admin = await identity.signUp({
        displayName: "Boundary Admin SA Default ERP",
        email: `boundary-admin-sa-default-erp-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const ctx = createExecutionContext({ userId: admin.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects an org Owner at the SystemAdminGuard (listAuditEvents → 403)", async () => {
      const { owner } = await seedBusiness("owner-sa-audit");
      const ctx = createExecutionContext({ userId: owner.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects an org Admin at the SystemAdminGuard (listCustomizationRequests → 403)", async () => {
      const { business } = await seedBusiness("admin-sa-customization");
      const admin = await identity.signUp({
        displayName: "Boundary Admin SA Customization",
        email: `boundary-admin-sa-customization-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const ctx = createExecutionContext({ userId: admin.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("rejects a regular MEMBER at the SystemAdminGuard (any /system-admin/* → 403)", async () => {
      const { owner, business } = await seedBusiness("member-sa");
      const member = await identity.signUp({
        displayName: "Boundary Member SA",
        email: `boundary-member-sa-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(member.id, business.id, RoleCode.MEMBER);
      const ctx = createExecutionContext({ userId: member.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
      // Sanity: the owner of the same business is also rejected.
      const ownerCtx = createExecutionContext({ userId: owner.id });
      await expect(guard.canActivate(ownerCtx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);
  });

  // ---------------------------------------------------------------------
  // Business Admin CAN manage safe organization-level settings. These
  // service calls go through BusinessAccessService.resolve (which enforces
  // tenant + business scope) and assertAllowed (which enforces role
  // permissions). OWNER and ADMIN both have business:read and business:update.
  // ---------------------------------------------------------------------

  describe("Business Admin CAN manage safe organization-level settings", () => {
    it("org Owner can read their own business configuration (getActiveAssignment → 200)", async () => {
      const { owner, business } = await seedBusiness("owner-read-config");
      const assignment = await configuration.getActiveAssignment(owner.id, business.id);
      expect(assignment.templateCode).toBe("default-erp");
      expect(assignment.isPrimary).toBe(true);
    }, 60_000);

    it("org Admin can read their own business configuration (getActiveAssignment → 200)", async () => {
      const { business } = await seedBusiness("admin-read-config");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Read Config",
        email: `boundary-admin-read-config-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const assignment = await configuration.getActiveAssignment(admin.id, business.id);
      expect(assignment.templateCode).toBe("default-erp");
      expect(assignment.isPrimary).toBe(true);
    }, 60_000);

    it("org Owner can update business settings (updateSettings → 200)", async () => {
      const { owner, business } = await seedBusiness("owner-update-settings");
      const before = await platform.getSettings(owner.id, business.id);
      const updated = await platform.updateSettings(
        owner.id,
        business.id,
        {
          name: "Boundary Co Renamed",
          legalName: "Boundary Co LLC",
          email: "owner@boundary.example",
          phone: "+966500000000",
          addressLine1: "King Fahd Road",
          addressLine2: null,
          city: "Riyadh",
          postalCode: "12345",
          countryCode: "SA",
          baseCurrency: "SAR",
          currencyScale: 2,
          locale: "en",
          timeZone: "Asia/Riyadh",
          quotationPrefix: "QUO-",
          quotationValidityDays: 30,
          defaultMessage: "Thank you for your business.",
          taxEnabled: true,
          taxName: "VAT",
          taxRegistrationNumber: "VAT12345",
          taxRatePercent: "15",
        },
        "integration-boundary-owner-update-settings",
      );
      expect(updated.name).toBe("Boundary Co Renamed");
      expect(updated.legalName).toBe("Boundary Co LLC");
      expect(updated.taxRegistrationNumber).toBe("VAT12345");
      expect(updated.quotationPrefix).toBe("QUO-");
      expect(before.id).toBe(updated.id);
    }, 60_000);

    it("org Admin can update business settings (updateSettings → 200)", async () => {
      const { business } = await seedBusiness("admin-update-settings");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Update Settings",
        email: `boundary-admin-update-settings-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const updated = await platform.updateSettings(
        admin.id,
        business.id,
        {
          name: "Boundary Co Admin Renamed",
          legalName: null,
          email: null,
          phone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          postalCode: null,
          countryCode: "SA",
          baseCurrency: "SAR",
          currencyScale: 2,
          locale: "en",
          timeZone: "Asia/Riyadh",
          quotationPrefix: "Q",
          quotationValidityDays: 14,
          defaultMessage: null,
          taxEnabled: false,
          taxName: "Tax",
          taxRegistrationNumber: null,
          taxRatePercent: "0",
        },
        "integration-boundary-admin-update-settings",
      );
      expect(updated.name).toBe("Boundary Co Admin Renamed");
      expect(updated.quotationValidityDays).toBe(14);
    }, 60_000);

    it("org Owner can list enabled modules (getEnabledModules → 200)", async () => {
      const { owner, business } = await seedBusiness("owner-modules");
      const modules = await configuration.getEnabledModules(owner.id, business.id);
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.some((m) => m.code === "customers" && m.implemented)).toBe(true);
    }, 60_000);

    it("org Admin can list enabled modules (getEnabledModules → 200)", async () => {
      const { business } = await seedBusiness("admin-modules");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Modules",
        email: `boundary-admin-modules-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const modules = await configuration.getEnabledModules(admin.id, business.id);
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.some((m) => m.code === "customers" && m.implemented)).toBe(true);
    }, 60_000);

    it("org Owner can re-run guided setup (applyRecommendation → 200)", async () => {
      const { owner, business } = await seedBusiness("owner-onboarding-apply");
      const recommendation = await onboarding.recommend({
        answers: { country: "SA", currency: "SAR", businessType: "services" },
      });
      const applied = await onboarding.applyRecommendation({
        userPublicId: owner.id,
        businessPublicId: business.id,
        request: { recommendation, consentToReview: true },
      });
      expect(applied.templateCode).toBe("default-erp");
      expect(applied.isPrimary).toBe(true);
    }, 60_000);

    it("org Admin can re-run guided setup (applyRecommendation → 200)", async () => {
      const { business } = await seedBusiness("admin-onboarding-apply");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Onboarding Apply",
        email: `boundary-admin-onboarding-apply-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);
      const recommendation = await onboarding.recommend({
        answers: { country: "SA", currency: "SAR", businessType: "services" },
      });
      const applied = await onboarding.applyRecommendation({
        userPublicId: admin.id,
        businessPublicId: business.id,
        request: { recommendation, consentToReview: true },
      });
      expect(applied.templateCode).toBe("default-erp");
      expect(applied.isPrimary).toBe(true);
    }, 60_000);
  });

  // ---------------------------------------------------------------------
  // Cross-tenant denial. BusinessAccessService.resolve throws NotFound
  // when the caller has no BusinessAccess record for the target business.
  // This is the tenant boundary for business-scoped endpoints.
  // ---------------------------------------------------------------------

  describe("Cross-tenant denial", () => {
    it("rejects org Owner of business A reading business B's configuration (→ 404)", async () => {
      const { business: businessA } = await seedBusiness("cta-a");
      const { owner: ownerB, business: businessB } = await seedBusiness("cta-b");
      // ownerB has no membership on businessA.
      await expect(
        configuration.getActiveAssignment(ownerB.id, businessA.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Sanity: ownerB can read their own business.
      const own = await configuration.getActiveAssignment(ownerB.id, businessB.id);
      expect(own.templateCode).toBe("default-erp");
    }, 60_000);

    it("rejects org Admin of business A updating business B's settings (→ 404)", async () => {
      const { business: businessA } = await seedBusiness("ctb-a");
      const { business: businessB } = await seedBusiness("ctb-b");
      const adminB = await identity.signUp({
        displayName: "Boundary Admin CTB",
        email: `boundary-admin-ctb-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(adminB.id, businessB.id, RoleCode.ADMIN);
      // adminB has no membership on businessA.
      await expect(
        platform.updateSettings(
          adminB.id,
          businessA.id,
          {
            name: "Stolen Co",
            legalName: null,
            email: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            postalCode: null,
            countryCode: "SA",
            baseCurrency: "SAR",
            currencyScale: 2,
            locale: "en",
            timeZone: "Asia/Riyadh",
            quotationPrefix: "Q",
            quotationValidityDays: 30,
            defaultMessage: null,
            taxEnabled: false,
            taxName: "Tax",
            taxRegistrationNumber: null,
            taxRatePercent: "0",
          },
          "integration-boundary-cross-tenant-admin",
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    }, 60_000);

    it("rejects org Owner assigning configuration to business B from business A (→ 404)", async () => {
      const { business: businessA } = await seedBusiness("ctc-a");
      const { owner: ownerB, business: businessB } = await seedBusiness("ctc-b");
      const recommendation = await onboarding.recommend({
        answers: { country: "SA", currency: "SAR", businessType: "services" },
      });
      // ownerB has no membership on businessA, so applyRecommendation (which
      // resolves access via BusinessAccessService) is denied.
      await expect(
        onboarding.applyRecommendation({
          userPublicId: ownerB.id,
          businessPublicId: businessA.id,
          request: { recommendation, consentToReview: true },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      // Sanity: ownerB can apply to their own business.
      const own = await onboarding.applyRecommendation({
        userPublicId: ownerB.id,
        businessPublicId: businessB.id,
        request: { recommendation, consentToReview: true },
      });
      expect(own.templateCode).toBe("default-erp");
    }, 60_000);
  });

  // ---------------------------------------------------------------------
  // Configuration identifier manipulation. A regular user cannot reach the
  // System Admin assignConfiguration endpoint (guard rejects). The business
  // settings schema does not accept configurationTemplateVersionId, so an
  // org user cannot change their assignment by editing settings.
  // ---------------------------------------------------------------------

  describe("Configuration identifier manipulation", () => {
    it("rejects a regular user at the SystemAdminGuard for assignConfiguration (→ 403)", async () => {
      const { business } = await seedBusiness("cim-guard");
      const member = await identity.signUp({
        displayName: "Boundary Member CIM",
        email: `boundary-member-cim-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(member.id, business.id, RoleCode.MEMBER);
      const ctx = createExecutionContext({ userId: member.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it("updateBusinessSettingsRequestSchema does not accept configurationTemplateVersionId", () => {
      const validInput = {
        name: "Acme",
        legalName: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        quotationPrefix: "Q",
        quotationValidityDays: 30,
        defaultMessage: null,
        taxEnabled: false,
        taxName: "Tax",
        taxRegistrationNumber: null,
        taxRatePercent: "0",
      };
      // Sanity: the valid input parses.
      expect(updateBusinessSettingsRequestSchema.parse(validInput)).toBeDefined();
      // The schema is a strictObject, so configurationTemplateVersionId is rejected.
      expect(() =>
        updateBusinessSettingsRequestSchema.parse({
          ...validInput,
          configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
        }),
      ).toThrow();
    }, 30_000);
  });

  // ---------------------------------------------------------------------
  // Self-escalation denied. There is no business-scoped endpoint that grants
  // System Admin. PlatformSystemAdmin rows can only be created via direct DB
  // access (or a future platform-only grant endpoint). The business settings
  // schema does not accept any system-admin field.
  // ---------------------------------------------------------------------

  describe("Self-escalation denied", () => {
    it("updateSettings does not create a PlatformSystemAdmin row for the caller", async () => {
      const { owner, business } = await seedBusiness("se-no-grant");
      const beforeCount = await database.client.platformSystemAdmin.count();
      await platform.updateSettings(
        owner.id,
        business.id,
        {
          name: "Self Escalation Co",
          legalName: null,
          email: null,
          phone: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          postalCode: null,
          countryCode: "SA",
          baseCurrency: "SAR",
          currencyScale: 2,
          locale: "en",
          timeZone: "Asia/Riyadh",
          quotationPrefix: "Q",
          quotationValidityDays: 30,
          defaultMessage: null,
          taxEnabled: false,
          taxName: "Tax",
          taxRegistrationNumber: null,
          taxRatePercent: "0",
        },
        "integration-boundary-self-escalation",
      );
      const afterCount = await database.client.platformSystemAdmin.count();
      expect(afterCount).toBe(beforeCount);
      // The owner still has no system admin row.
      const ownerRow = await database.client.user.findUnique({
        where: { publicId: owner.id },
        select: { id: true },
      });
      const ownerAdmin = ownerRow
        ? await database.client.platformSystemAdmin.findUnique({
            where: { userId: ownerRow.id },
            select: { id: true },
          })
        : null;
      expect(ownerAdmin).toBeNull();
    }, 60_000);

    it("updateBusinessSettingsRequestSchema does not accept systemAdmin fields", () => {
      const validInput = {
        name: "Acme",
        legalName: null,
        email: null,
        phone: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        quotationPrefix: "Q",
        quotationValidityDays: 30,
        defaultMessage: null,
        taxEnabled: false,
        taxName: "Tax",
        taxRegistrationNumber: null,
        taxRatePercent: "0",
      };
      expect(() =>
        updateBusinessSettingsRequestSchema.parse({
          ...validInput,
          systemAdminId: "s0000000-0000-4000-8000-000000000001",
        }),
      ).toThrow();
      expect(() =>
        updateBusinessSettingsRequestSchema.parse({
          ...validInput,
          grantSystemAdmin: true,
        }),
      ).toThrow();
    }, 30_000);
  });

  // ---------------------------------------------------------------------
  // Audit attribution. System Admin writes attribute the audit event to
  // actorSystemAdminId (not actorMembershipId). An org Admin attempting the
  // System Admin endpoint is rejected at the guard, so no audit event is
  // created. An org Admin performing a business-scoped assignment (via
  // onboarding apply) attributes the audit event to actorMembershipId, not
  // actorSystemAdminId.
  // ---------------------------------------------------------------------

  describe("Audit attribution", () => {
    it("System Admin assignConfiguration creates an audit event with actorSystemAdminId set", async () => {
      const { owner, business } = await seedBusiness("audit-sysadmin");
      const systemAdminPublicId = await grantSystemAdmin(owner.id);

      const templates = await systemAdminService.listConfigurationTemplateVersions({
        templateCode: "default-erp",
        status: "PUBLISHED",
      });
      const defaultErp = templates.find((t) => t.code === "default-erp");
      expect(defaultErp).toBeDefined();
      const publishedVersion = defaultErp?.versions[0];
      expect(publishedVersion).toBeDefined();

      const beforeCount = await countAuditEvents(business.id, "ASSIGN");

      await systemAdminService.assignConfiguration({
        systemAdminId: systemAdminPublicId,
        businessPublicId: business.id,
        configurationTemplateVersionId: publishedVersion!.id,
        reason: "Integration test system-admin assignment",
      });

      const afterCount = await countAuditEvents(business.id, "ASSIGN");
      expect(afterCount).toBe(beforeCount + 1);

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
      expect(matching?.actorMembershipId).toBeNull();
      expect(matching?.reason).toBe("Integration test system-admin assignment");
    }, 60_000);

    it("org Admin attempting system-admin assignConfiguration is rejected and creates no audit event", async () => {
      const { business } = await seedBusiness("audit-org-admin-rejected");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Audit Rejected",
        email: `boundary-admin-audit-rejected-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);

      const beforeCount = await countAuditEvents(business.id, "ASSIGN");

      // The guard rejects the org Admin, so the System Admin service is never
      // reached and no audit event is created.
      const ctx = createExecutionContext({ userId: admin.id });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);

      const afterCount = await countAuditEvents(business.id, "ASSIGN");
      expect(afterCount).toBe(beforeCount);
    }, 60_000);

    it("org Admin onboarding apply attributes the audit event to actorMembershipId, not actorSystemAdminId", async () => {
      const { business } = await seedBusiness("audit-org-admin-apply");
      const admin = await identity.signUp({
        displayName: "Boundary Admin Audit Apply",
        email: `boundary-admin-audit-apply-${Date.now()}@example.test`,
        password: "Production1Password",
      });
      await addBusinessMember(admin.id, business.id, RoleCode.ADMIN);

      const recommendation = await onboarding.recommend({
        answers: { country: "SA", currency: "SAR", businessType: "services" },
      });

      const beforeCount = await countAuditEvents(business.id, "ASSIGN");

      await onboarding.applyRecommendation({
        userPublicId: admin.id,
        businessPublicId: business.id,
        request: { recommendation, consentToReview: true },
      });

      const afterCount = await countAuditEvents(business.id, "ASSIGN");
      expect(afterCount).toBe(beforeCount + 1);

      // The audit event is attributable to the admin's membership, not a system admin.
      const auditPage = await systemAdminService.listAuditEvents({
        entityType: "BusinessConfigurationAssignment",
        businessPublicId: business.id,
        page: 1,
        pageSize: 50,
      });
      const matching = auditPage.items.find(
        (event) => event.action === "ASSIGN" && event.actorSystemAdminId === null,
      );
      expect(matching).toBeDefined();
      expect(matching?.actorMembershipId).not.toBeNull();
    }, 60_000);
  });
});
