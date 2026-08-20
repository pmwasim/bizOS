import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";

import { type ApiScope } from "@bizo/contracts/api-keys";

import { type ApiKeysService } from "./api-keys.service.js";
import { ApiKeyAuthGuard } from "./api-key-auth.guard.js";
import { type ApiKeyPrincipal } from "./api-key-principal.js";
import { REQUIRED_API_SCOPES } from "./require-scopes.decorator.js";

function createContext(
  headers: Record<string, string>,
  requiredScopes?: readonly ApiScope[],
): { context: ExecutionContext; request: { headers: Record<string, string>; apiKey?: unknown } } {
  const request = { headers } as { headers: Record<string, string>; apiKey?: unknown };
  const handler = (): void => undefined;
  if (requiredScopes) {
    Reflect.defineMetadata(REQUIRED_API_SCOPES, requiredScopes, handler);
  }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { context, request };
}

function principal(scopes: readonly ApiScope[]): ApiKeyPrincipal {
  return {
    keyId: "aaaaaaaa-0000-4000-8000-000000000001",
    businessId: 11n,
    businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
    tenantId: 17n,
    scopes,
  };
}

function createService(result: ApiKeyPrincipal | null): {
  service: ApiKeysService;
  authenticate: ReturnType<typeof vi.fn>;
} {
  const authenticate = vi.fn().mockResolvedValue(result);
  return { service: { authenticate } as unknown as ApiKeysService, authenticate };
}

describe("ApiKeyAuthGuard", () => {
  it("rejects a request with no key", async () => {
    const { service } = createService(null);
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a key that fails authentication (fail closed)", async () => {
    const { service } = createService(null);
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context } = createContext({ authorization: "Bearer bzo_bad" });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("admits a valid key and attaches the principal (Bearer header)", async () => {
    const { service, authenticate } = createService(principal(["invoices:read"]));
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context, request } = createContext({ authorization: "Bearer bzo_good" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("bzo_good");
    expect(request.apiKey).toBeDefined();
  });

  it("accepts the X-API-Key header as an alternative to Bearer", async () => {
    const { service, authenticate } = createService(principal(["invoices:read"]));
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context } = createContext({ "x-api-key": "bzo_headerkey" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith("bzo_headerkey");
  });

  it("admits a key that holds every required scope", async () => {
    const { service } = createService(principal(["invoices:read", "payments:read"]));
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context } = createContext({ authorization: "Bearer bzo_good" }, ["invoices:read"]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("denies a key that is missing a required scope with 403", async () => {
    const { service } = createService(principal(["invoices:read"]));
    const guard = new ApiKeyAuthGuard(new Reflector(), service);
    const { context } = createContext({ authorization: "Bearer bzo_good" }, ["invoices:write"]);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
