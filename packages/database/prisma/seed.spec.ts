import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  configurationSnapshotSchema,
  type ConfigurationSnapshot,
} from "@bizo/contracts/configuration";
import { workflowDefinitionSchema, type WorkflowDefinition } from "@bizo/contracts/workflows";

import type { PrismaClient } from "../generated/client/client.js";

import {
  DEFAULT_ERP_SNAPSHOT,
  DEFAULT_ERP_TEMPLATE_CODE,
  DEFAULT_ERP_VERSION,
  DEFAULT_INVOICE_WORKFLOW_DEFINITION,
  DEFAULT_QUOTATION_WORKFLOW_DEFINITION,
  PROCUREMENT_WORKFLOW_DEFINITION,
} from "./seeds/default-erp.js";
import {
  SERVICE_PO_APPROVAL_TEMPLATE_CODE,
  SERVICE_PO_APPROVAL_VERSION,
  SERVICE_PO_INVOICE_WORKFLOW_DEFINITION,
  SERVICE_PO_APPROVAL_SNAPSHOT,
  SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION,
} from "./seeds/service-po-approval.js";
import {
  IMPLEMENTED_MODULE_CODES,
  MODULE_CATALOG,
  PLANNED_MODULE_CODES,
} from "./seeds/module-catalog.js";
import type { SeedClient } from "./seeds/shared.js";
import { runAllSeeds } from "./seeds/index.js";

describe("seed module catalog", () => {
  it("marks exactly the implemented modules as implemented", () => {
    const implemented = MODULE_CATALOG.filter((m) => m.implemented).map((m) => m.code);
    expect(implemented).toEqual([
      "customers",
      "quotations",
      "purchase-orders",
      "invoices",
      "payments",
    ]);
  });

  it("marks all planned modules as not implemented", () => {
    const planned = MODULE_CATALOG.filter((m) => !m.implemented).map((m) => m.code);
    expect(planned).toEqual([
      "sales-orders",
      "delivery-service",
      "credit-notes",
      "inventory",
      "projects",
      "supplier-purchases",
      "supplier-bills",
      "supplier-payments",
      "supplier-rfq",
    ]);
  });

  it("has unique module codes", () => {
    const codes = MODULE_CATALOG.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("exports the implemented and planned code lists consistently", () => {
    expect(IMPLEMENTED_MODULE_CODES).toEqual(
      MODULE_CATALOG.filter((m) => m.implemented).map((m) => m.code),
    );
    expect(PLANNED_MODULE_CODES).toEqual(
      MODULE_CATALOG.filter((m) => !m.implemented).map((m) => m.code),
    );
  });
});

describe("default-erp snapshot", () => {
  it("validates against the configuration snapshot Zod schema", () => {
    const parsed = configurationSnapshotSchema.safeParse(DEFAULT_ERP_SNAPSHOT);
    expect(parsed.success).toBe(true);
  });

  it("enables only implemented modules and includes all planned modules disabled", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    const enabled = snapshot.modules.filter((m) => m.enabled).map((m) => m.code);
    expect(enabled).toEqual([...IMPLEMENTED_MODULE_CODES]);
    const disabled = snapshot.modules.filter((m) => !m.enabled).map((m) => m.code);
    expect(disabled).toEqual([...PLANNED_MODULE_CODES]);
  });

  it("references the quotation, invoice, and procurement workflow templates", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    const codes = snapshot.workflows.map((w) => w.workflowTemplateCode);
    expect(codes).toContain("default-quotation-workflow");
    expect(codes).toContain("default-invoice-workflow");
    expect(codes).toContain("default-procurement-workflow");
  });

  it("keys workflow refs to the real DocumentType enum values", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    const documentTypes = snapshot.workflows.map((w) => w.documentType);
    expect(documentTypes).toContain("QUOTATION");
    expect(documentTypes).toContain("INVOICE");
    expect(documentTypes).toContain("PURCHASE_ORDER");
  });

  it("uses safe tax defaults (disabled, zero rate)", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    expect(snapshot.tax.enabled).toBe(false);
    expect(snapshot.tax.ratePercent).toBe("0");
  });

  it("uses a neutral placeholder currency that businesses override at assignment time", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    expect(snapshot.currency.currencyCode).toMatch(/^[A-Z]{3}$/);
    expect(snapshot.currency.currencyScale).toBeGreaterThanOrEqual(0);
    expect(snapshot.currency.currencyScale).toBeLessThanOrEqual(4);
  });

  it("uses QUO- and INV- numbering prefixes", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    expect(snapshot.numbering.quotationPrefix).toBe("QUO-");
    expect(snapshot.numbering.invoicePrefix).toBe("INV-");
  });

  it("defines standard role defaults for OWNER, ADMIN, MEMBER", () => {
    const snapshot = DEFAULT_ERP_SNAPSHOT as ConfigurationSnapshot;
    const roles = snapshot.roleDefaults.map((r) => r.roleCode);
    expect(roles).toEqual(["OWNER", "ADMIN", "MEMBER"]);
  });

  it("publishes version 1.0.0 under the default-erp template code", () => {
    expect(DEFAULT_ERP_TEMPLATE_CODE).toBe("default-erp");
    expect(DEFAULT_ERP_VERSION).toBe("1.0.0");
  });
});

