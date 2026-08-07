// Phase 5 — Default bizOS ERP v1 seed.
//
// ConfigurationTemplate code `default-erp`, kind DEFAULT. Version 1.0.0 PUBLISHED.
// Three WorkflowTemplates:
//   - default-quotation-workflow v1.0.0 (documentType QUOTATION)
//   - default-invoice-workflow v1.0.0 (documentType INVOICE)
//   - default-procurement-workflow v1.0.0 (documentType PURCHASE_ORDER, informational)
//
// Only implemented modules (customers, quotations, purchase-orders, invoices) are
// enabled in the snapshot. Planned modules are seeded but enabled=false so they are
// present for future configuration without surfacing in nav. Customer PO and approval
// evidence are OPTIONAL in this configuration — the Service PO & Approval configuration
// is the one that mandates them (see service-po-approval.ts).
//
// The documentType values align with the Prisma DocumentType enum (QUOTATION | INVOICE)
// so ConfigurationService.createDocumentWorkflowContext can match snapshot.workflows[]
// against document.type. The procurement workflow is keyed to PURCHASE_ORDER and is
// informational only — purchase orders live in a separate table and never flow through
// DocumentWorkflowContext.

import {
  configurationSnapshotSchema,
  type ConfigurationSnapshot,
} from "@bizo/contracts/configuration";
import { workflowDefinitionSchema, type WorkflowDefinition } from "@bizo/contracts/workflows";

import type { SeedClient, SeedResult } from "./shared.js";
import {
  emptySeedResult,
  upsertPublishedConfigurationVersion,
  upsertPublishedWorkflowVersion,
} from "./shared.js";
import { IMPLEMENTED_MODULE_CODES, PLANNED_MODULE_CODES } from "./module-catalog.js";

export const DEFAULT_ERP_TEMPLATE_CODE = "default-erp";
export const DEFAULT_ERP_VERSION = "1.0.0";

export const DEFAULT_QUOTATION_WORKFLOW_CODE = "default-quotation-workflow";
export const DEFAULT_QUOTATION_WORKFLOW_VERSION = "1.0.0";

export const DEFAULT_INVOICE_WORKFLOW_CODE = "default-invoice-workflow";
export const DEFAULT_INVOICE_WORKFLOW_VERSION = "1.0.0";

export const PROCUREMENT_WORKFLOW_CODE = "default-procurement-workflow";
export const PROCUREMENT_WORKFLOW_VERSION = "1.0.0";

const QUOTATION_DOCUMENT_TYPE = "QUOTATION";
const INVOICE_DOCUMENT_TYPE = "INVOICE";
const PURCHASE_ORDER_DOCUMENT_TYPE = "PURCHASE_ORDER";

// Snapshot: modules, workflows, roleDefaults, tax, currency, numbering, documentTemplates, terminology.
// `currency` is a template default (USD/scale 2) that businesses override at assignment time
// from Business.baseCurrency/currencyScale. The schema requires currency in the snapshot.
function buildDefaultErpModules(): ConfigurationSnapshot["modules"] {
  const enabled = IMPLEMENTED_MODULE_CODES.map((code) => ({ code, enabled: true }));
  const disabled = PLANNED_MODULE_CODES.map((code) => ({ code, enabled: false }));
  return [...enabled, ...disabled];
}

