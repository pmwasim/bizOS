// Phase 10 — Business Admin boundary unit tests.
//
// Unit-level tests (no DB) covering the guard and access-service logic that
// enforces the boundary between organization Owner/Admin and platform System
// Admin:
//   - SystemAdminGuard rejects when the principal has no ACTIVE
//     PlatformSystemAdmin row (so @SystemAdmin() endpoints are unreachable
//     for org Owner/Admin/Member).
//   - SystemAdminGuard admits when the principal has an ACTIVE
//     PlatformSystemAdmin row and augments the principal with systemAdminId.
//   - BusinessAccessService.resolve throws NotFound when the user has no
//     BusinessAccess record for the target business (cross-tenant or
//     non-member), enforcing the tenant + business scope for org Owner/Admin.
//   - BusinessAccessService.assertAllowed admits OWNER/ADMIN for
//     business:update and rejects MEMBER for business:update.

import { type ExecutionContext, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PlatformSystemAdminStatus, RoleCode } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { BusinessAccessService } from "./business-access.service.js";
import { SystemAdminGuard } from "./system-admin.guard.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const SYSTEM_ADMIN_PUBLIC_ID = "s0000000-0000-4000-8000-000000000001";
const BUSINESS_PUBLIC_ID = "b0000000-0000-4000-8000-000000000001";
const TENANT_PUBLIC_ID = "t0000000-0000-4000-8000-000000000001";

