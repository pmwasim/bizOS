// Phase 6 — Service PO & Approval Configuration v1 seed.
//
// ConfigurationTemplate code `service-po-approval`, kind SPECIALIZED. Version 1.0.0 PUBLISHED.
// Two WorkflowTemplates:
//   - service-po-quotation-workflow v1.0.0 (documentType QUOTATION)
//   - service-po-invoice-workflow v1.0.0 (documentType INVOICE)
//
// This is the configuration that existing production businesses using the current
// hard-coded behavior should be assigned to (Phase 13 backfill). The quotation workflow
// encodes the current readiness rules: customer PO required, approval evidence required,
// ready-to-invoice required before conversion. The invoice workflow requires the invoice
// to originate from a READY_TO_INVOICE quotation.
//
// The documentType values align with the Prisma DocumentType enum (QUOTATION | INVOICE)
// so ConfigurationService.createDocumentWorkflowContext can match snapshot.workflows[]
// against document.type.

import {
  configurationSnapshotSchema,
  type ConfigurationSnapshot,
} from "@bizo/contracts/configuration";
import { workflowDefinitionSchema, type WorkflowDefinition } from "@bizo/contracts/workflows";

import type { SeedClient, SeedResult } from "./shared.js";
import { emptySeedResult } from "./shared.js";
import { IMPLEMENTED_MODULE_CODES, PLANNED_MODULE_CODES } from "./module-catalog.js";
import { upsertPublishedConfigurationVersion, upsertPublishedWorkflowVersion } from "./shared.js";

export const SERVICE_PO_APPROVAL_TEMPLATE_CODE = "service-po-approval";
export const SERVICE_PO_APPROVAL_VERSION = "1.0.0";

export const SERVICE_PO_QUOTATION_WORKFLOW_CODE = "service-po-quotation-workflow";
export const SERVICE_PO_QUOTATION_WORKFLOW_VERSION = "1.0.0";

export const SERVICE_PO_INVOICE_WORKFLOW_CODE = "service-po-invoice-workflow";
export const SERVICE_PO_INVOICE_WORKFLOW_VERSION = "1.0.0";

const QUOTATION_DOCUMENT_TYPE = "QUOTATION";
const INVOICE_DOCUMENT_TYPE = "INVOICE";

// Snapshot: same shape as default-erp, but the workflows reference the service-po-*
// templates which mandate customer PO + approval evidence before invoicing. The
// `purchase-orders` module is enabled (it is implemented) and the readiness rules live
// in the workflow definition guards.
function buildServicePoModules(): ConfigurationSnapshot["modules"] {
  const enabled = IMPLEMENTED_MODULE_CODES.map((code) => ({ code, enabled: true }));
  const disabled = PLANNED_MODULE_CODES.map((code) => ({ code, enabled: false }));
  return [...enabled, ...disabled];
}

export const SERVICE_PO_APPROVAL_SNAPSHOT: ConfigurationSnapshot =
  configurationSnapshotSchema.parse({
    modules: buildServicePoModules(),
    workflows: [
      {
        documentType: QUOTATION_DOCUMENT_TYPE,
        workflowTemplateCode: SERVICE_PO_QUOTATION_WORKFLOW_CODE,
        version: SERVICE_PO_QUOTATION_WORKFLOW_VERSION,
      },
      {
        documentType: INVOICE_DOCUMENT_TYPE,
        workflowTemplateCode: SERVICE_PO_INVOICE_WORKFLOW_CODE,
        version: SERVICE_PO_INVOICE_WORKFLOW_VERSION,
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
          "purchase-orders:write",
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

// Service PO & Approval quotation workflow: Draft Quotation -> Sent -> Accepted ->
// Customer PO Received -> Approval Evidence Captured -> Ready to Invoice -> Converted.
// Transitions encode the current hard-coded readiness rules:
//   - Linking a customer PO requires a purchase order to exist.
//   - Recording approval evidence requires the approval artifact to exist.
//   - Marking ready-to-invoice requires the purchase order approval status to be APPROVED.
//   - Conversion requires the workflow state to be READY_TO_INVOICE (which implicitly
//     means customer PO + approval evidence were captured).
export const SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION: WorkflowDefinition =
  workflowDefinitionSchema.parse({
    states: [
      { key: "draft-quotation", label: "Draft Quotation", status: "DRAFT", isOptional: false },
      { key: "sent-quotation", label: "Sent Quotation", status: "SENT", isOptional: false },
      { key: "accepted", label: "Accepted", status: "ACCEPTED", isOptional: false },
      {
        key: "customer-po-received",
        label: "Customer PO Received",
        status: "CUSTOMER_PO_RECEIVED",
        isOptional: false,
      },
      {
        key: "approval-evidence-captured",
        label: "Approval Evidence Captured",
        status: "APPROVAL_EVIDENCE_CAPTURED",
        isOptional: false,
      },
      {
        key: "ready-to-invoice",
        label: "Ready to Invoice",
        status: "READY_TO_INVOICE",
        isOptional: false,
      },
      { key: "converted", label: "Converted", status: "CONVERTED", isOptional: false },
    ],
    transitions: [
      {
        fromState: "draft-quotation",
        action: "send",
        toState: "sent-quotation",
        allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
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
        toState: "customer-po-received",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "purchaseOrder", operator: "exists" }],
      },
      {
        fromState: "customer-po-received",
        action: "record-approval-evidence",
        toState: "approval-evidence-captured",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "approvalEvidence", operator: "exists" }],
      },
      {
        fromState: "approval-evidence-captured",
        action: "mark-ready-to-invoice",
        toState: "ready-to-invoice",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "purchaseOrder.approvalStatus", operator: "eq", value: "APPROVED" }],
      },
      {
        fromState: "ready-to-invoice",
        action: "convert",
        toState: "converted",
        allowedRoles: ["OWNER", "ADMIN"],
        guard: [{ field: "workflowState", operator: "eq", value: "READY_TO_INVOICE" }],
      },
    ],
  });

