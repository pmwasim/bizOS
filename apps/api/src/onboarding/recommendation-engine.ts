// Phase 7 — Deterministic onboarding recommendation engine.
//
// Maps questionnaire answers to a configuration recommendation. No AI APIs,
// no code generation. The rules are:
//
//   1. Default to `default-erp` as the base template.
//   2. If the customer PO is required AND invoice approval is required,
//      recommend `service-po-approval` instead — it encodes the gates that
//      match that operating model.
//   3. Adjust module flags based on answers, but never enable unimplemented
//      modules (the questionnaire disables those options, but the engine
//      double-checks).
//   4. If the answers are conflicting or incomplete in a way that prevents a
//      safe recommendation, fall back to `default-erp` and set
//      `fellBackToDefault: true` so the UI can surface it.
//
// The engine is pure: same answers in → same recommendation out. It does not
// touch the database. The OnboardingService resolves the published template
// version IDs before applying.

import {
  type OnboardingAnswers,
  type OnboardingModuleFlag,
  type OnboardingQuestionId,
  type OnboardingRecommendation,
  type OnboardingWorkflowRef,
} from "@bizo/contracts/onboarding";

import { DEFAULT_ERP_TEMPLATE_CODE } from "../configuration/configuration.service.js";

export const SERVICE_PO_APPROVAL_TEMPLATE_CODE = "service-po-approval";

// Modules that are implemented in this release. The recommendation engine
// will only enable these. Unimplemented modules are kept disabled regardless
// of the user's answers.
const IMPLEMENTED_MODULE_CODES: ReadonlySet<string> = new Set([
  "customers",
  "quotations",
  "purchase-orders",
  "invoices",
  "payments",
]);

// Default-erp workflow refs (matches the seed snapshot).
const DEFAULT_ERP_WORKFLOW_REFS: OnboardingWorkflowRef[] = [
  {
    documentType: "QUOTATION",
    workflowTemplateCode: "default-quotation-workflow",
  },
  {
    documentType: "INVOICE",
    workflowTemplateCode: "default-invoice-workflow",
  },
  {
    documentType: "PURCHASE_ORDER",
    workflowTemplateCode: "default-procurement-workflow",
  },
];

// Service-po-approval workflow refs (matches the seed snapshot).
const SERVICE_PO_WORKFLOW_REFS: OnboardingWorkflowRef[] = [
  {
    documentType: "QUOTATION",
    workflowTemplateCode: "service-po-quotation-workflow",
  },
  {
    documentType: "INVOICE",
    workflowTemplateCode: "service-po-invoice-workflow",
  },
];

function answerString(answers: OnboardingAnswers, id: OnboardingQuestionId): string | null {
  const value = answers[id];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }
  return null;
}

function answerBoolean(answers: OnboardingAnswers, id: OnboardingQuestionId): boolean {
  return answerString(answers, id) === "true";
}

interface RecommendationContext {
  templateCode: string;
  enabledModules: OnboardingModuleFlag[];
  workflowRefs: OnboardingWorkflowRef[];
  summary: string[];
  fellBackToDefault: boolean;
}

/**
 * Compute a deterministic recommendation from questionnaire answers.
 *
 * The caller must supply the published template version IDs for both
 * `default-erp` and `service-po-approval` so the engine can populate the
 * recommendation without touching the database.
 */
