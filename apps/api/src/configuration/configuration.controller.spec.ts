import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ConfigurationController } from "./configuration.controller.js";
import type {
  ActiveAssignmentSummary,
  DocumentWorkflowContextSummary,
  EnabledModuleSummary,
  ConfigurationService,
} from "./configuration.service.js";

const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const DOCUMENT_PUBLIC_ID = "d0000000-0000-4000-8000-000000000001";

const assignment: ActiveAssignmentSummary = {
  id: "a0000000-0000-4000-8000-000000000001",
  businessId: BUSINESS_PUBLIC_ID,
  configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
  templateCode: "default-erp",
  templateVersion: "1.0.0",
  isPrimary: true,
  assignedByMembershipId: null,
  reason: "onboarding",
  assignedAt: "2026-07-28T00:00:00.000Z",
  snapshot: {
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
};

const enabledModules: EnabledModuleSummary[] = [
  {
    code: "customers",
    name: "Customers",
    description: "Customer directory.",
    implemented: true,
    status: "ACTIVE",
  },
];

const invoiceConversion = {
  customerPoRequired: false,
  approvalEvidenceRequired: false,
  templateCode: "default-erp",
  templateVersion: "1.0.0",
};

function createServiceMock(overrides: Partial<ConfigurationService> = {}): ConfigurationService {
  const mock = {
    getActiveAssignment: vi.fn().mockResolvedValue(assignment),
    getEnabledModules: vi.fn().mockResolvedValue(enabledModules),
    getInvoiceConversionPolicy: vi.fn().mockResolvedValue(invoiceConversion),
    getDocumentWorkflowContextSummary: vi.fn().mockResolvedValue(null),
    listAvailableTransitions: vi.fn().mockResolvedValue([]),
  };
  return { ...mock, ...overrides } as unknown as ConfigurationService;
}

describe("ConfigurationController", () => {
  it("returns the active assignment and enabled modules for GET /configuration", async () => {
    const service = createServiceMock();
    const controller = new ConfigurationController(service);

    const result = await controller.getConfiguration(
      { userId: USER_PUBLIC_ID },
      BUSINESS_PUBLIC_ID,
    );

    expect(result).toEqual({ assignment, enabledModules, invoiceConversion });
    expect(service.getActiveAssignment).toHaveBeenCalledWith(USER_PUBLIC_ID, BUSINESS_PUBLIC_ID);
    expect(service.getEnabledModules).toHaveBeenCalledWith(USER_PUBLIC_ID, BUSINESS_PUBLIC_ID);
    expect(service.getInvoiceConversionPolicy).toHaveBeenCalledWith(
      USER_PUBLIC_ID,
      BUSINESS_PUBLIC_ID,
    );
  });

  it("returns enabled modules for GET /modules", async () => {
    const service = createServiceMock();
    const controller = new ConfigurationController(service);

    const result = await controller.getModules({ userId: USER_PUBLIC_ID }, BUSINESS_PUBLIC_ID);

    expect(result).toEqual(enabledModules);
  });

  it("returns the workflow context and available transitions for GET /documents/:documentId/workflow", async () => {
    const contextSummary: DocumentWorkflowContextSummary = {
      id: "w0000000-0000-4000-8000-000000000001",
      documentId: DOCUMENT_PUBLIC_ID,
      documentType: "QUOTATION",
      configurationTemplateVersionId: "v0000000-0000-4000-8000-000000000001",
      workflowTemplateVersionId: "wv000000-0000-4000-8000-000000000001",
      workflowState: "draft",
      capturedSnapshot: {},
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    };
    const service = createServiceMock({
      getDocumentWorkflowContextSummary: vi.fn().mockResolvedValue(contextSummary),
      listAvailableTransitions: vi.fn().mockResolvedValue([
        {
          action: "send",
          toState: "sent",
          allowedRoles: ["OWNER", "ADMIN"],
          evaluation: { allowed: true, toState: "sent" },
        },
      ]),
    });
    const controller = new ConfigurationController(service);

    const result = await controller.getWorkflow(
      { userId: USER_PUBLIC_ID },
      BUSINESS_PUBLIC_ID,
      DOCUMENT_PUBLIC_ID,
    );

    expect(result.context).toEqual(contextSummary);
    expect(result.availableTransitions).toHaveLength(1);
    expect(result.availableTransitions[0]?.evaluation.allowed).toBe(true);
    expect(service.listAvailableTransitions).toHaveBeenCalledWith({
      userPublicId: USER_PUBLIC_ID,
      businessPublicId: BUSINESS_PUBLIC_ID,
      documentId: DOCUMENT_PUBLIC_ID,
    });
  });

  it("returns empty transitions when no workflow context exists", async () => {
    const service = createServiceMock({
      getDocumentWorkflowContextSummary: vi.fn().mockResolvedValue(null),
      listAvailableTransitions: vi.fn(),
    });
    const controller = new ConfigurationController(service);

    const result = await controller.getWorkflow(
      { userId: USER_PUBLIC_ID },
      BUSINESS_PUBLIC_ID,
      DOCUMENT_PUBLIC_ID,
    );

    expect(result.context).toBeNull();
    expect(result.availableTransitions).toEqual([]);
    expect(service.listAvailableTransitions).not.toHaveBeenCalled();
  });

  it("propagates NotFound when the service rejects cross-tenant access", async () => {
    const service = createServiceMock({
      getActiveAssignment: vi
        .fn()
        .mockRejectedValue(new NotFoundException("We could not find that business.")),
      getEnabledModules: vi.fn().mockResolvedValue(enabledModules),
      getInvoiceConversionPolicy: vi.fn().mockResolvedValue(invoiceConversion),
    });
    const controller = new ConfigurationController(service);

    await expect(
      controller.getConfiguration({ userId: USER_PUBLIC_ID }, "other-business"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