export const DEFAULT_ERP_SNAPSHOT: ConfigurationSnapshot = configurationSnapshotSchema.parse({
  modules: buildDefaultErpModules(),
  workflows: [
    {
      documentType: QUOTATION_DOCUMENT_TYPE,
      workflowTemplateCode: DEFAULT_QUOTATION_WORKFLOW_CODE,
      version: DEFAULT_QUOTATION_WORKFLOW_VERSION,
    },
    {
      documentType: INVOICE_DOCUMENT_TYPE,
      workflowTemplateCode: DEFAULT_INVOICE_WORKFLOW_CODE,
      version: DEFAULT_INVOICE_WORKFLOW_VERSION,
    },
    {
      documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
      workflowTemplateCode: PROCUREMENT_WORKFLOW_CODE,
      version: PROCUREMENT_WORKFLOW_VERSION,
    },
  ],
  roleDefaults: [
    {
      roleCode: "OWNER",
      permissions: [
        "customers:read",
        "customers:write",
        "quotations:read",
        "quotations:write",
        "quotations:send",
        "quotations:accept",
        "purchase-orders:read",
        "purchase-orders:write",
        "purchase-orders:approve",
        "invoices:read",
        "invoices:write",
        "invoices:send",
        "payments:read",
        "payments:create",
        "payments:void",
        "configuration:read",
      ],
    },
    {
      roleCode: "ADMIN",
      permissions: [
        "customers:read",
        "customers:write",
        "quotations:read",
        "quotations:write",
        "quotations:send",
        "quotations:accept",
        "purchase-orders:read",
        "purchase-orders:write",
        "purchase-orders:approve",
        "invoices:read",
        "invoices:write",
        "invoices:send",
        "payments:read",
        "payments:create",
        "payments:void",
        "configuration:read",
      ],
    },
    {
      roleCode: "MEMBER",
      permissions: [
        "customers:read",
        "quotations:read",
        "quotations:write",
        "purchase-orders:read",
        "invoices:read",
        "payments:read",
        "payments:create",
        "configuration:read",
      ],
    },
  ],
  tax: { enabled: false, name: "Tax", ratePercent: "0", priceIncludesTax: false },
  currency: { currencyCode: "USD", currencyScale: 2 },
  numbering: {
    quotationPrefix: "QUO-",
    invoicePrefix: "INV-",
    quotationValidityDays: 30,
    invoiceDueDays: 30,
  },
  documentTemplates: [
    { documentType: "QUOTATION", templateName: "professional-v1" },
    { documentType: "INVOICE", templateName: "professional-v1" },
    { documentType: "PURCHASE_ORDER", templateName: "professional-v1" },
  ],
  terminology: {
    customerLabel: "Customer",
    quotationLabel: "Quotation",
    invoiceLabel: "Invoice",
  },
});

// Default quotation workflow: Draft Quotation -> Sent -> Accepted -> Converted.
// Customer PO is OPTIONAL in this configuration: it can be linked as a side state but
// is not required for conversion. Only states backed by implemented modules are on the
// active path; the optional customer-po state lets businesses capture a customer PO
// when one exists without blocking the core lifecycle.
export const DEFAULT_QUOTATION_WORKFLOW_DEFINITION: WorkflowDefinition =
  workflowDefinitionSchema.parse({
    states: [
      { key: "draft-quotation", label: "Draft Quotation", status: "DRAFT", isOptional: false },
      { key: "sent-quotation", label: "Sent Quotation", status: "SENT", isOptional: false },
      { key: "accepted", label: "Accepted", status: "ACCEPTED", isOptional: false },
      { key: "converted", label: "Converted", status: "CONVERTED", isOptional: false },
      { key: "customer-po", label: "Customer PO", status: "CUSTOMER_PO", isOptional: true },
    ],
    transitions: [
      {
        fromState: "draft-quotation",
        action: "send",
        toState: "sent-quotation",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "document.status", operator: "eq", value: "READY_TO_SEND" }],
      },
      {
        fromState: "sent-quotation",
        action: "accept",
        toState: "accepted",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        fromState: "accepted",
        action: "link-customer-po",
        toState: "customer-po",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        fromState: "accepted",
        action: "convert",
        toState: "converted",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        fromState: "customer-po",
        action: "convert",
        toState: "converted",
        allowedRoles: ["OWNER", "ADMIN"],
      },
    ],
  });

