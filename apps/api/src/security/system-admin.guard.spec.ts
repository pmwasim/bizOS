import { ForbiddenException } from "@nestjs/common";
import { type ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PlatformSystemAdminStatus } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { SystemAdminGuard } from "./system-admin.guard.js";

const USER_PUBLIC_ID = "u0000000-0000-4000-8000-000000000001";
const SYSTEM_ADMIN_PUBLIC_ID = "s0000000-0000-4000-8000-000000000001";

function createExecutionContext(principal: unknown): ExecutionContext {
  const request = { principal } as unknown as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createDatabaseMock(
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

describe("SystemAdminGuard", () => {
  it("admits an active system admin and augments the principal", async () => {
    const database = createDatabaseMock({
      id: 1n,
      publicId: SYSTEM_ADMIN_PUBLIC_ID,
      status: PlatformSystemAdminStatus.ACTIVE,
    });
    const guard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const request = ctx.switchToHttp().getRequest<{ principal: { systemAdminId?: string } }>();
    expect(request.principal.systemAdminId).toBe(SYSTEM_ADMIN_PUBLIC_ID);
  });

  it("rejects an inactive system admin with 403", async () => {
    const database = createDatabaseMock({
      id: 1n,
      publicId: SYSTEM_ADMIN_PUBLIC_ID,
      status: PlatformSystemAdminStatus.INACTIVE,
    });
    const guard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a non-admin (no PlatformSystemAdmin row) with 403", async () => {
    const database = createDatabaseMock(null);
    const guard = new SystemAdminGuard(database);
    const ctx = createExecutionContext({ userId: USER_PUBLIC_ID });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an unauthenticated request (no principal) with 403", async () => {
    const database = createDatabaseMock(null);
    const guard = new SystemAdminGuard(database);
    const ctx = createExecutionContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
