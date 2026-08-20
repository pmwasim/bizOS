import { HttpException, HttpStatus, UnauthorizedException } from "@nestjs/common";
import { type ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyRateLimiter } from "./api-key-rate-limiter.js";
import { ApiKeyRateLimitGuard } from "./api-key-rate-limit.guard.js";
import { type ApiKeyPrincipal } from "./api-key-principal.js";

function principal(): ApiKeyPrincipal {
  return {
    keyId: "aaaaaaaa-0000-4000-8000-000000000001",
    businessId: 11n,
    businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
    tenantId: 17n,
    scopes: ["invoices:read"],
  };
}

function createContext(apiKey?: ApiKeyPrincipal): {
  context: ExecutionContext;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
  const request = { apiKey };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

describe("ApiKeyRateLimiter", () => {
  it("allows requests up to the limit then denies with a Retry-After hint", () => {
    const limiter = new ApiKeyRateLimiter(2, 60_000);

    expect(limiter.consume("k", 0).allowed).toBe(true);
    expect(limiter.consume("k", 10).allowed).toBe(true);
    const denied = limiter.consume("k", 20);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const limiter = new ApiKeyRateLimiter(1, 60_000);

    expect(limiter.consume("k", 0).allowed).toBe(true);
    expect(limiter.consume("k", 100).allowed).toBe(false);
    expect(limiter.consume("k", 60_001).allowed).toBe(true);
  });

  it("tracks each key independently", () => {
    const limiter = new ApiKeyRateLimiter(1, 60_000);

    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("b", 0).allowed).toBe(true);
    expect(limiter.consume("a", 0).allowed).toBe(false);
  });
});

describe("ApiKeyRateLimitGuard", () => {
  it("allows a request under the limit and sets rate-limit headers", () => {
    const guard = new ApiKeyRateLimitGuard(new ApiKeyRateLimiter(5, 60_000));
    const { context, headers } = createContext(principal());

    expect(guard.canActivate(context)).toBe(true);
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
  });

  it("throws 429 with a Retry-After header once the limit is exceeded", () => {
    const guard = new ApiKeyRateLimitGuard(new ApiKeyRateLimiter(1, 60_000));

    expect(guard.canActivate(createContext(principal()).context)).toBe(true);

    const { context, headers } = createContext(principal());
    try {
      guard.canActivate(context);
      expect.unreachable("expected a 429");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(headers["Retry-After"]).toBeDefined();
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("fails closed when no authenticated key is present on the request", () => {
    const guard = new ApiKeyRateLimitGuard(new ApiKeyRateLimiter(5, 60_000));
    const spy = vi.spyOn(ApiKeyRateLimiter.prototype, "consume");
    const { context } = createContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    spy.mockRestore();
  });
});