describe("default-erp workflow definitions", () => {
  it("validates the quotation workflow against the workflow definition Zod schema", () => {
    const parsed = workflowDefinitionSchema.safeParse(DEFAULT_QUOTATION_WORKFLOW_DEFINITION);
    expect(parsed.success).toBe(true);
  });

  it("validates the invoice workflow against the workflow definition Zod schema", () => {
    const parsed = workflowDefinitionSchema.safeParse(DEFAULT_INVOICE_WORKFLOW_DEFINITION);
    expect(parsed.success).toBe(true);
  });

  it("validates the procurement workflow against the workflow definition Zod schema", () => {
    const parsed = workflowDefinitionSchema.safeParse(PROCUREMENT_WORKFLOW_DEFINITION);
    expect(parsed.success).toBe(true);
  });

  it("marks the optional customer-po state as optional in the quotation workflow", () => {
    const def = DEFAULT_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const optionalStates = def.states.filter((s) => s.isOptional).map((s) => s.key);
    expect(optionalStates).toEqual(["customer-po"]);
    const activeStates = def.states.filter((s) => !s.isOptional).map((s) => s.key);
    expect(activeStates).toEqual(
      expect.arrayContaining(["draft-quotation", "sent-quotation", "accepted", "converted"]),
    );
  });

  it("keeps all invoice workflow states on the active path", () => {
    const def = DEFAULT_INVOICE_WORKFLOW_DEFINITION as WorkflowDefinition;
    expect(def.states.every((s) => !s.isOptional)).toBe(true);
    const stateKeys = def.states.map((s) => s.key);
    expect(stateKeys).toEqual(["draft-invoice", "sent-invoice", "paid"]);
  });

  it("marks all procurement states as optional (modules not implemented)", () => {
    const def = PROCUREMENT_WORKFLOW_DEFINITION as WorkflowDefinition;
    expect(def.states.every((s) => s.isOptional)).toBe(true);
  });

  it("guards the quotation send transition on document status READY_TO_SEND", () => {
    const def = DEFAULT_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const send = def.transitions.find((t) => t.action === "send");
    expect(send).toBeDefined();
    expect(send?.guard?.[0]).toMatchObject({
      field: "document.status",
      operator: "eq",
      value: "READY_TO_SEND",
    });
  });

  it("guards the invoice send transition on document status READY_TO_SEND", () => {
    const def = DEFAULT_INVOICE_WORKFLOW_DEFINITION as WorkflowDefinition;
    const send = def.transitions.find((t) => t.action === "send");
    expect(send).toBeDefined();
    expect(send?.guard?.[0]).toMatchObject({
      field: "document.status",
      operator: "eq",
      value: "READY_TO_SEND",
    });
  });
});