// Service PO & Approval invoice workflow: Draft Invoice -> Sent -> Paid. An invoice in
// this configuration must originate from a READY_TO_INVOICE quotation (captured via
// Document.sourceQuotationId). The guard on the send transition encodes that rule.
// Payment is the terminal step.
export const SERVICE_PO_INVOICE_WORKFLOW_DEFINITION: WorkflowDefinition =
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
        guard: [
          { field: "document.status", operator: "eq", value: "READY_TO_SEND" },
          { field: "sourceQuotation.workflowState", operator: "eq", value: "READY_TO_INVOICE" },
        ],
      },
      {
        fromState: "sent-invoice",
        action: "record-payment",
        toState: "paid",
        allowedRoles: ["OWNER", "ADMIN"],
      },
    ],
  });

export async function seedServicePoApproval(prisma: SeedClient): Promise<SeedResult> {
  const result = emptySeedResult();

  const template = await prisma.configurationTemplate.upsert({
    where: { code: SERVICE_PO_APPROVAL_TEMPLATE_CODE },
    update: {
      name: "Service PO & Approval",
      description:
        "Specialized configuration for service businesses. Customer PO and approval evidence are required before invoicing.",
      kind: "SPECIALIZED",
    },
    create: {
      code: SERVICE_PO_APPROVAL_TEMPLATE_CODE,
      name: "Service PO & Approval",
      description:
        "Specialized configuration for service businesses. Customer PO and approval evidence are required before invoicing.",
      kind: "SPECIALIZED",
    },
  });
  result.configurationTemplates += 1;

  const quotationWorkflowTemplate = await prisma.workflowTemplate.upsert({
    where: { code: SERVICE_PO_QUOTATION_WORKFLOW_CODE },
    update: {
      name: "Service PO & Approval quotation workflow",
      description:
        "Quotation lifecycle with customer PO, approval evidence, and ready-to-invoice gates before conversion.",
      documentType: QUOTATION_DOCUMENT_TYPE,
    },
    create: {
      code: SERVICE_PO_QUOTATION_WORKFLOW_CODE,
      name: "Service PO & Approval quotation workflow",
      description:
        "Quotation lifecycle with customer PO, approval evidence, and ready-to-invoice gates before conversion.",
      documentType: QUOTATION_DOCUMENT_TYPE,
    },
  });
  result.workflowTemplates += 1;

  const invoiceWorkflowTemplate = await prisma.workflowTemplate.upsert({
    where: { code: SERVICE_PO_INVOICE_WORKFLOW_CODE },
    update: {
      name: "Service PO & Approval invoice workflow",
      description:
        "Invoice lifecycle requiring origin from a READY_TO_INVOICE quotation before sending.",
      documentType: INVOICE_DOCUMENT_TYPE,
    },
    create: {
      code: SERVICE_PO_INVOICE_WORKFLOW_CODE,
      name: "Service PO & Approval invoice workflow",
      description:
        "Invoice lifecycle requiring origin from a READY_TO_INVOICE quotation before sending.",
      documentType: INVOICE_DOCUMENT_TYPE,
    },
  });
  result.workflowTemplates += 1;

  await upsertPublishedWorkflowVersion(prisma, {
    workflowTemplateId: quotationWorkflowTemplate.id,
    version: SERVICE_PO_QUOTATION_WORKFLOW_VERSION,
    definition: SERVICE_PO_QUOTATION_WORKFLOW_DEFINITION,
    skipped: result.skippedPublished,
  });
  result.workflowTemplateVersions += 1;

  await upsertPublishedWorkflowVersion(prisma, {
    workflowTemplateId: invoiceWorkflowTemplate.id,
    version: SERVICE_PO_INVOICE_WORKFLOW_VERSION,
    definition: SERVICE_PO_INVOICE_WORKFLOW_DEFINITION,
    skipped: result.skippedPublished,
  });
  result.workflowTemplateVersions += 1;

  await upsertPublishedConfigurationVersion(prisma, {
    templateId: template.id,
    version: SERVICE_PO_APPROVAL_VERSION,
    snapshot: SERVICE_PO_APPROVAL_SNAPSHOT,
    skipped: result.skippedPublished,
  });
  result.configurationTemplateVersions += 1;

  return result;
}