function createExecutionContext(principal: unknown): ExecutionContext {
  const request = { principal } as unknown as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createSystemAdminDatabaseMock(
  record: { id: bigint; publicId: string; status: PlatformSystemAdminStatus } | null,
): DatabaseService {
  return {
    client: {
      platformSystemAdmin: {
        findFirst: vi.fn().mockResolvedValue(record),
      },
    },
  } as unknown as DatabaseService;
}

function createBusinessAccessDatabaseMock(
  record: {
    business: { id: bigint; publicId: string; tenant: { publicId: string } };
    membership: { id: bigint; user: { id: bigint; publicId: string } };
    role: { code: RoleCode };
    tenantId: bigint;
  } | null,
): DatabaseService {
  return {
    client: {
      businessAccess: {
        findFirst: vi.fn().mockResolvedValue(record),
      },
    },
  } as unknown as DatabaseService;
}

describe("Business Admin boundary — SystemAdminGuard", () => {
  it("admits an active system admin and augments the principal with systemAdminId", async () => {
    const database = createSystemAdminDatabaseMock({
      id: 1n,
      publicId: SYSTEM_ADMIN_PUBLIC_ID,
      status: PlatformSystemAdminStatus.ACTIVE,
    });
    const systemAdminGuard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    const result = await systemAdminGuard.canActivate(ctx);

    expect(result).toBe(true);
    const request = ctx
      .switchToHttp()
      .getRequest<{ principal: { systemAdminId?: string; isSystemAdmin?: boolean } }>();
    expect(request.principal.systemAdminId).toBe(SYSTEM_ADMIN_PUBLIC_ID);
    expect(request.principal.isSystemAdmin).toBe(true);
  });

  it("rejects when principal has no systemAdminId (no PlatformSystemAdmin row) with 403", async () => {
    const database = createSystemAdminDatabaseMock(null);
    const systemAdminGuard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    await expect(systemAdminGuard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an inactive system admin with 403", async () => {
    const database = createSystemAdminDatabaseMock({
      id: 1n,
      publicId: SYSTEM_ADMIN_PUBLIC_ID,
      status: PlatformSystemAdminStatus.INACTIVE,
    });
    const systemAdminGuard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    await expect(systemAdminGuard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an unauthenticated request (no principal) with 403", async () => {
    const database = createSystemAdminDatabaseMock(null);
    const systemAdminGuard = new SystemAdminGuard(database);
    const ctx = createExecutionContext(undefined);

    await expect(systemAdminGuard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("makes @SystemAdmin() endpoints unreachable for org Owner/Admin/Member", async () => {
    // An org Owner, org Admin, and org Member all lack a PlatformSystemAdmin
    // row, so the guard rejects all of them. This is what makes
    // @SystemAdmin() endpoints unreachable for org roles.
    const database = createSystemAdminDatabaseMock(null);
    const systemAdminGuard = new SystemAdminGuard(database);

    for (const role of [RoleCode.OWNER, RoleCode.ADMIN, RoleCode.MEMBER]) {
      const ctx = createExecutionContext({ userId: USER_PUBLIC_ID, role });
      await expect(systemAdminGuard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});

describe("Business Admin boundary — BusinessAccessService", () => {
  it("resolve throws NotFound when the user has no BusinessAccess record (cross-tenant or non-member)", async () => {
    const database = createBusinessAccessDatabaseMock(null);
    const access = new BusinessAccessService(database);

    await expect(access.resolve(USER_PUBLIC_ID, BUSINESS_PUBLIC_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("resolve resolves for an org Owner with an active membership", async () => {
    const database = createBusinessAccessDatabaseMock({
      business: {
        id: 200n,
        publicId: BUSINESS_PUBLIC_ID,
        tenant: { publicId: TENANT_PUBLIC_ID },
      },
      membership: { id: 300n, user: { id: 1n, publicId: USER_PUBLIC_ID } },
      role: { code: RoleCode.OWNER },
      tenantId: 100n,
    });
    const access = new BusinessAccessService(database);

    const context = await access.resolve(USER_PUBLIC_ID, BUSINESS_PUBLIC_ID);

    expect(context.businessPublicId).toBe(BUSINESS_PUBLIC_ID);
    expect(context.tenantPublicId).toBe(TENANT_PUBLIC_ID);
    expect(context.userPublicId).toBe(USER_PUBLIC_ID);
    expect(context.role).toBe(RoleCode.OWNER);
    expect(context.membershipId).toBe(300n);
    expect(context.businessId).toBe(200n);
    expect(context.tenantId).toBe(100n);
  });

  it("assertAllowed admits an OWNER for business:update", async () => {
    const access = new BusinessAccessService(createBusinessAccessDatabaseMock(null));
    const context = {
      businessId: 200n,
      businessPublicId: BUSINESS_PUBLIC_ID,
      membershipId: 300n,
      role: RoleCode.OWNER,
      tenantId: 100n,
      tenantPublicId: TENANT_PUBLIC_ID,
      userId: 1n,
      userPublicId: USER_PUBLIC_ID,
    };

    await expect(access.assertAllowed(context, "business", "update")).resolves.toBeUndefined();
  });

  it("assertAllowed admits an ADMIN for business:update", async () => {
    const access = new BusinessAccessService(createBusinessAccessDatabaseMock(null));
    const context = {
      businessId: 200n,
      businessPublicId: BUSINESS_PUBLIC_ID,
      membershipId: 300n,
      role: RoleCode.ADMIN,
      tenantId: 100n,
      tenantPublicId: TENANT_PUBLIC_ID,
      userId: 1n,
      userPublicId: USER_PUBLIC_ID,
    };

    await expect(access.assertAllowed(context, "business", "update")).resolves.toBeUndefined();
  });

  it("assertAllowed rejects a MEMBER for business:update with NotFound", async () => {
    const access = new BusinessAccessService(createBusinessAccessDatabaseMock(null));
    const context = {
      businessId: 200n,
      businessPublicId: BUSINESS_PUBLIC_ID,
      membershipId: 300n,
      role: RoleCode.MEMBER,
      tenantId: 100n,
      tenantPublicId: TENANT_PUBLIC_ID,
      userId: 1n,
      userPublicId: USER_PUBLIC_ID,
    };

    await expect(access.assertAllowed(context, "business", "update")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("assertAllowed admits a MEMBER for business:read", async () => {
    const access = new BusinessAccessService(createBusinessAccessDatabaseMock(null));
    const context = {
      businessId: 200n,
      businessPublicId: BUSINESS_PUBLIC_ID,
      membershipId: 300n,
      role: RoleCode.MEMBER,
      tenantId: 100n,
      tenantPublicId: TENANT_PUBLIC_ID,
      userId: 1n,
      userPublicId: USER_PUBLIC_ID,
    };

    await expect(access.assertAllowed(context, "business", "read")).resolves.toBeUndefined();
  });
});