describe("service-po-approval snapshot", () => {
  it("validates against the configuration snapshot Zod schema", () => {
    const parsed = configurationSnapshotSchema.safeParse(SERVICE_PO_APPROVAL_SNAPSHOT);
    expect(parsed.success).toBe(true);
  });

  it("enables the purchase-orders module (customer PO intake is implemented)", () => {
    const snapshot = SERVICE_PO_APPROVAL_SNAPSHOT as ConfigurationSnapshot;
    const po = snapshot.modules.find((m) => m.code === "purchase-orders");
    expect(po?.enabled).toBe(true);
  });

  it("references the service-po-approval quotation and invoice workflows", () => {
    const snapshot = SERVICE_PO_APPROVAL_SNAPSHOT as ConfigurationSnapshot;
    const codes = snapshot.workflows.map((w) => w.workflowTemplateCode);
    expect(codes).toContain("service-po-quotation-workflow");
    expect(codes).toContain("service-po-invoice-workflow");
  });

  it("keys workflow refs to the real DocumentType enum values", () => {
    const snapshot = SERVICE_PO_APPROVAL_SNAPSHOT as ConfigurationSnapshot;
    const documentTypes = snapshot.workflows.map((w) => w.documentType);
    expect(documentTypes).toContain("QUOTATION");
    expect(documentTypes).toContain("INVOICE");
  });

  it("publishes version 1.0.0 under the service-po-approval template code", () => {
    expect(SERVICE_PO_APPROVAL_TEMPLATE_CODE).toBe("service-po-approval");
    expect(SERVICE_PO_APPROVAL_VERSION).toBe("1.0.0");
  });
});

describe("service-po-approval quotation workflow", () => {
  it("validates against the workflow definition Zod schema", () => {
    const parsed = workflowDefinitionSchema.safeParse(SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION);
    expect(parsed.success).toBe(true);
  });

  it("encodes the customer-PO-required readiness rule", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const linkPo = def.transitions.find((t) => t.action === "link-customer-po");
    expect(linkPo).toBeDefined();
    expect(linkPo?.guard?.[0]).toMatchObject({
      field: "purchaseOrder",
      operator: "exists",
    });
  });

  it("encodes the approval-evidence-required readiness rule", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const recordApproval = def.transitions.find((t) => t.action === "record-approval-evidence");
    expect(recordApproval).toBeDefined();
    expect(recordApproval?.guard?.[0]).toMatchObject({
      field: "approvalEvidence",
      operator: "exists",
    });
  });

  it("requires the purchase order approval status to be APPROVED before ready-to-invoice", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const markReady = def.transitions.find((t) => t.action === "mark-ready-to-invoice");
    expect(markReady).toBeDefined();
    expect(markReady?.guard?.[0]).toMatchObject({
      field: "purchaseOrder.approvalStatus",
      operator: "eq",
      value: "APPROVED",
    });
  });

  it("guards conversion on the READY_TO_INVOICE workflow state", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const convert = def.transitions.find((t) => t.action === "convert");
    expect(convert).toBeDefined();
    expect(convert?.guard?.[0]).toMatchObject({
      field: "workflowState",
      operator: "eq",
      value: "READY_TO_INVOICE",
    });
  });

  it("has the ready-to-invoice state on the active path", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    const readyState = def.states.find((s) => s.key === "ready-to-invoice");
    expect(readyState).toBeDefined();
    expect(readyState?.isOptional).toBe(false);
  });

  it("keeps all quotation states on the active path (customer PO + approval evidence required)", () => {
    const def = SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION as WorkflowDefinition;
    expect(def.states.every((s) => !s.isOptional)).toBe(true);
  });
});

