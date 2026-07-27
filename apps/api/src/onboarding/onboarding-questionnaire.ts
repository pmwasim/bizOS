// Phase 7 — Guided onboarding questionnaire definition.
//
// Deterministic, static question set for the v1 release. Conditional logic
// keeps the form short: follow-up questions only render when their `showWhen`
// predicate matches an earlier answer. Disabled options surface planned
// modules that are not yet implemented without letting users enable them.

import {
  onboardingQuestionnaireSchema,
  type OnboardingQuestionnaire,
} from "@bizo/contracts/onboarding";

// Question IDs are referenced by the recommendation engine and the
// questionnaire's `showWhen` predicates. Keep these stable across releases.
export const ONBOARDING_QUESTIONNAIRE_VERSION = "1.0.0";

export const ONBOARDING_QUESTIONNAIRE: OnboardingQuestionnaire =
  onboardingQuestionnaireSchema.parse({
    version: ONBOARDING_QUESTIONNAIRE_VERSION,
    steps: [
      {
        id: "essentials",
        title: "Essentials",
        description: "A few details so we can set up your workspace defaults.",
        questions: [
          {
            id: "country",
            type: "single-select",
            prompt: "Where does your business operate?",
            helpText: "Used to pick default tax and currency settings.",
            options: [
              { value: "SA", label: "Saudi Arabia" },
              { value: "AE", label: "United Arab Emirates" },
              { value: "GB", label: "United Kingdom" },
              { value: "US", label: "United States" },
            ],
          },
          {
            id: "currency",
            type: "single-select",
            prompt: "What currency do you bill in?",
            options: [
              { value: "SAR", label: "SAR — Saudi Riyal" },
              { value: "AED", label: "AED — UAE Dirham" },
              { value: "GBP", label: "GBP — British Pound" },
              { value: "USD", label: "USD — US Dollar" },
            ],
          },
          {
            id: "businessType",
            type: "single-select",
            prompt: "What do you sell?",
            options: [
              { value: "services", label: "Services" },
              { value: "goods", label: "Goods" },
              { value: "both", label: "Both" },
            ],
          },
        ],
      },
      {
        id: "quotations",
        title: "Quotations",
        questions: [
          {
            id: "quotations",
            type: "boolean",
            prompt: "Do you send quotations to customers before invoicing?",
            helpText: "You can change this later in Settings.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
          {
            id: "customerPurchaseOrders",
            type: "single-select",
            prompt: "Do your customers send purchase orders?",
            helpText: "Required means you cannot invoice without a customer PO.",
            options: [
              { value: "disabled", label: "Not used" },
              { value: "optional", label: "Optional" },
              { value: "required", label: "Required" },
            ],
          },
        ],
      },
      {
        id: "approvals",
        title: "Approvals",
        questions: [
          {
            id: "invoiceApproval",
            type: "single-select",
            prompt: "Do invoices need approval before sending?",
            showWhen: { questionId: "customerPurchaseOrders", values: ["required", "optional"] },
            options: [
              { value: "optional", label: "Optional" },
              { value: "required", label: "Required" },
            ],
          },
          {
            id: "teamApprovals",
            type: "single-select",
            prompt: "How many approvers should sign off on a quotation?",
            options: [
              { value: "single", label: "Single approver" },
              { value: "multi", label: "Multi-step approval" },
            ],
          },
        ],
      },
      {
        id: "modules-sales",
        title: "Sales modules",
        description: "Turn on the parts of bizOS you want to use today.",
        questions: [
          {
            id: "salesOrders",
            type: "boolean",
            prompt: "Convert accepted quotations into sales orders?",
            helpText: "Sales orders are not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
          {
            id: "deliveryOrServiceCompletion",
            type: "boolean",
            prompt: "Record delivery or service completion before invoicing?",
            helpText: "Delivery tracking is not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
          {
            id: "partialInvoicing",
            type: "boolean",
            prompt: "Allow partial invoicing from a single quotation?",
            helpText: "Partial invoicing is not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
        ],
      },
      {
        id: "modules-operations",
        title: "Operations modules",
        questions: [
          {
            id: "projects",
            type: "boolean",
            prompt: "Track projects with milestones?",
            helpText: "Projects are not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
          {
            id: "supplierPurchasing",
            type: "boolean",
            prompt: "Place purchase orders with suppliers?",
            helpText: "Supplier purchasing is not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
          {
            id: "inventory",
            type: "boolean",
            prompt: "Track inventory and stock movements?",
            helpText: "Inventory is not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
          {
            id: "partialPayments",
            type: "boolean",
            prompt: "Allow partial payments on an invoice?",
            helpText: "Partial payments are not yet implemented.",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
            disabledOptions: ["true"],
          },
        ],
      },
      {
        id: "tax-numbering",
        title: "Tax & numbering",
        questions: [
          {
            id: "taxRegistration",
            type: "single-select",
            prompt: "Are you registered for tax?",
            options: [
              { value: "registered", label: "Registered" },
              { value: "not", label: "Not registered" },
            ],
          },
          {
            id: "numberingPreferences",
            type: "single-select",
            prompt: "Pick a starting prefix for your quotation numbers.",
            options: [
              { value: "QUO-", label: "QUO-0001" },
              { value: "Q-", label: "Q-0001" },
              { value: "EST-", label: "EST-0001" },
            ],
          },
        ],
      },
    ],
  });
