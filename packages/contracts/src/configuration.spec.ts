import { describe, expect, it } from "vitest";

import {
  businessConfigurationAssignmentSchema,
  configurationSnapshotSchema,
  configurationTemplateKindSchema,
  configurationTemplateSchema,
  configurationTemplateVersionSchema,
  configurationVersionStatusSchema,
} from "./configuration.js";

describe("configuration contracts", () => {
  it("accepts the template kind enum values", () => {
    expect(configurationTemplateKindSchema.options).toEqual(["DEFAULT", "SPECIALIZED", "INDUSTRY"]);
  });

  it("accepts the version status enum values", () => {
    expect(configurationVersionStatusSchema.options).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);
  });

  it("applies snapshot defaults for a minimal default-erp template", () => {
    const snapshot = configurationSnapshotSchema.parse({
      currency: { currencyCode: "SAR", currencyScale: 2 },
      tax: {},
      numbering: {},
      terminology: {},
    });
    expect(snapshot.modules).toEqual([]);
    expect(snapshot.workflows).toEqual([]);
    expect(snapshot.roleDefaults).toEqual([]);
    expect(snapshot.tax.enabled).toBe(false);
    expect(snapshot.tax.ratePercent).toBe("0");
    expect(snapshot.numbering.quotationPrefix).toBe("Q");
    expect(snapshot.numbering.invoicePrefix).toBe("INV");
    expect(snapshot.terminology.quotationLabel).toBe("Quotation");
  });

  it("rejects an invalid currency code in the snapshot", () => {
    expect(
      configurationSnapshotSchema.safeParse({
        currency: { currencyCode: "SAUD", currencyScale: 2 },
        tax: {},
        numbering: {},
        terminology: {},
      }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range currency scale", () => {
    expect(
      configurationSnapshotSchema.safeParse({
        currency: { currencyCode: "SAR", currencyScale: 5 },
        tax: {},
        numbering: {},
        terminology: {},
      }).success,
    ).toBe(false);
  });

  it("accepts a configuration template", () => {
    expect(
      configurationTemplateSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        code: "default-erp",
        name: "Default ERP",
        description: "Baseline configuration for new businesses.",
        kind: "DEFAULT",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown template kind", () => {
    expect(
      configurationTemplateSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        code: "default-erp",
        name: "Default ERP",
        description: null,
        kind: "UNKNOWN",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts a published configuration template version with a snapshot", () => {
    expect(
      configurationTemplateVersionSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        templateId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        version: "1.0.0",
        status: "PUBLISHED",
        snapshot: {
          currency: { currencyCode: "SAR", currencyScale: 2 },
          tax: { enabled: true, name: "VAT", ratePercent: "15", priceIncludesTax: false },
          numbering: {
            quotationPrefix: "Q",
            invoicePrefix: "INV",
            quotationValidityDays: 30,
            invoiceDueDays: 30,
          },
          terminology: {},
        },
        publishedAt: "2026-07-28T00:00:00.000Z",
        retiredAt: null,
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a workflow ref with an optional version pin", () => {
    expect(
      configurationSnapshotSchema.safeParse({
        currency: { currencyCode: "SAR", currencyScale: 2 },
        tax: {},
        numbering: {},
        terminology: {},
        workflows: [
          {
            documentType: "QUOTATION",
            workflowTemplateCode: "default-quotation-workflow",
            version: "1.0.0",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a workflow ref without a version pin (omitted is valid)", () => {
    expect(
      configurationSnapshotSchema.safeParse({
        currency: { currencyCode: "SAR", currencyScale: 2 },
        tax: {},
        numbering: {},
        terminology: {},
        workflows: [
          { documentType: "QUOTATION", workflowTemplateCode: "default-quotation-workflow" },
        ],
      }).success,
    ).toBe(true);
  });

  it("accepts a business configuration assignment", () => {
    expect(
      businessConfigurationAssignmentSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf051",
        isPrimary: true,
        assignedByMembershipId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf052",
        reason: "Initial onboarding",
        assignedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects an assignment with a non-uuid tenant id", () => {
    expect(
      businessConfigurationAssignmentSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "not-a-uuid",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf051",
        isPrimary: true,
        assignedByMembershipId: null,
        reason: null,
        assignedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
