import { describe, expect, it } from "vitest";
import { authorize, createAuthorizationEnforcer, type AuthorizationRequest } from "../src/index.js";

describe("FEAT-03: Casbin RBAC Security Specification", () => {
  // Comprehensive default policy set mapping the 6 platform roles across domain resources
  const standardPolicies: string[] = [
    // Policies for OWNER
    "p, OWNER, tenant-a:biz-1, business, read|update|archive, allow",
    "p, OWNER, tenant-a:biz-1, /documents/*, read|create|update|send|export|archive, allow",
    "p, OWNER, tenant-a:biz-1, /customers/*, read|create|update|archive, allow",
    "p, OWNER, tenant-a:biz-1, /suppliers/*, read|create|update|archive, allow",
    "p, OWNER, tenant-a:biz-1, /payments/*, read|create|update, allow",

    // Policies for ADMIN
    "p, ADMIN, tenant-a:biz-1, business, read|update, allow",
    "p, ADMIN, tenant-a:biz-1, /documents/*, read|create|update|send|export, allow",
    "p, ADMIN, tenant-a:biz-1, /customers/*, read|create|update, allow",
    "p, ADMIN, tenant-a:biz-1, /suppliers/*, read|create|update, allow",
    "p, ADMIN, tenant-a:biz-1, /payments/*, read|create|update, allow",

    // Policies for MEMBER
    "p, MEMBER, tenant-a:biz-1, business, read, allow",
    "p, MEMBER, tenant-a:biz-1, /documents/quotation/:id, read|create|update|send|export, allow",
    "p, MEMBER, tenant-a:biz-1, /documents/invoice/:id, read|create|update|send|export, allow",
    "p, MEMBER, tenant-a:biz-1, /customers/*, read|create|update, allow",
    "p, MEMBER, tenant-a:biz-1, /suppliers/*, read, allow",
    "p, MEMBER, tenant-a:biz-1, /payments/*, read|create|update, allow",

    // Policies for STAFF
    "p, STAFF, tenant-a:biz-1, business, read, allow",
    "p, STAFF, tenant-a:biz-1, /documents/quotation/:id, read|create|update|send|export, allow",
    "p, STAFF, tenant-a:biz-1, /customers/*, read|create|update, allow",
    "p, STAFF, tenant-a:biz-1, /suppliers/*, read, allow",
    "p, STAFF, tenant-a:biz-1, /payments/*, read|create, allow",

    // Policies for ACCOUNTANT
    "p, ACCOUNTANT, tenant-a:biz-1, business, read, allow",
    "p, ACCOUNTANT, tenant-a:biz-1, /documents/*, read|export, allow",
    "p, ACCOUNTANT, tenant-a:biz-1, /customers/*, read, allow",
    "p, ACCOUNTANT, tenant-a:biz-1, /suppliers/*, read, allow",
    "p, ACCOUNTANT, tenant-a:biz-1, /payments/*, read|export, allow",

    // Policies for EXTERNAL_AUDITOR
    "p, EXTERNAL_AUDITOR, tenant-a:biz-1, business, read, allow",
    "p, EXTERNAL_AUDITOR, tenant-a:biz-1, /documents/*, read, allow",
    "p, EXTERNAL_AUDITOR, tenant-a:biz-1, /customers/*, read, allow",
    "p, EXTERNAL_AUDITOR, tenant-a:biz-1, /suppliers/*, read, allow",
    "p, EXTERNAL_AUDITOR, tenant-a:biz-1, /payments/*, read, allow",

    // Role Groupings for Tenant A - Biz 1
    "g, user-owner-1, OWNER, tenant-a:biz-1",
    "g, user-admin-1, ADMIN, tenant-a:biz-1",
    "g, user-member-1, MEMBER, tenant-a:biz-1",
    "g, user-staff-1, STAFF, tenant-a:biz-1",
    "g, user-acct-1, ACCOUNTANT, tenant-a:biz-1",
    "g, user-auditor-1, EXTERNAL_AUDITOR, tenant-a:biz-1",

    // Policies & Grouping for Tenant B (Isolated workspace)
    "p, OWNER, tenant-b:biz-2, /documents/*, read|create|update|send|export|archive, allow",
    "g, user-b-owner, OWNER, tenant-b:biz-2",
  ];

  // ==========================================
  // TIER 1: Feature Coverage
  // ==========================================
  describe("Tier 1 — Core RBAC Feature Coverage", () => {
    it("1.1 FEAT-03: OWNER role has unrestricted permissions across all resources", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      const request: AuthorizationRequest = {
        subjectId: "user-owner-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "archive",
      };

      expect(await authorize(enforcer, request)).toBe(true);
    });

    it("1.2 FEAT-03: ADMIN role can perform create/update but is restricted from resource archive", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      const updateReq: AuthorizationRequest = {
        subjectId: "user-admin-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "update",
      };
      expect(await authorize(enforcer, updateReq)).toBe(true);

      const archiveReq: AuthorizationRequest = {
        subjectId: "user-admin-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "archive",
      };
      expect(await authorize(enforcer, archiveReq)).toBe(false);
    });

    it("1.3 FEAT-03: STAFF role can manage quotations and customers but cannot modify invoices", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      const quoteReq: AuthorizationRequest = {
        subjectId: "user-staff-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/quotation/50",
        action: "create",
      };
      expect(await authorize(enforcer, quoteReq)).toBe(true);

      const invoiceReq: AuthorizationRequest = {
        subjectId: "user-staff-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice/50",
        action: "create",
      };
      expect(await authorize(enforcer, invoiceReq)).toBe(false);
    });

    it("1.4 FEAT-03: ACCOUNTANT role has read and export permissions but cannot create records", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      const readReq: AuthorizationRequest = {
        subjectId: "user-acct-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "read",
      };
      expect(await authorize(enforcer, readReq)).toBe(true);

      const createReq: AuthorizationRequest = {
        subjectId: "user-acct-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "create",
      };
      expect(await authorize(enforcer, createReq)).toBe(false);
    });

    it("1.5 FEAT-03: EXTERNAL_AUDITOR role is strictly read-only across all endpoints", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      const readReq: AuthorizationRequest = {
        subjectId: "user-auditor-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/payments/pay-1",
        action: "read",
      };
      expect(await authorize(enforcer, readReq)).toBe(true);

      const exportReq: AuthorizationRequest = {
        subjectId: "user-auditor-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/payments/pay-1",
        action: "export",
      };
      expect(await authorize(enforcer, exportReq)).toBe(false);
    });
  });

  // ==========================================
  // TIER 2: Boundary & Corner Cases
  // ==========================================
  describe("Tier 2 — Boundary, Negative Validation & Isolation Security", () => {
    it("2.1 FEAT-03: Prevents role grants from crossing tenant boundaries", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      // User A (Owner of Tenant A) attempts to perform action in Tenant B
      const crossTenantReq: AuthorizationRequest = {
        subjectId: "user-owner-1",
        tenantId: "tenant-b",
        businessId: "biz-2",
        object: "/documents/invoice-999",
        action: "read",
      };

      expect(await authorize(enforcer, crossTenantReq)).toBe(false);
    });

    it("2.2 FEAT-03: Enforces exact keyMatch2 object matching boundaries", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      // STAFF role allowed on /documents/quotation/:id but not on /documents/invoice/:id
      const quoteMatch: AuthorizationRequest = {
        subjectId: "user-staff-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/quotation/abc-123",
        action: "send",
      };
      expect(await authorize(enforcer, quoteMatch)).toBe(true);

      const invoiceMismatch: AuthorizationRequest = {
        subjectId: "user-staff-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice/abc-123",
        action: "send",
      };
      expect(await authorize(enforcer, invoiceMismatch)).toBe(false);
    });

    it("2.3 FEAT-03: Rejects unmapped actions against regexMatch regex policies", async () => {
      const enforcer = await createAuthorizationEnforcer(standardPolicies);

      // ACCOUNTANT has read|export on /documents/*
      const deleteAction: AuthorizationRequest = {
        subjectId: "user-acct-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-100",
        action: "delete",
      };
      expect(await authorize(enforcer, deleteAction)).toBe(false);
    });

    it("2.4 FEAT-03: Default deny behavior when initialized with comment-only policy lines", async () => {
      const emptyEnforcer = await createAuthorizationEnforcer(["# empty policy document"]);

      const req: AuthorizationRequest = {
        subjectId: "user-owner-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-1",
        action: "read",
      };
      expect(await authorize(emptyEnforcer, req)).toBe(false);
    });

    it("2.5 FEAT-03: Explicit deny policies override allow policies (some deny rule)", async () => {
      const policiesWithDeny = [
        ...standardPolicies,
        "p, STAFF, tenant-a:biz-1, /documents/quotation/:id, create|update|send, deny",
      ];
      const enforcer = await createAuthorizationEnforcer(policiesWithDeny);

      const restrictedReq: AuthorizationRequest = {
        subjectId: "user-staff-1",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/quotation/restricted-999",
        action: "send",
      };

      expect(await authorize(enforcer, restrictedReq)).toBe(false);
    });
  });

  // ==========================================
  // TIER 3: Cross-Feature Interactions
  // ==========================================
  describe("Tier 3 — Dynamic Multi-Business & Role Context Switching", () => {
    it("3.1 Dynamic Switcher: User with ADMIN in Business 1 and ACCOUNTANT in Business 2 evaluates correct policy per workspace context", async () => {
      const multiBizPolicies = [
        ...standardPolicies,
        // user-multi is ADMIN in biz-1, ACCOUNTANT in biz-3 under same tenant-a
        "g, user-multi, ADMIN, tenant-a:biz-1",
        "g, user-multi, ACCOUNTANT, tenant-a:biz-3",
        "p, ACCOUNTANT, tenant-a:biz-3, /documents/*, read, allow",
        "p, ADMIN, tenant-a:biz-1, /documents/*, create, allow",
      ];
      const enforcer = await createAuthorizationEnforcer(multiBizPolicies);

      // Context 1: Active business is biz-1 (User is ADMIN) -> Can create
      const biz1Req: AuthorizationRequest = {
        subjectId: "user-multi",
        tenantId: "tenant-a",
        businessId: "biz-1",
        object: "/documents/invoice-10",
        action: "create",
      };
      expect(await authorize(enforcer, biz1Req)).toBe(true);

      // Context 2: Active business switched to biz-3 (User is ACCOUNTANT) -> Cannot create
      const biz3Req: AuthorizationRequest = {
        subjectId: "user-multi",
        tenantId: "tenant-a",
        businessId: "biz-3",
        object: "/documents/invoice-10",
        action: "create",
      };
      expect(await authorize(enforcer, biz3Req)).toBe(false);

      // Context 2: Active business switched to biz-3 -> Can read
      const biz3ReadReq: AuthorizationRequest = {
        subjectId: "user-multi",
        tenantId: "tenant-a",
        businessId: "biz-3",
        object: "/documents/invoice-10",
        action: "read",
      };
      expect(await authorize(enforcer, biz3ReadReq)).toBe(true);
    });
  });

  // ==========================================
  // TIER 4: Real-World Workloads & High Concurrency Simulation
  // ==========================================
  describe("Tier 4 — High Concurrency Multi-Tenant Authorization Workload", () => {
    it("4.1 Rapidly evaluates 500 concurrent authorization requests across 50 distinct tenant domains with zero cross-tenant leakage", async () => {
      // Generate 50 tenants with 5 users each
      const generatedPolicies: string[] = [];
      for (let t = 1; t <= 50; t++) {
        const dom = `tenant-${t}:biz-${t}`;
        generatedPolicies.push(`p, OWNER, ${dom}, /resources/*, read|write, allow`);
        generatedPolicies.push(`g, user-${t}-owner, OWNER, ${dom}`);
      }

      const enforcer = await createAuthorizationEnforcer(generatedPolicies);

      // Execute 500 parallel authorizations
      const promises: Promise<boolean>[] = [];
      for (let i = 0; i < 500; i++) {
        const tenantIndex = (i % 50) + 1;
        const validUser = `user-${tenantIndex}-owner`;
        const validTenant = `tenant-${tenantIndex}`;
        const validBiz = `biz-${tenantIndex}`;

        // 90% valid requests, 10% cross-tenant attack attempts
        const isAttack = i % 10 === 0;
        const targetTenant = isAttack ? `tenant-${(tenantIndex % 50) + 1}` : validTenant;
        const targetBiz = isAttack ? `biz-${(tenantIndex % 50) + 1}` : validBiz;

        const req: AuthorizationRequest = {
          subjectId: validUser,
          tenantId: targetTenant,
          businessId: targetBiz,
          object: `/resources/item-${i}`,
          action: "write",
        };

        promises.push(
          authorize(enforcer, req).then((res) => {
            if (isAttack) {
              expect(res).toBe(false);
            } else {
              expect(res).toBe(true);
            }
            return res;
          }),
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(500);
    });
  });
});
