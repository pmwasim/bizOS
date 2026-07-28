import { describe, expect, it, vi } from "vitest";

import { type SystemAdminPrincipal } from "@bizo/contracts/system-admin";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { SystemAdminController } from "./system-admin.controller.js";
import { type SystemAdminService } from "./system-admin.service.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const SYSTEM_ADMIN_PUBLIC_ID = "s0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const VERSION_PUBLIC_ID = "v0000000-0000-4000-8000-000000000001";

const adminPrincipal: AuthenticatedPrincipal = {
  userId: USER_PUBLIC_ID,
  systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
  isSystemAdmin: true,
};

function createServiceMock(overrides: Partial<SystemAdminService> = {}): SystemAdminService {
  const mock = {
    listOrganizations: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    getOrganization: vi.fn().mockResolvedValue({
      businessId: BUSINESS_PUBLIC_ID,
      tenantId: "t0000000-0000-4000-8000-000000000001",
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
      currentAssignment: null,
      enabledModules: [],
    }),
    getAssignmentHistory: vi.fn().mockResolvedValue([]),
    listConfigurationTemplateVersions: vi.fn().mockResolvedValue([]),
    listWorkflowTemplateVersions: vi.fn().mockResolvedValue([]),
    listCustomizationRequests: vi
      .fn()
      .mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    listAuditEvents: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    assignConfiguration: vi.fn().mockResolvedValue({
      id: "a0000000-0000-4000-8000-000000000001",
      businessId: BUSINESS_PUBLIC_ID,
      configurationTemplateVersionId: VERSION_PUBLIC_ID,
      templateCode: "default-erp",
      templateVersion: "1.0.0",
      isPrimary: true,
      assignedByMembershipId: null,
      reason: "Onboarding correction",
      assignedAt: "2026-07-28T00:00:00.000Z",
    }),
    setDefaultErpVersion: vi
      .fn()
      .mockResolvedValue({ configurationTemplateVersionId: VERSION_PUBLIC_ID, reason: "Promote" }),
    getSystemHealth: vi.fn().mockResolvedValue({
      service: "api",
      status: "ok",
      timestamp: "2026-07-28T00:00:00.000Z",
      checks: { database: { status: "ok" } },
    }),
  };
  return { ...mock, ...overrides } as unknown as SystemAdminService;
}

describe("SystemAdminController", () => {
  describe("me", () => {
    it("returns the resolved System Admin principal", () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      const result = controller.me(adminPrincipal);

      const expected: SystemAdminPrincipal = {
        systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
        userId: USER_PUBLIC_ID,
        status: "ACTIVE",
        isActive: true,
      };
      expect(result).toEqual(expected);
    });

    it("throws when the guard did not populate systemAdminId", () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      expect(() => controller.me({ userId: USER_PUBLIC_ID })).toThrow();
    });
  });

  describe("listOrganizations", () => {
    it("delegates to the service with the parsed query", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.listOrganizations({ search: "acme", page: 1, pageSize: 20 });

      expect(service.listOrganizations).toHaveBeenCalledWith({
        search: "acme",
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe("getOrganization", () => {
    it("delegates to the service with the path param", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.getOrganization(BUSINESS_PUBLIC_ID);

      expect(service.getOrganization).toHaveBeenCalledWith(BUSINESS_PUBLIC_ID);
    });
  });

  describe("getAssignmentHistory", () => {
    it("delegates to the service with the path param", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.getAssignmentHistory(BUSINESS_PUBLIC_ID);

      expect(service.getAssignmentHistory).toHaveBeenCalledWith(BUSINESS_PUBLIC_ID);
    });
  });

  describe("listConfigurationTemplates", () => {
    it("delegates to the service with the parsed query", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.listConfigurationTemplates({
        templateCode: "default-erp",
        status: undefined,
      });

      expect(service.listConfigurationTemplateVersions).toHaveBeenCalledWith({
        templateCode: "default-erp",
        status: undefined,
      });
    });
  });

  describe("listWorkflowTemplates", () => {
    it("delegates to the service with the parsed query", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.listWorkflowTemplates({
        workflowTemplateCode: undefined,
        status: undefined,
      });

      expect(service.listWorkflowTemplateVersions).toHaveBeenCalledWith({
        workflowTemplateCode: undefined,
        status: undefined,
      });
    });
  });

  describe("assignConfiguration", () => {
    it("passes the principal systemAdminId and body to the service", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.assignConfiguration(adminPrincipal, BUSINESS_PUBLIC_ID, {
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Onboarding correction",
        confirm: true,
      });

      expect(service.assignConfiguration).toHaveBeenCalledWith({
        systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
        businessPublicId: BUSINESS_PUBLIC_ID,
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Onboarding correction",
      });
    });

    it("throws when the guard did not populate systemAdminId", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await expect(
        controller.assignConfiguration({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID, {
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "x",
          confirm: true,
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("setDefaultErpVersion", () => {
    it("passes the principal systemAdminId and body to the service", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.setDefaultErpVersion(adminPrincipal, {
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Promote 1.0.0",
        confirm: true,
      });

      expect(service.setDefaultErpVersion).toHaveBeenCalledWith({
        systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Promote 1.0.0",
      });
    });

    it("throws when the guard did not populate systemAdminId", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await expect(
        controller.setDefaultErpVersion(
          { userId: USER_PUBLIC_ID },
          { configurationTemplateVersionId: VERSION_PUBLIC_ID, reason: "x", confirm: true },
        ),
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("listCustomizationRequests", () => {
    it("delegates to the service with the parsed query", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.listCustomizationRequests({ status: "OPEN", page: 1, pageSize: 20 });

      expect(service.listCustomizationRequests).toHaveBeenCalledWith({
        status: "OPEN",
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe("listAuditEvents", () => {
    it("delegates to the service with the parsed query", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      await controller.listAuditEvents({
        entityType: "BusinessConfigurationAssignment",
        businessPublicId: undefined,
        page: 1,
        pageSize: 20,
      });

      expect(service.listAuditEvents).toHaveBeenCalledWith({
        entityType: "BusinessConfigurationAssignment",
        businessPublicId: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe("getSystemHealth", () => {
    it("delegates to the service", async () => {
      const service = createServiceMock();
      const controller = new SystemAdminController(service);

      const result = await controller.getSystemHealth();

      expect(service.getSystemHealth).toHaveBeenCalled();
      expect(result.status).toBe("ok");
    });
  });
});
