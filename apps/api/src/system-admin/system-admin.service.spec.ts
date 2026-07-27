import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ConfigurationVersionStatus } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { SystemAdminService } from "./system-admin.service.js";

const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const TENANT_PUBLIC_ID = "t0000000-0000-4000-8000-000000000001";
const VERSION_PUBLIC_ID = "v0000000-0000-4000-8000-000000000001";
const SYSTEM_ADMIN_PUBLIC_ID = "s0000000-0000-4000-8000-000000000001";
const TEMPLATE_PUBLIC_ID = "tpl00000-0000-4000-8000-000000000001";

const BUSINESS_ROW = {
  id: 100n,
  publicId: BUSINESS_PUBLIC_ID,
  tenantId: 50n,
  tenant: { publicId: TENANT_PUBLIC_ID },
  name: "Acme Services",
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
};

const PUBLISHED_VERSION_ROW = {
  id: 200n,
  publicId: VERSION_PUBLIC_ID,
  version: "1.0.0",
  templateId: 10n,
  status: ConfigurationVersionStatus.PUBLISHED,
};

function createDatabaseMock(overrides: {
  businessFindUnique?: ReturnType<typeof vi.fn>;
  businessFindMany?: ReturnType<typeof vi.fn>;
  businessCount?: ReturnType<typeof vi.fn>;
  assignmentFindFirst?: ReturnType<typeof vi.fn>;
  assignmentFindMany?: ReturnType<typeof vi.fn>;
  assignmentCreate?: ReturnType<typeof vi.fn>;
  assignmentUpdate?: ReturnType<typeof vi.fn>;
  versionFindUnique?: ReturnType<typeof vi.fn>;
  templateFindUnique?: ReturnType<typeof vi.fn>;
  moduleFindMany?: ReturnType<typeof vi.fn>;
  systemAdminFindUnique?: ReturnType<typeof vi.fn>;
  auditCreate?: ReturnType<typeof vi.fn>;
  auditFindFirst?: ReturnType<typeof vi.fn>;
  auditFindMany?: ReturnType<typeof vi.fn>;
  auditCount?: ReturnType<typeof vi.fn>;
  customizationFindMany?: ReturnType<typeof vi.fn>;
  customizationCount?: ReturnType<typeof vi.fn>;
  queryRaw?: ReturnType<typeof vi.fn>;
  withScope?: ReturnType<typeof vi.fn>;
}): DatabaseService {
  const transaction = {
    businessConfigurationAssignment: {
      findFirst: overrides.assignmentFindFirst ?? vi.fn().mockResolvedValue(null),
      create: overrides.assignmentCreate ?? vi.fn(),
      update: overrides.assignmentUpdate ?? vi.fn().mockResolvedValue(undefined),
    },
    configurationAuditEvent: {
      create: overrides.auditCreate ?? vi.fn().mockResolvedValue(undefined),
    },
  };
  const withScope =
    overrides.withScope ??
    vi
      .fn()
      .mockImplementation(
        async (_scope: unknown, work: (tx: typeof transaction) => Promise<unknown>) =>
          work(transaction),
      );
  return {
    client: {
      business: {
        findUnique: overrides.businessFindUnique ?? vi.fn().mockResolvedValue(BUSINESS_ROW),
        findMany: overrides.businessFindMany ?? vi.fn().mockResolvedValue([]),
        count: overrides.businessCount ?? vi.fn().mockResolvedValue(0),
      },
      businessConfigurationAssignment: {
        findFirst: overrides.assignmentFindFirst ?? vi.fn().mockResolvedValue(null),
        findMany: overrides.assignmentFindMany ?? vi.fn().mockResolvedValue([]),
        create: overrides.assignmentCreate ?? vi.fn(),
        update: overrides.assignmentUpdate ?? vi.fn().mockResolvedValue(undefined),
      },
      configurationTemplateVersion: {
        findUnique: overrides.versionFindUnique ?? vi.fn().mockResolvedValue(PUBLISHED_VERSION_ROW),
      },
      configurationTemplate: {
        findUnique:
          overrides.templateFindUnique ??
          vi.fn().mockResolvedValue({ id: 10n, publicId: TEMPLATE_PUBLIC_ID, code: "default-erp" }),
      },
      moduleDefinition: {
        findMany: overrides.moduleFindMany ?? vi.fn().mockResolvedValue([]),
      },
      platformSystemAdmin: {
        findUnique:
          overrides.systemAdminFindUnique ??
          vi.fn().mockResolvedValue({ id: 5n, publicId: SYSTEM_ADMIN_PUBLIC_ID }),
      },
      configurationAuditEvent: {
        create: overrides.auditCreate ?? vi.fn().mockResolvedValue(undefined),
        findFirst: overrides.auditFindFirst ?? vi.fn().mockResolvedValue(null),
        findMany: overrides.auditFindMany ?? vi.fn().mockResolvedValue([]),
        count: overrides.auditCount ?? vi.fn().mockResolvedValue(0),
      },
      customizationRequest: {
        findMany: overrides.customizationFindMany ?? vi.fn().mockResolvedValue([]),
        count: overrides.customizationCount ?? vi.fn().mockResolvedValue(0),
      },
      $queryRaw: overrides.queryRaw ?? vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
    withScope,
  } as unknown as DatabaseService;
}

describe("SystemAdminService", () => {
  describe("listOrganizations", () => {
    it("returns paginated organizations with current assignment summaries (cross-tenant read)", async () => {
      const businessFindMany = vi.fn().mockResolvedValue([
        {
          ...BUSINESS_ROW,
          assignments: [
            {
              publicId: "a0000000-0000-4000-8000-000000000001",
              assignedAt: new Date("2026-07-28T00:00:00.000Z"),
              configurationTemplateVersion: {
                publicId: VERSION_PUBLIC_ID,
                version: "1.0.0",
                template: { code: "default-erp" },
              },
            },
          ],
        },
      ]);
      const businessCount = vi.fn().mockResolvedValue(1);
      const database = createDatabaseMock({
        businessFindMany,
        businessCount,
      });
      const service = new SystemAdminService(database);

      const result = await service.listOrganizations({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.currentAssignment?.templateCode).toBe("default-erp");
      expect(businessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it("applies a search filter to business name", async () => {
      const businessFindMany = vi.fn().mockResolvedValue([]);
      const businessCount = vi.fn().mockResolvedValue(0);
      const database = createDatabaseMock({ businessFindMany, businessCount });
      const service = new SystemAdminService(database);

      await service.listOrganizations({ search: "acme", page: 1, pageSize: 20 });

      expect(businessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: "acme" }) }),
            ]),
          }),
        }),
      );
    });

    it("clamps page and pageSize to safe bounds", async () => {
      const businessFindMany = vi.fn().mockResolvedValue([]);
      const businessCount = vi.fn().mockResolvedValue(0);
      const database = createDatabaseMock({ businessFindMany, businessCount });
      const service = new SystemAdminService(database);

      const result = await service.listOrganizations({ page: -1, pageSize: 9999 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(100);
    });
  });

  describe("getOrganization", () => {
    it("throws NotFound when the business does not exist", async () => {
      const database = createDatabaseMock({
        businessFindUnique: vi.fn().mockResolvedValue(null),
      });
      const service = new SystemAdminService(database);

      await expect(service.getOrganization("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns organization detail with enabled modules when a primary assignment exists", async () => {
      const assignmentFindMany = vi.fn().mockResolvedValue([
        {
          publicId: "a0000000-0000-4000-8000-000000000001",
          assignedAt: new Date("2026-07-28T00:00:00.000Z"),
          configurationTemplateVersion: {
            publicId: VERSION_PUBLIC_ID,
            version: "1.0.0",
            snapshotJson: {
              modules: [{ code: "customers", enabled: true }],
              workflows: [],
              roleDefaults: [],
              tax: { enabled: false, name: "Tax", ratePercent: "0", priceIncludesTax: false },
              currency: { currencyCode: "USD", currencyScale: 2 },
              numbering: {
                quotationPrefix: "Q",
                invoicePrefix: "INV",
                quotationValidityDays: 30,
                invoiceDueDays: 30,
              },
              documentTemplates: [],
              terminology: {
                customerLabel: "Customer",
                quotationLabel: "Quotation",
                invoiceLabel: "Invoice",
              },
            },
            template: { code: "default-erp" },
          },
        },
      ]);
      const moduleFindMany = vi
        .fn()
        .mockResolvedValue([
          { code: "customers", name: "Customers", implemented: true, status: "ACTIVE" },
        ]);
      const database = createDatabaseMock({
        assignmentFindMany,
        moduleFindMany,
      });
      const service = new SystemAdminService(database);

      const result = await service.getOrganization(BUSINESS_PUBLIC_ID);

      expect(result.currentAssignment?.templateCode).toBe("default-erp");
      expect(result.enabledModules).toHaveLength(1);
      expect(result.enabledModules[0]?.code).toBe("customers");
    });
  });

  describe("assignConfiguration", () => {
    it("requires a non-empty reason", async () => {
      const database = createDatabaseMock({});
      const service = new SystemAdminService(database);

      await expect(
        service.assignConfiguration({
          systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
          businessPublicId: BUSINESS_PUBLIC_ID,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "   ",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a draft version with 409 Conflict", async () => {
      const versionFindUnique = vi.fn().mockResolvedValue({
        id: 200n,
        publicId: VERSION_PUBLIC_ID,
        version: "1.0.0",
        templateId: 10n,
        status: ConfigurationVersionStatus.DRAFT,
      });
      const database = createDatabaseMock({ versionFindUnique });
      const service = new SystemAdminService(database);

      await expect(
        service.assignConfiguration({
          systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
          businessPublicId: BUSINESS_PUBLIC_ID,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "Switching to draft for testing",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("demotes the previous primary, creates a new primary, and writes an audit event with actor=systemAdminId", async () => {
      const previousPrimary = {
        id: 600n,
        publicId: "a0000000-0000-4000-8000-0000000000old",
        configurationTemplateVersion: {
          publicId: "v0000000-0000-4000-8000-0000000000old",
          version: "0.9.0",
          template: { code: "default-erp" },
        },
      };
      const createdAssignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000new",
        isPrimary: true,
        reason: "Onboarding correction",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp" },
        },
        assignedByMembership: null,
      };
      const assignmentFindFirst = vi.fn().mockResolvedValue(previousPrimary);
      const assignmentCreate = vi.fn().mockResolvedValue(createdAssignment);
      const assignmentUpdate = vi.fn().mockResolvedValue(undefined);
      const auditCreate = vi.fn().mockResolvedValue(undefined);
      const database = createDatabaseMock({
        assignmentFindFirst,
        assignmentCreate,
        assignmentUpdate,
        auditCreate,
      });
      const service = new SystemAdminService(database);

      const result = await service.assignConfiguration({
        systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
        businessPublicId: BUSINESS_PUBLIC_ID,
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Onboarding correction",
      });

      expect(result.isPrimary).toBe(true);
      expect(result.templateCode).toBe("default-erp");
      expect(assignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: previousPrimary.id },
          data: { isPrimary: false },
        }),
      );
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ASSIGN",
            actorSystemAdminId: 5n,
            entityType: "BusinessConfigurationAssignment",
            reason: "Onboarding correction",
          }),
        }),
      );
    });

    it("translates a partial unique index violation into 409 Conflict", async () => {
      const assignmentCreate = vi.fn().mockRejectedValue({ code: "P2002" });
      const database = createDatabaseMock({ assignmentCreate });
      const service = new SystemAdminService(database);

      await expect(
        service.assignConfiguration({
          systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
          businessPublicId: BUSINESS_PUBLIC_ID,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "Retry",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("setDefaultErpVersion", () => {
    it("requires a non-empty reason", async () => {
      const database = createDatabaseMock({});
      const service = new SystemAdminService(database);

      await expect(
        service.setDefaultErpVersion({
          systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a version whose template is not default-erp", async () => {
      const templateFindUnique = vi.fn().mockResolvedValue({
        id: 10n,
        publicId: TEMPLATE_PUBLIC_ID,
        code: "custom-erp",
      });
      const database = createDatabaseMock({ templateFindUnique });
      const service = new SystemAdminService(database);

      await expect(
        service.setDefaultErpVersion({
          systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          reason: "Switching default",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("writes a platform-level audit event with tenantId=null and actor=systemAdminId", async () => {
      const auditCreate = vi.fn().mockResolvedValue(undefined);
      const database = createDatabaseMock({ auditCreate });
      const service = new SystemAdminService(database);

      const result = await service.setDefaultErpVersion({
        systemAdminId: SYSTEM_ADMIN_PUBLIC_ID,
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "Promote 1.0.0",
      });

      expect(result.configurationTemplateVersionId).toBe(VERSION_PUBLIC_ID);
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: null,
            actorSystemAdminId: 5n,
            entityType: "PlatformDefaultErpVersion",
            action: "UPDATE",
            reason: "Promote 1.0.0",
          }),
        }),
      );
    });
  });

  describe("getSystemHealth", () => {
    it("returns ok when the database ping succeeds", async () => {
      const queryRaw = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
      const database = createDatabaseMock({ queryRaw });
      const service = new SystemAdminService(database);

      const result = await service.getSystemHealth();

      expect(result.status).toBe("ok");
      expect(result.checks.database?.status).toBe("ok");
    });

    it("returns down with detail when the database ping fails", async () => {
      const queryRaw = vi.fn().mockRejectedValue(new Error("connection refused"));
      const database = createDatabaseMock({ queryRaw });
      const service = new SystemAdminService(database);

      const result = await service.getSystemHealth();

      expect(result.status).toBe("down");
      expect(result.checks.database?.status).toBe("down");
    });
  });
});