// Default invoice workflow: Draft Invoice -> Sent -> Paid. An invoice can originate from
// a converted quotation (via Document.sourceQuotationId) or be created directly. Payment
// is not yet implemented, so the paid state is on the active path but the record-payment
// transition is the terminal step in this version.
export const DEFAULT_INVOICE_WORKFLOW_DEFINITION: WorkflowDefinition =
  workflowDefinitionSchema.parse({
    states: [
      { key: "draft-invoice", label: "Draft Invoice", status: "DRAFT", isOptional: false },
      { key: "sent-invoice", label: "Sent Invoice", status: "SENT", isOptional: false },
      { key: "paid", label: "Paid", status: "PAID", isOptional: false },
    ],
    transitions: [
      {
        fromState: "draft-invoice",
        action: "send",
        toState: "sent-invoice",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "document.status", operator: "eq", value: "READY_TO_SEND" }],
      },
      {
        fromState: "sent-invoice",
        action: "record-payment",
        toState: "paid",
        allowedRoles: ["OWNER", "ADMIN"],
      },
    ],
  });

// Procurement workflow: Supplier -> Purchase Request -> Supplier RFQ -> Supplier Quotation
// -> Supplier Purchase Order -> Goods/Service Receipt -> Supplier Bill -> Supplier Payment.
// All procurement modules are not yet implemented, so every state is isOptional=true.
// The workflow is published as a reference template for future implementation and is keyed
// to PURCHASE_ORDER (purchase orders live in a separate table, not the documents table).
export const PROCUREMENT_WORKFLOW_DEFINITION: WorkflowDefinition = workflowDefinitionSchema.parse({
  states: [
    { key: "supplier", label: "Supplier", status: "SUPPLIER", isOptional: true },
    {
      key: "purchase-request",
      label: "Purchase Request",
      status: "PURCHASE_REQUEST",
      isOptional: true,
    },
    { key: "supplier-rfq", label: "Supplier RFQ", status: "SUPPLIER_RFQ", isOptional: true },
    {
      key: "supplier-quotation",
      label: "Supplier Quotation",
      status: "SUPPLIER_QUOTATION",
      isOptional: true,
    },
    {
      key: "supplier-po",
      label: "Supplier Purchase Order",
      status: "SUPPLIER_PO",
      isOptional: true,
    },
    {
      key: "goods-receipt",
      label: "Goods / Service Receipt",
      status: "GOODS_RECEIPT",
      isOptional: true,
    },
    { key: "supplier-bill", label: "Supplier Bill", status: "SUPPLIER_BILL", isOptional: true },
    {
      key: "supplier-payment",
      label: "Supplier Payment",
      status: "SUPPLIER_PAYMENT",
      isOptional: true,
    },
  ],
  transitions: [
    {
      fromState: "supplier",
      action: "create-purchase-request",
      toState: "purchase-request",
      allowedRoles: ["OWNER", "ADMIN"],
    },
    {
      fromState: "purchase-request",
      action: "issue-rfq",
      toState: "supplier-rfq",
      allowedRoles: ["OWNER", "ADMIN"],
    },
    {
      fromState: "supplier-rfq",
      action: "receive-quotation",
      toState: "supplier-quotation",
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    },
    {
      fromState: "supplier-quotation",
      action: "place-po",
      toState: "supplier-po",
      allowedRoles: ["OWNER", "ADMIN"],
    },
    {
      fromState: "supplier-po",
      action: "record-receipt",
      toState: "goods-receipt",
      allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
    },
    {
      fromState: "goods-receipt",
      action: "record-bill",
      toState: "supplier-bill",
      allowedRoles: ["OWNER", "ADMIN"],
    },
    {
      fromState: "supplier-bill",
      action: "pay-bill",
      toState: "supplier-payment",
      allowedRoles: ["OWNER", "ADMIN"],
    },
  ],
});

