import { describe, expect, it } from "vitest";

import {
  platformSystemAdminStatusSchema,
  systemAdminAssignConfigurationRequestSchema,
  systemAdminAuditEventSummarySchema,
  systemAdminHealthSummarySchema,
  systemAdminListOrganizationsRequestSchema,
  systemAdminOrganizationPageSchema,
  systemAdminOrganizationSummarySchema,
  systemAdminPrincipalSchema,
  systemAdminSetDefaultErpVersionRequestSchema,
} from "./system-admin.js";

describe("system-admin contracts", () => {
  it("accepts the platform system admin status enum values", () => {
    expect(platformSystemAdminStatusSchema.options).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("accepts an active system admin principal", () => {
    expect(
      systemAdminPrincipalSchema.safeParse({
        systemAdminId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        userId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        status: "ACTIVE",
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it("accepts an organization summary with a current assignment", () => {
    expect(
      systemAdminOrganizationSummarySchema.safeParse({
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        name: "Acme Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        currentAssignment: {
          assignmentId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf060",
          configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf061",
          templateCode: "default-erp",
          templateVersion: "1.0.0",
          isPrimary: true,
          assignedAt: "2026-07-28T00:00:00.000Z",
        },
      }).success,
    ).toBe(true);
  });

  it("accepts an organization summary with no current assignment", () => {
    expect(
      systemAdminOrganizationSummarySchema.safeParse({
        businessId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        name: "Acme Services",
        countryCode: "SA",
        baseCurrency: "SAR",
        currencyScale: 2,
        locale: "en",
        timeZone: "Asia/Riyadh",
        currentAssignment: null,
      }).success,
    ).toBe(true);
  });

  it("coerces pagination params and applies defaults for list organizations", () => {
    const parsed = systemAdminListOrganizationsRequestSchema.parse({
      page: "2",
      pageSize: "5",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(5);
  });

  it("applies default pagination when omitted", () => {
    const parsed = systemAdminListOrganizationsRequestSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("rejects an assignment request without a reason", () => {
    expect(
      systemAdminAssignConfigurationRequestSchema.safeParse({
        configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf061",
        reason: "",
      }).success,
    ).toBe(false);
  });

  it("rejects a set-default-erp request without a reason", () => {
    expect(
      systemAdminSetDefaultErpVersionRequestSchema.safeParse({
        configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf061",
        reason: "   ",
      }).success,
    ).toBe(false);
  });

  it("defaults confirm to false on assignment requests", () => {
    const parsed = systemAdminAssignConfigurationRequestSchema.parse({
      configurationTemplateVersionId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf061",
      reason: "Onboarding correction",
    });
    expect(parsed.confirm).toBe(false);
  });

  it("accepts an audit event summary with a system admin actor", () => {
    expect(
      systemAdminAuditEventSummarySchema.safeParse({
        id: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf048",
        tenantId: null,
        actorMembershipId: null,
        actorSystemAdminId: "7a5aec75-6ec9-4fcc-8f8d-68cdacbdf049",
        action: "ASSIGN",
        entityType: "BusinessConfigurationAssignment",
        entityId: "700",
        reason: "Cross-tenant correction",
        createdAt: "2026-07-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a health summary with check records", () => {
    expect(
      systemAdminHealthSummarySchema.safeParse({
        service: "api",
        status: "ok",
        timestamp: "2026-07-28T00:00:00.000Z",
        checks: {
          database: { status: "ok" },
          queue: { status: "degraded", detail: "Drain in progress" },
        },
      }).success,
    ).toBe(true);
  });

  it("paginates organization summaries", () => {
    expect(
      systemAdminOrganizationPageSchema.safeParse({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      }).success,
    ).toBe(true);
  });
});
