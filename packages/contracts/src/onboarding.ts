import { z } from "zod";

// Phase 7 — Guided onboarding contracts.
//
// The onboarding flow presents a short, conditional questionnaire, returns a
// deterministic rule-based recommendation (no AI APIs, no code generation),
// and applies the reviewed recommendation as a new primary configuration
// assignment. "Use default" and "Configure later" both assign Default ERP
// immediately so every new business has a primary assignment after creation.

export const onboardingQuestionTypeSchema = z.enum([
  "single-select",
  "multi-select",
  "boolean",
  "text",
]);

export const onboardingQuestionIdSchema = z.enum([
  "country",
  "currency",
  "businessType",
  "quotations",
  "customerPurchaseOrders",
  "salesOrders",
  "deliveryOrServiceCompletion",
  "invoiceApproval",
  "partialInvoicing",
  "projects",
  "supplierPurchasing",
  "inventory",
  "partialPayments",
  "teamApprovals",
  "taxRegistration",
  "numberingPreferences",
]);

export const onboardingOptionSchema = z.strictObject({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(280).optional(),
});

export const onboardingQuestionSchema = z.strictObject({
  id: onboardingQuestionIdSchema,
  type: onboardingQuestionTypeSchema,
  prompt: z.string().trim().min(1).max(200),
  helpText: z.string().trim().max(280).optional(),
  required: z.boolean().default(true),
  options: z.array(onboardingOptionSchema).max(20).optional(),
  // Conditional questions only render when the referenced answer matches one
  // of the listed values. An absent `showWhen` means the question always shows.
  showWhen: z
    .strictObject({
      questionId: onboardingQuestionIdSchema,
      values: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
    })
    .optional(),
  // Disabled options are rendered but not selectable. Used to surface planned
  // modules that are not yet implemented without letting users enable them.
  disabledOptions: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

export const onboardingQuestionnaireSchema = z.strictObject({
  version: z.string().trim().min(1).max(20),
  // Ordered steps. Each step contains one or a small group of related questions.
  // Conditional follow-ups live in later steps and only render when their
  // `showWhen` predicate matches an earlier answer.
  steps: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1).max(60),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(280).optional(),
        questions: z.array(onboardingQuestionSchema).min(1).max(6),
      }),
    )
    .min(1)
    .max(12),
});

export const onboardingAnswersSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string())]))
  .default({});

export const onboardingModuleFlagSchema = z.strictObject({
  code: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const onboardingWorkflowRefSchema = z.strictObject({
  documentType: z.string().trim().min(1).max(40),
  workflowTemplateCode: z.string().trim().min(1).max(40),
  reason: z.string().trim().max(200).optional(),
});

export const onboardingRecommendationSchema = z.strictObject({
  configurationTemplateCode: z.string().trim().min(1).max(40),
  configurationTemplateVersionId: z.string().trim().min(1).max(80),
  configurationTemplateVersion: z.string().trim().min(1).max(20),
  enabledModules: z.array(onboardingModuleFlagSchema).max(50).default([]),
  workflowRefs: z.array(onboardingWorkflowRefSchema).max(20).default([]),
  terminology: z
    .strictObject({
      customerLabel: z.string().trim().min(1).max(80),
      quotationLabel: z.string().trim().min(1).max(80),
      invoiceLabel: z.string().trim().min(1).max(80),
    })
    .optional(),
  roleDefaults: z
    .array(
      z.strictObject({
        roleCode: z.string().trim().min(1).max(80),
        permissions: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
      }),
    )
    .max(20)
    .default([]),
  taxDefaults: z
    .strictObject({
      enabled: z.boolean(),
      name: z.string().trim().min(1).max(80),
      ratePercent: z
        .string()
        .trim()
        .regex(/^(?:100(?:\.0{1,4})?|\d{1,2}(?:\.\d{1,4})?)$/),
      priceIncludesTax: z.boolean(),
    })
    .optional(),
  currencyDefaults: z
    .strictObject({
      currencyCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/),
      currencyScale: z.number().int().min(0).max(4),
    })
    .optional(),
  numbering: z
    .strictObject({
      quotationPrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,12}$/),
      invoicePrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,12}$/),
      quotationValidityDays: z.number().int().min(1).max(365),
      invoiceDueDays: z.number().int().min(1).max(365),
    })
    .optional(),
  documentTemplates: z
    .array(
      z.strictObject({
        documentType: z.string().trim().min(1).max(40),
        templateName: z.string().trim().min(1).max(80),
      }),
    )
    .max(20)
    .default([]),
  // Human-readable summary the UI renders on the "Review recommendation" screen.
  summary: z.array(z.string().trim().min(1).max(280)).max(20).default([]),
  // True when the recommender fell back to default-erp because the answers
  // were conflicting or incomplete. The UI surfaces this so the user knows
  // their answers were not fully honored.
  fellBackToDefault: z.boolean().default(false),
});

export const recommendOnboardingRequestSchema = z.strictObject({
  answers: onboardingAnswersSchema,
});

export const applyOnboardingRequestSchema = z.strictObject({
  recommendation: onboardingRecommendationSchema,
  consentToReview: z.boolean().default(false),
});

export const onboardingAssignmentSummarySchema = z.strictObject({
  assignmentId: z.uuid(),
  businessId: z.uuid(),
  configurationTemplateVersionId: z.uuid(),
  templateCode: z.string(),
  templateVersion: z.string(),
  isPrimary: z.boolean(),
  reason: z.string().nullable(),
  assignedAt: z.iso.datetime(),
});

export type OnboardingQuestionType = z.infer<typeof onboardingQuestionTypeSchema>;
export type OnboardingQuestionId = z.infer<typeof onboardingQuestionIdSchema>;
export type OnboardingOption = z.infer<typeof onboardingOptionSchema>;
export type OnboardingQuestion = z.infer<typeof onboardingQuestionSchema>;
export type OnboardingQuestionnaire = z.infer<typeof onboardingQuestionnaireSchema>;
export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;
export type OnboardingModuleFlag = z.infer<typeof onboardingModuleFlagSchema>;
export type OnboardingWorkflowRef = z.infer<typeof onboardingWorkflowRefSchema>;
export type OnboardingRecommendation = z.infer<typeof onboardingRecommendationSchema>;
export type RecommendOnboardingRequest = z.infer<typeof recommendOnboardingRequestSchema>;
export type ApplyOnboardingRequest = z.infer<typeof applyOnboardingRequestSchema>;
export type OnboardingAssignmentSummary = z.infer<typeof onboardingAssignmentSummarySchema>;
