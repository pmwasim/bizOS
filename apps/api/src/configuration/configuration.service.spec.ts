import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RoleCode } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import {
  type BusinessAccessContext,
  type BusinessAccessService,
} from "../security/business-access.service.js";
import {
  ConfigurationService,
  deriveInvoiceConversionRequirements,
} from "./configuration.service.js";

const access: BusinessAccessContext = {
  businessId: 200n,
  businessPublicId: "b0000000-0000-4000-8000-000000000001",
  membershipId: 300n,
  role: RoleCode.OWNER,
  tenantId: 100n,
  tenantPublicId: "t0000000-0000-4000-8000-000000000001",
  userId: 400n,
  userPublicId: "u0000000-0000-4000-8000-000000000001",
};

const VERSION_PUBLIC_ID = "v0000000-0000-4000-8000-000000000001";
const VERSION_ID = 500n;

const PUBLISHED_SNAPSHOT = {
  modules: [
    { code: "customers", enabled: true },
    { code: "quotations", enabled: true },
    { code: "sales-orders", enabled: true },
  ],
  workflows: [{ documentType: "QUOTATION", workflowTemplateCode: "sales-workflow" }],
  roleDefaults: [],
  tax: { enabled: false, name: "Tax", ratePercent: "0", priceIncludesTax: false },
  currency: { currencyCode: "USD", currencyScale: 2 },
  numbering: {
    quotationPrefix: "Q",
    invoicePrefix: "INV",
    quotationValidityDays: 30,
    invoiceDueDays: 30,
  },
  documentTemplates: [{ documentType: "QUOTATION", templateName: "professional-v1" }],
  terminology: {
    customerLabel: "Customer",
    quotationLabel: "Quotation",
    invoiceLabel: "Invoice",
  },
};