export function recommendConfiguration(args: {
  answers: OnboardingAnswers;
  defaultErpVersionId: string;
  defaultErpVersion: string;
  servicePoVersionId: string;
  servicePoVersion: string;
}): OnboardingRecommendation {
  const { answers } = args;

  const customerPo = answerString(answers, "customerPurchaseOrders");
  const invoiceApproval = answerString(answers, "invoiceApproval");
  const quotationsEnabled = answerBoolean(answers, "quotations");
  const taxRegistered = answerString(answers, "taxRegistration") === "registered";
  const numberingPrefix = answerString(answers, "numberingPreferences") ?? "QUO-";

  // Detect conflicting answers that prevent a safe recommendation.
  const conflicts: string[] = [];
  if (customerPo === "required" && quotationsEnabled === false) {
    conflicts.push("Customer PO is required but quotations are disabled.");
  }
  if (invoiceApproval === "required" && customerPo === "disabled") {
    conflicts.push("Invoice approval is required but customer PO is disabled.");
  }

  const fellBackToDefault = conflicts.length > 0;

  // Rule 2: customer PO required + invoice approval required → service-po-approval.
  const useServicePo =
    !fellBackToDefault &&
    customerPo === "required" &&
    (invoiceApproval === "required" || invoiceApproval === undefined || invoiceApproval === null);

  const templateCode = useServicePo ? SERVICE_PO_APPROVAL_TEMPLATE_CODE : DEFAULT_ERP_TEMPLATE_CODE;
  const versionId = useServicePo ? args.servicePoVersionId : args.defaultErpVersionId;
  const version = useServicePo ? args.servicePoVersion : args.defaultErpVersion;
  const workflowRefs = useServicePo ? SERVICE_PO_WORKFLOW_REFS : DEFAULT_ERP_WORKFLOW_REFS;

  // Build module flags. Implemented modules are enabled based on answers;
  // unimplemented modules are always disabled.
  const enabledModules: OnboardingModuleFlag[] = [
    { code: "customers", enabled: true, reason: "Customer directory is always enabled." },
    {
      code: "quotations",
      enabled: quotationsEnabled,
      reason: quotationsEnabled
        ? "Quotations enabled by answer."
        : "Quotations disabled by answer.",
    },
    {
      code: "purchase-orders",
      enabled: customerPo !== "disabled",
      reason: customerPo === "disabled" ? "Customer POs disabled by answer." : undefined,
    },
    { code: "invoices", enabled: true, reason: "Invoicing is always enabled." },
    { code: "payments", enabled: true, reason: "Customer payments are available in this release." },
  ];

  // Unimplemented modules: surface them as disabled flags so the UI can show
  // the user their answers were recognized, but never enable them.
  const unimplementedFlags: OnboardingModuleFlag[] = [
    { code: "sales-orders", enabled: false, reason: "Not implemented in this release." },
    {
      code: "delivery-service",
      enabled: false,
      reason: "Not implemented in this release.",
    },
    { code: "credit-notes", enabled: false, reason: "Not implemented in this release." },
    { code: "inventory", enabled: false, reason: "Not implemented in this release." },
    { code: "projects", enabled: false, reason: "Not implemented in this release." },
    {
      code: "supplier-purchases",
      enabled: false,
      reason: "Not implemented in this release.",
    },
    { code: "supplier-bills", enabled: false, reason: "Not implemented in this release." },
    {
      code: "supplier-payments",
      enabled: false,
      reason: "Not implemented in this release.",
    },
    { code: "supplier-rfq", enabled: false, reason: "Not implemented in this release." },
  ];

  // Sanity check: every implemented module code is in the set.
  for (const flag of enabledModules) {
    if (flag.enabled && !IMPLEMENTED_MODULE_CODES.has(flag.code)) {
      throw new Error(`Recommendation engine tried to enable unimplemented module "${flag.code}".`);
    }
  }

  const summary: string[] = [];
  summary.push(
    useServicePo ? "Service PO & Approval configuration" : "Default bizOS ERP configuration",
  );
  if (quotationsEnabled) {
    summary.push("Quotations enabled");
  } else {
    summary.push("Quotations disabled");
  }
  if (customerPo === "required") {
    summary.push("Customer PO required before invoicing");
  } else if (customerPo === "optional") {
    summary.push("Customer PO optional");
  } else {
    summary.push("Customer PO not used");
  }
  if (taxRegistered) {
    summary.push("Tax registration captured");
  }
  summary.push(`Quotation prefix: ${numberingPrefix}`);

  if (fellBackToDefault) {
    summary.push("Fell back to Default ERP due to conflicting answers.");
  }

  const context: RecommendationContext = {
    templateCode,
    enabledModules: [...enabledModules, ...unimplementedFlags],
    workflowRefs,
    summary,
    fellBackToDefault,
  };

  return buildRecommendation({
    context,
    versionId,
    version,
    answers,
    taxRegistered,
    numberingPrefix,
  });
}

function buildRecommendation(args: {
  context: RecommendationContext;
  versionId: string;
  version: string;
  answers: OnboardingAnswers;
  taxRegistered: boolean;
  numberingPrefix: string;
}): OnboardingRecommendation {
  const { context, versionId, version, answers, taxRegistered, numberingPrefix } = args;

  const currencyCode = answerString(answers, "currency") ?? "USD";
  const taxName = answerString(answers, "country") === "SA" ? "VAT" : "Tax";
  const taxRate = answerString(answers, "country") === "SA" ? "15" : "0";

  return {
    configurationTemplateCode: context.templateCode,
    configurationTemplateVersionId: versionId,
    configurationTemplateVersion: version,
    enabledModules: context.enabledModules,
    workflowRefs: context.workflowRefs,
    terminology: {
      customerLabel: "Customer",
      quotationLabel: "Quotation",
      invoiceLabel: "Invoice",
    },
    roleDefaults: [],
    taxDefaults: taxRegistered
      ? {
          enabled: true,
          name: taxName,
          ratePercent: taxRate,
          priceIncludesTax: false,
        }
      : undefined,
    currencyDefaults: {
      currencyCode,
      currencyScale: 2,
    },
    numbering: {
      quotationPrefix: numberingPrefix,
      invoicePrefix: "INV-",
      quotationValidityDays: 30,
      invoiceDueDays: 30,
    },
    documentTemplates: [
      { documentType: "QUOTATION", templateName: "professional-v1" },
      { documentType: "INVOICE", templateName: "professional-v1" },
      { documentType: "PURCHASE_ORDER", templateName: "professional-v1" },
    ],
    summary: context.summary,
    fellBackToDefault: context.fellBackToDefault,
  };
}