export async function seedDefaultErp(prisma: SeedClient): Promise<SeedResult> {
  const result = emptySeedResult();

  const template = await prisma.configurationTemplate.upsert({
    where: { code: DEFAULT_ERP_TEMPLATE_CODE },
    update: {
      name: "Default bizOS ERP",
      description:
        "Baseline ERP configuration for new businesses. Customer PO and approval evidence are optional.",
      kind: "DEFAULT",
    },
    create: {
      code: DEFAULT_ERP_TEMPLATE_CODE,
      name: "Default bizOS ERP",
      description:
        "Baseline ERP configuration for new businesses. Customer PO and approval evidence are optional.",
      kind: "DEFAULT",
    },
  });
  result.configurationTemplates += 1;

  const quotationWorkflowTemplate = await prisma.workflowTemplate.upsert({
    where: { code: DEFAULT_QUOTATION_WORKFLOW_CODE },
    update: {
      name: "Default quotation workflow",
      description: "Quotation lifecycle from draft to conversion. Customer PO is optional.",
      documentType: QUOTATION_DOCUMENT_TYPE,
    },
    create: {
      code: DEFAULT_QUOTATION_WORKFLOW_CODE,
      name: "Default quotation workflow",
      description: "Quotation lifecycle from draft to conversion. Customer PO is optional.",
      documentType: QUOTATION_DOCUMENT_TYPE,
    },
  });
  result.workflowTemplates += 1;

  const invoiceWorkflowTemplate = await prisma.workflowTemplate.upsert({
    where: { code: DEFAULT_INVOICE_WORKFLOW_CODE },
    update: {
      name: "Default invoice workflow",
      description: "Invoice lifecycle from draft to payment.",
      documentType: INVOICE_DOCUMENT_TYPE,
    },
    create: {
      code: DEFAULT_INVOICE_WORKFLOW_CODE,
      name: "Default invoice workflow",
      description: "Invoice lifecycle from draft to payment.",
      documentType: INVOICE_DOCUMENT_TYPE,
    },
  });
  result.workflowTemplates += 1;

  const procurementWorkflowTemplate = await prisma.workflowTemplate.upsert({
    where: { code: PROCUREMENT_WORKFLOW_CODE },
    update: {
      name: "Procurement workflow",
      description: "Procurement lifecycle from supplier to payment. Reference template.",
      documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
    },
    create: {
      code: PROCUREMENT_WORKFLOW_CODE,
      name: "Procurement workflow",
      description: "Procurement lifecycle from supplier to payment. Reference template.",
      documentType: PURCHASE_ORDER_DOCUMENT_TYPE,
    },
  });
  result.workflowTemplates += 1;

  await upsertPublishedWorkflowVersion(prisma, {
    workflowTemplateId: quotationWorkflowTemplate.id,
    version: DEFAULT_QUOTATION_WORKFLOW_VERSION,
    definition: DEFAULT_QUOTATION_WORKFLOW_DEFINITION,
    skipped: result.skippedPublished,
  });
  result.workflowTemplateVersions += 1;

  await upsertPublishedWorkflowVersion(prisma, {
    workflowTemplateId: invoiceWorkflowTemplate.id,
    version: DEFAULT_INVOICE_WORKFLOW_VERSION,
    definition: DEFAULT_INVOICE_WORKFLOW_DEFINITION,
    skipped: result.skippedPublished,
  });
  result.workflowTemplateVersions += 1;

  await upsertPublishedWorkflowVersion(prisma, {
    workflowTemplateId: procurementWorkflowTemplate.id,
    version: PROCUREMENT_WORKFLOW_VERSION,
    definition: PROCUREMENT_WORKFLOW_DEFINITION,
    skipped: result.skippedPublished,
  });
  result.workflowTemplateVersions += 1;

  await upsertPublishedConfigurationVersion(prisma, {
    templateId: template.id,
    version: DEFAULT_ERP_VERSION,
    snapshot: DEFAULT_ERP_SNAPSHOT,
    skipped: result.skippedPublished,
  });
  result.configurationTemplateVersions += 1;

  return result;
}