interface MockTransaction {
  business: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  businessConfigurationAssignment: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  configurationTemplateVersion: {
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  workflowTemplateVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  moduleDefinition: { findMany: ReturnType<typeof vi.fn> };
  document: { findFirst: ReturnType<typeof vi.fn>; findFirstOrThrow: ReturnType<typeof vi.fn> };
  documentWorkflowContext: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  storedObject: { findFirst: ReturnType<typeof vi.fn> };
  configurationAuditEvent: { create: ReturnType<typeof vi.fn> };
}

function createMockTransaction(overrides: Partial<MockTransaction> = {}): MockTransaction {
  return {
    business: { findUniqueOrThrow: vi.fn() },
    businessConfigurationAssignment: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    configurationTemplateVersion: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
    },
    workflowTemplateVersion: { findFirst: vi.fn(), findUnique: vi.fn() },
    moduleDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    document: { findFirst: vi.fn(), findFirstOrThrow: vi.fn() },
    documentWorkflowContext: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
    storedObject: { findFirst: vi.fn().mockResolvedValue(null) },
    configurationAuditEvent: { create: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

function createDatabase(transaction: MockTransaction): DatabaseService {
  const db = {
    client: {
      configurationTemplateVersion: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    },
    withScope: vi
      .fn()
      .mockImplementation(
        async (_scope: unknown, work: (value: MockTransaction) => Promise<unknown>) =>
          work(transaction),
      ),
  };
  return db as unknown as DatabaseService;
}

function createBusinessAccess(): BusinessAccessService {
  return {
    resolve: vi.fn().mockResolvedValue(access),
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  } as unknown as BusinessAccessService;
}

describe("ConfigurationService", () => {
  describe("assignConfiguration", () => {
    it("creates a primary assignment, demotes the previous primary, and writes an audit event", async () => {
      const previousPrimary = {
        id: 600n,
        publicId: "a0000000-0000-4000-8000-0000000000old",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "previous",
        assignedAt: new Date("2026-07-01T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const createdAssignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000new",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "onboarding",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(previousPrimary),
          create: vi.fn().mockResolvedValue(createdAssignment),
          update: vi.fn().mockResolvedValue(undefined),
        },
      });
      const database = createDatabase(transaction);
      database.client.configurationTemplateVersion.findUnique = vi.fn().mockResolvedValue({
        id: VERSION_ID,
        publicId: VERSION_PUBLIC_ID,
        version: "1.0.0",
        status: "PUBLISHED",
      });
      const service = new ConfigurationService(database, createBusinessAccess());

      const result = await service.assignConfiguration({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        configurationTemplateVersionId: VERSION_PUBLIC_ID,
        reason: "onboarding",
        isPrimary: true,
      });

      expect(result.isPrimary).toBe(true);
      expect(result.templateCode).toBe("default-erp");
      expect(transaction.businessConfigurationAssignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: previousPrimary.id },
          data: { isPrimary: false },
        }),
      );
      expect(transaction.configurationAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ASSIGN",
            entityType: "BusinessConfigurationAssignment",
            entityId: createdAssignment.id,
          }),
        }),
      );
      const auditCall = transaction.configurationAuditEvent.create.mock.calls[0]?.[0].data;
      expect(auditCall.beforeJson).toMatchObject({ templateCode: "default-erp" });
      expect(auditCall.afterJson).toMatchObject({ templateCode: "default-erp" });
      expect(Array.isArray(auditCall.diffJson)).toBe(true);
    });

    it("translates a partial unique index violation into a 409 conflict", async () => {
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue({ code: "P2002" }),
          update: vi.fn(),
        },
      });
      const database = createDatabase(transaction);
      database.client.configurationTemplateVersion.findUnique = vi.fn().mockResolvedValue({
        id: VERSION_ID,
        publicId: VERSION_PUBLIC_ID,
        version: "1.0.0",
        status: "PUBLISHED",
      });
      const service = new ConfigurationService(database, createBusinessAccess());

      await expect(
        service.assignConfiguration({
          userPublicId: access.userPublicId,
          businessPublicId: access.businessPublicId,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          isPrimary: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects cross-tenant access via businessAccess.resolve throwing NotFound", async () => {
      const businessAccess = {
        resolve: vi
          .fn()
          .mockRejectedValue(new NotFoundException("We could not find that business.")),
        assertAllowed: vi.fn(),
      } as unknown as BusinessAccessService;
      const service = new ConfigurationService(
        createDatabase(createMockTransaction()),
        businessAccess,
      );

      await expect(
        service.assignConfiguration({
          userPublicId: "outsider",
          businessPublicId: access.businessPublicId,
          configurationTemplateVersionId: VERSION_PUBLIC_ID,
          isPrimary: true,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("assignDefaultErp", () => {
    it("resolves the current published default-erp version and assigns it as primary", async () => {
      const createdAssignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000def",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "default",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdAssignment),
          update: vi.fn(),
        },
      });
      const database = createDatabase(transaction);
      database.client.configurationTemplateVersion.findFirst = vi.fn().mockResolvedValue({
        id: VERSION_ID,
        publicId: VERSION_PUBLIC_ID,
        templateId: 1n,
        version: "1.0.0",
        status: "PUBLISHED",
        snapshotJson: PUBLISHED_SNAPSHOT,
        publishedAt: new Date("2026-07-28T00:00:00.000Z"),
        createdAt: new Date("2026-07-28T00:00:00.000Z"),
        updatedAt: new Date("2026-07-28T00:00:00.000Z"),
        template: {
          id: 1n,
          publicId: "t0000000-0000-4000-8000-0000000000tpl",
          code: "default-erp",
          name: "Default ERP",
        },
      });
      database.client.configurationTemplateVersion.findUnique = vi.fn().mockResolvedValue({
        id: VERSION_ID,
        publicId: VERSION_PUBLIC_ID,
        version: "1.0.0",
        status: "PUBLISHED",
      });
      const service = new ConfigurationService(database, createBusinessAccess());

      const result = await service.assignDefaultErp({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
      });

      expect(result.isPrimary).toBe(true);
      expect(result.templateCode).toBe("default-erp");
      expect(database.client.configurationTemplateVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            template: { code: "default-erp" },
            status: "PUBLISHED",
          }),
        }),
      );
    });
  });

  describe("getActiveAssignment", () => {
    it("throws NotFound when no primary assignment exists", async () => {
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      await expect(
        service.getActiveAssignment(access.userPublicId, access.businessPublicId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the primary assignment with its snapshot", async () => {
      const assignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000get",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "onboarding",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(assignment),
          create: vi.fn(),
          update: vi.fn(),
        },
        configurationTemplateVersion: {
          findUnique: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ snapshotJson: PUBLISHED_SNAPSHOT }),
          findFirst: vi.fn(),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.getActiveAssignment(
        access.userPublicId,
        access.businessPublicId,
      );
      expect(result.templateCode).toBe("default-erp");
      expect(result.snapshot.modules).toHaveLength(3);
    });
  });

  describe("getEnabledModules", () => {
    it("returns only implemented modules that the snapshot marks as enabled", async () => {
      const assignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000mod",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "onboarding",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(assignment),
          create: vi.fn(),
          update: vi.fn(),
        },
        configurationTemplateVersion: {
          findUnique: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ snapshotJson: PUBLISHED_SNAPSHOT }),
          findFirst: vi.fn(),
        },
        moduleDefinition: {
          findMany: vi.fn().mockResolvedValue([
            {
              code: "customers",
              name: "Customers",
              description: "Customer directory.",
              implemented: true,
              status: "ACTIVE",
            },
            {
              code: "quotations",
              name: "Quotations",
              description: "Quotation management.",
              implemented: true,
              status: "ACTIVE",
            },
          ]),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.getEnabledModules(access.userPublicId, access.businessPublicId);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.code).sort()).toEqual(["customers", "quotations"]);
      expect(transaction.moduleDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            implemented: true,
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("returns an empty list when no primary assignment exists", async () => {
      const transaction = createMockTransaction({
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.getEnabledModules(access.userPublicId, access.businessPublicId);
      expect(result).toEqual([]);
    });
  });

  describe("createDocumentWorkflowContext", () => {
    const DOCUMENT_PUBLIC_ID = "d0000000-0000-4000-8000-000000000001";
    const DOCUMENT_ID = 800n;
    const WORKFLOW_VERSION_ID = 900n;

    it("is idempotent: returns the existing context without overwriting", async () => {
      const existing = {
        id: 1000n,
        publicId: "w0000000-0000-4000-8000-000000000001",
        tenantId: access.tenantId,
        businessId: access.businessId,
        documentId: DOCUMENT_ID,
        configurationTemplateVersionId: VERSION_ID,
        workflowTemplateVersionId: WORKFLOW_VERSION_ID,
        documentType: "QUOTATION",
        workflowState: "draft-quotation",
        capturedSnapshotJson: PUBLISHED_SNAPSHOT,
        createdAt: new Date("2026-07-28T00:00:00.000Z"),
        updatedAt: new Date("2026-07-28T00:00:00.000Z"),
      };
      const transaction = createMockTransaction({
        document: {
          findFirst: vi.fn().mockResolvedValue({ id: DOCUMENT_ID, type: "QUOTATION" }),
          findFirstOrThrow: vi.fn(),
        },
        documentWorkflowContext: {
          findUnique: vi.fn().mockResolvedValue(existing),
          create: vi.fn(),
          update: vi.fn(),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.createDocumentWorkflowContext({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        documentType: "QUOTATION",
      });

      expect(result.id).toBe(existing.publicId);
      expect(result.workflowState).toBe("draft-quotation");
      expect(transaction.documentWorkflowContext.create).not.toHaveBeenCalled();
    });

    it("creates a new context from the active assignment and matching workflow", async () => {
      const assignment = {
        id: 700n,
        publicId: "a0000000-0000-4000-8000-0000000000ctx",
        tenantId: access.tenantId,
        businessId: access.businessId,
        configurationTemplateVersionId: VERSION_ID,
        isPrimary: true,
        assignedByMembershipId: access.membershipId,
        reason: "onboarding",
        assignedAt: new Date("2026-07-28T00:00:00.000Z"),
        configurationTemplateVersion: {
          id: VERSION_ID,
          publicId: VERSION_PUBLIC_ID,
          version: "1.0.0",
          template: { code: "default-erp", name: "Default ERP" },
        },
      };
      const createdContext = {
        id: 1100n,
        publicId: "w0000000-0000-4000-8000-000000000002",
        tenantId: access.tenantId,
        businessId: access.businessId,
        documentId: DOCUMENT_ID,
        configurationTemplateVersionId: VERSION_ID,
        workflowTemplateVersionId: WORKFLOW_VERSION_ID,
        documentType: "QUOTATION",
        workflowState: null,
        capturedSnapshotJson: PUBLISHED_SNAPSHOT,
        createdAt: new Date("2026-07-28T00:00:00.000Z"),
        updatedAt: new Date("2026-07-28T00:00:00.000Z"),
      };
      const transaction = createMockTransaction({
        document: {
          findFirst: vi.fn().mockResolvedValue({ id: DOCUMENT_ID, type: "QUOTATION" }),
          findFirstOrThrow: vi.fn(),
        },
        documentWorkflowContext: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(createdContext),
          update: vi.fn(),
        },
        businessConfigurationAssignment: {
          findFirst: vi.fn().mockResolvedValue(assignment),
          create: vi.fn(),
          update: vi.fn(),
        },
        configurationTemplateVersion: {
          findUnique: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            snapshotJson: PUBLISHED_SNAPSHOT,
            publicId: VERSION_PUBLIC_ID,
          }),
          findFirst: vi.fn(),
        },
        workflowTemplateVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: WORKFLOW_VERSION_ID,
            publicId: "wv000000-0000-4000-8000-000000000001",
            definitionJson: { states: [], transitions: [] },
          }),
          findUnique: vi.fn(),
        },
      });
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.createDocumentWorkflowContext({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        documentType: "QUOTATION",
      });

      expect(result.workflowTemplateVersionId).toBe(WORKFLOW_VERSION_ID.toString(10));
      expect(transaction.documentWorkflowContext.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: DOCUMENT_ID,
            workflowTemplateVersionId: WORKFLOW_VERSION_ID,
            documentType: "QUOTATION",
          }),
        }),
      );
      expect(transaction.configurationAuditEvent.create).toHaveBeenCalled();
    });
  });

  describe("evaluateTransition", () => {
    const DOCUMENT_PUBLIC_ID = "d0000000-0000-4000-8000-000000000002";
    const DOCUMENT_ID = 810n;
    const WORKFLOW_VERSION_ID = 910n;
    const WORKFLOW_DEFINITION = {
      states: [
        { key: "draft", label: "Draft", status: "DRAFT", isOptional: false },
        { key: "sent", label: "Sent", status: "SENT", isOptional: false },
      ],
      transitions: [
        {
          fromState: "draft",
          action: "send",
          toState: "sent",
          allowedRoles: ["OWNER", "ADMIN"],
          guard: [{ field: "document.status", operator: "eq", value: "READY_TO_SEND" }],
        },
        {
          fromState: "sent",
          action: "accept",
          toState: "accepted",
          allowedRoles: ["OWNER", "ADMIN"],
        },
      ],
    };

    function setupWorkflowContext(
      transaction: MockTransaction,
      overrides: {
        workflowState?: string | null;
        documentStatus?: string;
        role?: RoleCode;
      } = {},
    ) {
      const ctxAccess = overrides.role !== undefined ? { ...access, role: overrides.role } : access;
      const businessAccess = {
        resolve: vi.fn().mockResolvedValue(ctxAccess),
        assertAllowed: vi.fn(),
      } as unknown as BusinessAccessService;
      transaction.document.findFirst.mockResolvedValue({ id: DOCUMENT_ID });
      transaction.documentWorkflowContext.findUnique.mockResolvedValue({
        id: 1200n,
        workflowTemplateVersionId: WORKFLOW_VERSION_ID,
        workflowState: overrides.workflowState ?? "draft",
        configurationTemplateVersionId: VERSION_ID,
        documentType: "QUOTATION",
      });
      transaction.workflowTemplateVersion.findUnique.mockResolvedValue({
        definitionJson: WORKFLOW_DEFINITION,
      });
      transaction.document.findFirstOrThrow.mockResolvedValue({
        status: overrides.documentStatus ?? "READY_TO_SEND",
        type: "QUOTATION",
        purchaseOrderId: null,
        linkedPurchaseOrder: null,
      });
      return businessAccess;
    }

    it("allows a transition when role and guard pass", async () => {
      const transaction = createMockTransaction();
      const businessAccess = setupWorkflowContext(transaction, {
        workflowState: "draft",
        documentStatus: "READY_TO_SEND",
      });
      const service = new ConfigurationService(createDatabase(transaction), businessAccess);

      const result = await service.evaluateTransition({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        action: "send",
      });

      expect(result).toEqual({ allowed: true, toState: "sent" });
    });

    it("denies a transition when the role is not allowed", async () => {
      const transaction = createMockTransaction();
      const businessAccess = setupWorkflowContext(transaction, {
        workflowState: "draft",
        documentStatus: "READY_TO_SEND",
        role: RoleCode.MEMBER,
      });
      const service = new ConfigurationService(createDatabase(transaction), businessAccess);

      const result = await service.evaluateTransition({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        action: "send",
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Role");
      }
    });

    it("denies a transition when the guard fails", async () => {
      const transaction = createMockTransaction();
      const businessAccess = setupWorkflowContext(transaction, {
        workflowState: "draft",
        documentStatus: "DRAFT",
      });
      const service = new ConfigurationService(createDatabase(transaction), businessAccess);

      const result = await service.evaluateTransition({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        action: "send",
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Guard failed");
      }
    });

    it("denies an illegal transition (no matching fromState/action)", async () => {
      const transaction = createMockTransaction();
      const businessAccess = setupWorkflowContext(transaction, {
        workflowState: "sent",
      });
      const service = new ConfigurationService(createDatabase(transaction), businessAccess);

      const result = await service.evaluateTransition({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        action: "send",
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Illegal transition");
      }
    });

    it("denies when no workflow context exists for the document", async () => {
      const transaction = createMockTransaction();
      transaction.document.findFirst.mockResolvedValue({ id: DOCUMENT_ID });
      transaction.documentWorkflowContext.findUnique.mockResolvedValue(null);
      const service = new ConfigurationService(createDatabase(transaction), createBusinessAccess());

      const result = await service.evaluateTransition({
        userPublicId: access.userPublicId,
        businessPublicId: access.businessPublicId,
        documentId: DOCUMENT_PUBLIC_ID,
        action: "send",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("deriveInvoiceConversionRequirements", () => {
    it("treats Default ERP quotation workflow as optional customer PO", () => {
      const requirements = deriveInvoiceConversionRequirements({
        states: [
          { key: "draft-quotation", label: "Draft", status: "DRAFT", isOptional: false },
          { key: "sent-quotation", label: "Sent", status: "SENT", isOptional: false },
          { key: "accepted", label: "Accepted", status: "ACCEPTED", isOptional: false },
          { key: "converted", label: "Converted", status: "CONVERTED", isOptional: false },
          { key: "customer-po", label: "Customer PO", status: "CUSTOMER_PO", isOptional: true },
        ],
        transitions: [
          {
            fromState: "accepted",
            action: "convert",
            toState: "converted",
            allowedRoles: ["OWNER", "ADMIN"],
          },
        ],
      });
      expect(requirements).toEqual({
        customerPoRequired: false,
        approvalEvidenceRequired: false,
      });
    });

    it("treats Service PO quotation workflow as requiring customer PO readiness", () => {
      const requirements = deriveInvoiceConversionRequirements({
        states: [
          {
            key: "ready-to-invoice",
            label: "Ready",
            status: "READY_TO_INVOICE",
            isOptional: false,
          },
          { key: "converted", label: "Converted", status: "CONVERTED", isOptional: false },
        ],
        transitions: [
          {
            fromState: "ready-to-invoice",
            action: "convert",
            toState: "converted",
            allowedRoles: ["OWNER", "ADMIN"],
            guard: [{ field: "workflowState", operator: "eq", value: "READY_TO_INVOICE" }],
          },
        ],
      });
      expect(requirements.customerPoRequired).toBe(true);
      expect(requirements.approvalEvidenceRequired).toBe(true);
    });
  });
});
