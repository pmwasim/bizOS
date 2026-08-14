import { Reflector } from "@nestjs/core";
import { type ThrottlerStorage } from "@nestjs/throttler";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BIZO_CLIENT_IP_HEADER, BIZO_CLIENT_IP_SIGNATURE_HEADER } from "./client-ip.js";
import { ClientAwareThrottlerGuard } from "./client-aware-throttler.guard.js";

const SECRET = "test-client-ip-signature-secret-at-least-32b";

const baseEnvironment = {
  DATABASE_URL: "postgresql://bizo:test@localhost:5432/bizo",
  INTERNAL_AUTH_SECRET: "test-internal-auth-secret-at-least-32-bytes",
  SMTP_FROM: "quotes@example.test",
  SMTP_URL: "smtp://localhost:1025",
};

function sign(ip: string, timestamp: number): string {
  const signature = createHmac("sha256", SECRET).update(`${ip}.${timestamp}`).digest("hex");
  return `${timestamp}.${signature}`;
}

function createGuard(): ClientAwareThrottlerGuard {
  const storage = { increment: vi.fn() } as unknown as ThrottlerStorage;
  return new ClientAwareThrottlerGuard([], storage, new Reflector());
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    ip: "198.51.100.7",
    socket: { remoteAddress: "198.51.100.7" },
    body: {},
    ...overrides,
  } as never;
}

describe("ClientAwareThrottlerGuard.getTracker", () => {
  const originalEnvironment = { ...process.env };
  let guard: ClientAwareThrottlerGuard;

  beforeEach(() => {
    Object.assign(process.env, baseEnvironment);
    delete process.env.CLIENT_IP_SIGNATURE_SECRET;
    guard = createGuard();
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("keys on the account email when present (per-account throttling)", async () => {
    const tracker = await guard["getTracker"](
      request({ body: { email: "  Victim@Example.COM " } }),
    );
    expect(tracker).toBe("victim@example.com");
  });

  it("falls back to the peer address when no email and no secret is configured", async () => {
    const tracker = await guard["getTracker"](request());
    expect(tracker).toBe("198.51.100.7");
  });

  it("trusts a forwarded IP without a signature when no secret is configured (local dev)", async () => {
    const tracker = await guard["getTracker"](
      request({ headers: { [BIZO_CLIENT_IP_HEADER]: "203.0.113.10" } }),
    );
    expect(tracker).toBe("203.0.113.10");
  });

  it("honours a correctly signed forwarded IP when the secret is set", async () => {
    process.env.CLIENT_IP_SIGNATURE_SECRET = SECRET;
    const now = Date.now();
    const tracker = await guard["getTracker"](
      request({
        headers: {
          [BIZO_CLIENT_IP_HEADER]: "203.0.113.10",
          [BIZO_CLIENT_IP_SIGNATURE_HEADER]: sign("203.0.113.10", now),
        },
      }),
    );
    expect(tracker).toBe("203.0.113.10");
  });

  it("ignores a forged forwarded IP and uses the peer address when the secret is set", async () => {
    process.env.CLIENT_IP_SIGNATURE_SECRET = SECRET;
    const tracker = await guard["getTracker"](
      request({
        headers: {
          [BIZO_CLIENT_IP_HEADER]: "203.0.113.10",
          [BIZO_CLIENT_IP_SIGNATURE_HEADER]: "bad",
        },
      }),
    );
    expect(tracker).toBe("198.51.100.7");
  });

  it("ignores an unsigned forwarded IP and uses the peer address when the secret is set", async () => {
    process.env.CLIENT_IP_SIGNATURE_SECRET = SECRET;
    const tracker = await guard["getTracker"](
      request({ headers: { [BIZO_CLIENT_IP_HEADER]: "203.0.113.10" } }),
    );
    expect(tracker).toBe("198.51.100.7");
  });
});