describe("service-po-approval invoice workflow", () => {
  it("validates against the workflow definition Zod schema", () => {
    const parsed = workflowDefinitionSchema.safeParse(SERVICE_PO_INVOICE_WORKFLOW_DEFINITION);
    expect(parsed.success).toBe(true);
  });

  it("guards the send transition on origin from a READY_TO_INVOICE quotation", () => {
    const def = SERVICE_PO_INVOICE_WORKFLOW_DEFINITION as WorkflowDefinition;
    const send = def.transitions.find((t) => t.action === "send");
    expect(send).toBeDefined();
    const originGuard = send?.guard?.find(
      (g) => g.field === "sourceQuotation.workflowState" && g.operator === "eq",
    );
    expect(originGuard).toBeDefined();
    expect(originGuard?.value).toBe("READY_TO_INVOICE");
  });

  it("keeps all invoice states on the active path", () => {
    const def = SERVICE_PO_INVOICE_WORKFLOW_DEFINITION as WorkflowDefinition;
    expect(def.states.every((s) => !s.isOptional)).toBe(true);
    const stateKeys = def.states.map((s) => s.key);
    expect(stateKeys).toEqual(["draft-invoice", "sent-invoice", "paid"]);
  });
});

// In-memory mock that simulates the subset of Prisma operations the seeds use.
// Validates idempotency logic without requiring a live database.
interface MockRow {
  id: bigint;
  [key: string]: unknown;
}

