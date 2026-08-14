import { describe, expect, it } from "vitest";

import { type CustomFieldDefinition } from "@bizo/contracts/customization";
import {
  buildCustomFieldsZodSchema,
  validateCustomFieldsPayload,
} from "./custom-fields-validator.js";

describe("CustomFieldsValidator", () => {
  const definitions: CustomFieldDefinition[] = [
    {
      id: "60d73986-e757-4629-9e20-d6f851e58b01",
      tenantId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
      businessId: "60d73986-e757-4629-9e20-d6f851e58b02",
      documentType: "invoices",
      fieldKey: "project_code",
      label: "Project Code",
      fieldType: "TEXT",
      config: { required: true, validationRegex: "^PRJ-[0-9]{3}$" },
      createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:00Z",
    },
    {
      id: "60d73986-e757-4629-9e20-d6f851e58b02",
      tenantId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
      businessId: "60d73986-e757-4629-9e20-d6f851e58b02",
      documentType: "invoices",
      fieldKey: "discount_tier",
      label: "Discount Tier",
      fieldType: "SELECT",
      config: {
        required: false,
        options: [
          { value: "BRONZE", label: "Bronze (5%)" },
          { value: "GOLD", label: "Gold (15%)" },
        ],
      },
      createdAt: "2026-08-07T00:00:00Z",
      updatedAt: "2026-08-07T00:00:00Z",
    },
  ];

  it("builds a valid Zod schema from definitions", () => {
    const schema = buildCustomFieldsZodSchema(definitions);
    expect(schema).toBeDefined();
    expect(schema.safeParse({ project_code: "PRJ-101" }).success).toBe(true);
  });

  it("validates compliant custom field payload", () => {
    const payload = {
      project_code: "PRJ-101",
      discount_tier: "GOLD",
    };
    const validated = validateCustomFieldsPayload(definitions, payload);
    expect(validated).toEqual(payload);
  });

  it("rejects non-compliant regex in TEXT field", () => {
    const payload = {
      project_code: "INVALID-CODE",
    };
    expect(() => validateCustomFieldsPayload(definitions, payload)).toThrow();
  });

  it("rejects missing required field", () => {
    const payload = {
      discount_tier: "GOLD",
    };
    expect(() => validateCustomFieldsPayload(definitions, payload)).toThrow();
  });
});
