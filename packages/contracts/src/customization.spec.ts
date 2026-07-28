import { describe, expect, it } from "vitest";

import {
  customFieldConfigSchema,
  customFieldDefinitionSchema,
  createCustomizationRequestSchema,
  customizationRequestSchema,
  customizationRequestStatusSchema,
  customizationRequestUrgencySchema,
  customFieldTypeSchema,
  featureFlagSchema,
} from "./customization.js";

describe("customization contracts", () => {
  it("exposes the custom field type enum", () => {
    expect(customFieldTypeSchema.options).toEqual([
      "TEXT",
      "NUMBER",
      "DATE",
      "SELECT",
      "BOOLEAN",
      "MULTILINE",
    ]);
  });

  it("exposes the customization request urgency enum", () => {
    expect(customizationRequestUrgencySchema.options).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("exposes the customization request status enum", () => {
    expect(customizationRequestStatusSchema.options).toEqual([
      "OPEN",
      "IN_REVIEW",
      "RESOLVED",
      "REJECTED",
    ]);
  });

  it("applies custom field config defaults", () => {
    expect(customFieldConfigSchema.parse({})).toMatchObject({
      required: false,
    });
  });

  it("accepts a select custom field with options", () => {
    expect(
      customFieldConfigSchema.safeParse({
        options: [
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ],
        required: true,
      }).success,
    ).toBe(true);
  });

  it("accepts a custom field definition", () => {
    expect(
      customFieldDefinitionSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        documentType: "QUOTATION",
        fieldKey: "priority",
        label: "Priority",
        fieldType: "SELECT",
        config: {
          options: [
            { value: "low", label: "Low" },
            { value: "high", label: "High" },
          ],
          required: false,
        },
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects a custom field definition with an unknown field type", () => {
    expect(
      customFieldDefinitionSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        documentType: "QUOTATION",
        fieldKey: "priority",
        label: "Priority",
        fieldType: "RICH_TEXT",
        config: {},
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts a feature flag", () => {
    expect(
      featureFlagSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        flagKey: "early-access-projects",
        enabled: true,
        config: { rollout: 0.25 },
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a customization request", () => {
    expect(
      customizationRequestSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        requesterMembershipId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf051",
        currentConfigurationTemplateVersionId: null,
        statedProcess: { steps: ["lead", "quote", "invoice"] },
        requestedChanges: { numbering: { invoicePrefix: "INV-2026" } },
        urgency: "HIGH",
        notes: { contact: "owner@example.test" },
        consentToReview: true,
        status: "OPEN",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects a customization request with an unknown urgency", () => {
    expect(
      customizationRequestSchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf050",
        requesterMembershipId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf051",
        currentConfigurationTemplateVersionId: null,
        statedProcess: {},
        requestedChanges: {},
        urgency: "URGENT",
        notes: null,
        consentToReview: false,
        status: "OPEN",
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("accepts a create customization request payload", () => {
    expect(
      createCustomizationRequestSchema.safeParse({
        statedProcess: "Quote to invoice",
        requestedChanges: "Custom numbering",
        urgency: "HIGH",
        notes: "Call me",
        consentToReview: true,
      }).success,
    ).toBe(true);
  });

  it("rejects create customization request without consent", () => {
    expect(
      createCustomizationRequestSchema.safeParse({
        statedProcess: "Quote to invoice",
        requestedChanges: "Custom numbering",
        urgency: "HIGH",
        consentToReview: false,
      }).success,
    ).toBe(false);
  });
});