function createSeedClientMock(): SeedClient {
  let nextId = 1n;
  const takeId = () => nextId++;

  const moduleDefinitions = new Map<string, MockRow>();
  const configurationTemplates = new Map<string, MockRow>();
  const workflowTemplates = new Map<string, MockRow>();
  const configurationTemplateVersions = new Map<string, MockRow>();
  const workflowTemplateVersions = new Map<string, MockRow>();

  const upsertByCode =
    (store: Map<string, MockRow>) =>
    (args: {
      where: { code: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      const existing = store.get(args.where.code);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: MockRow = { id: takeId(), ...args.create };
      store.set(args.where.code, row);
      return row;
    };

  return {
    moduleDefinition: {
      upsert: upsertByCode(moduleDefinitions) as never,
    },
    configurationTemplate: {
      upsert: upsertByCode(configurationTemplates) as never,
    },
    workflowTemplate: {
      upsert: upsertByCode(workflowTemplates) as never,
    },
    configurationTemplateVersion: {
      findUnique: ((args: {
        where: { templateId_version: { templateId: bigint; version: string } };
      }) => {
        const key = `${args.where.templateId_version.templateId}:${args.where.templateId_version.version}`;
        return configurationTemplateVersions.get(key) ?? null;
      }) as never,
      create: ((args: { data: Record<string, unknown> }) => {
        const row: MockRow = { id: takeId(), ...args.data };
        const key = `${row.templateId}:${row.version}`;
        configurationTemplateVersions.set(key, row);
        return row;
      }) as never,
      update: ((args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        for (const row of configurationTemplateVersions.values()) {
          if (row.id === args.where.id) {
            Object.assign(row, args.data);
            return row;
          }
        }
        throw new Error(`configurationTemplateVersion.update: id ${args.where.id} not found`);
      }) as never,
    },
    workflowTemplateVersion: {
      findUnique: ((args: {
        where: { workflowTemplateId_version: { workflowTemplateId: bigint; version: string } };
      }) => {
        const key = `${args.where.workflowTemplateId_version.workflowTemplateId}:${args.where.workflowTemplateId_version.version}`;
        return workflowTemplateVersions.get(key) ?? null;
      }) as never,
      create: ((args: { data: Record<string, unknown> }) => {
        const row: MockRow = { id: takeId(), ...args.data };
        const key = `${row.workflowTemplateId}:${row.version}`;
        workflowTemplateVersions.set(key, row);
        return row;
      }) as never,
      update: ((args: { where: { id: bigint }; data: Record<string, unknown> }) => {
        for (const row of workflowTemplateVersions.values()) {
          if (row.id === args.where.id) {
            Object.assign(row, args.data);
            return row;
          }
        }
        throw new Error(`workflowTemplateVersion.update: id ${args.where.id} not found`);
      }) as never,
    },
  } as unknown as SeedClient;
}

describe("seed idempotency (in-memory mock)", () => {
  it("runs all seeds twice without creating duplicates and skips published versions", async () => {
    const mock = createSeedClientMock();

    const first = await runAllSeeds(mock);
    expect(first.modules).toBe(MODULE_CATALOG.length);
    expect(first.configurationTemplates).toBe(2);
    expect(first.configurationTemplateVersions).toBe(2);
    expect(first.workflowTemplates).toBe(5);
    expect(first.workflowTemplateVersions).toBe(5);
    expect(first.skippedPublished).toEqual([]);

    const second = await runAllSeeds(mock);
    // Counts reflect upsert attempts, not new rows. The mock upserts update existing rows.
    expect(second.modules).toBe(MODULE_CATALOG.length);
    expect(second.configurationTemplates).toBe(2);
    expect(second.configurationTemplateVersions).toBe(2);
    expect(second.workflowTemplates).toBe(5);
    expect(second.workflowTemplateVersions).toBe(5);
    // On the second run, all PUBLISHED versions already exist and must be skipped.
    expect(second.skippedPublished).toHaveLength(7);
  });
});

const databaseEnabled = process.env.RUN_DATABASE_TESTS === "true" && !!process.env.DATABASE_URL;

describe.runIf(databaseEnabled)("seed idempotency (postgres)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { PrismaClient } = await import("../generated/client/client.js");
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      max: 10,
    });
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it("runs all seeds twice without creating duplicate rows", async () => {
    await runAllSeeds(prisma);
    const afterFirst = {
      modules: await prisma.moduleDefinition.count(),
      templates: await prisma.configurationTemplate.count(),
      templateVersions: await prisma.configurationTemplateVersion.count(),
      workflowTemplates: await prisma.workflowTemplate.count(),
      workflowVersions: await prisma.workflowTemplateVersion.count(),
    };

    await runAllSeeds(prisma);
    const afterSecond = {
      modules: await prisma.moduleDefinition.count(),
      templates: await prisma.configurationTemplate.count(),
      templateVersions: await prisma.configurationTemplateVersion.count(),
      workflowTemplates: await prisma.workflowTemplate.count(),
      workflowVersions: await prisma.workflowTemplateVersion.count(),
    };

    expect(afterSecond).toEqual(afterFirst);
    expect(afterFirst.modules).toBe(MODULE_CATALOG.length);
    expect(afterFirst.templates).toBe(2);
    expect(afterFirst.templateVersions).toBe(2);
    expect(afterFirst.workflowTemplates).toBe(5);
    expect(afterFirst.workflowVersions).toBe(5);
  });

  it("does not overwrite a published configuration version's snapshotJson on re-run", async () => {
    const before = await prisma.configurationTemplateVersion.findFirst({
      where: { template: { code: DEFAULT_ERP_TEMPLATE_CODE }, version: DEFAULT_ERP_VERSION },
      select: { id: true, snapshotJson: true, publishedAt: true },
    });
    expect(before).not.toBeNull();

    await runAllSeeds(prisma);

    const after = await prisma.configurationTemplateVersion.findFirst({
      where: { template: { code: DEFAULT_ERP_TEMPLATE_CODE }, version: DEFAULT_ERP_VERSION },
      select: { id: true, snapshotJson: true, publishedAt: true },
    });
    expect(after).not.toBeNull();
    expect(after?.id).toBe(before?.id);
    expect(after?.snapshotJson).toEqual(before?.snapshotJson);
    expect(after?.publishedAt?.toISOString()).toBe(before?.publishedAt?.toISOString());
  });

  it("does not overwrite a published workflow version's definitionJson on re-run", async () => {
    const before = await prisma.workflowTemplateVersion.findFirst({
      where: {
        workflowTemplate: { code: "default-quotation-workflow" },
        version: "1.0.0",
      },
      select: { id: true, definitionJson: true, publishedAt: true },
    });
    expect(before).not.toBeNull();

    await runAllSeeds(prisma);

    const after = await prisma.workflowTemplateVersion.findFirst({
      where: {
        workflowTemplate: { code: "default-quotation-workflow" },
        version: "1.0.0",
      },
      select: { id: true, definitionJson: true, publishedAt: true },
    });
    expect(after).not.toBeNull();
    expect(after?.id).toBe(before?.id);
    expect(after?.definitionJson).toEqual(before?.definitionJson);
    expect(after?.publishedAt?.toISOString()).toBe(before?.publishedAt?.toISOString());
  });
});
