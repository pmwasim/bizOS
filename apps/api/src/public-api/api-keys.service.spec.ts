import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeyStatus } from "@bizo/database";

import { type BusinessAccessService } from "../security/business-access.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { ApiKeysService, hashApiKeySecret, verifyApiKeySecret } from "./api-keys.service.js";

const ACCESS = {
  businessId: 11n,
  businessPublicId: "60d73986-e757-4629-9e20-d6f851e58b02",
  membershipId: 13n,
  role: "OWNER" as const,
  tenantId: 17n,
  tenantPublicId: "3cd6c286-3efe-4990-8dbf-ca9c06c3e423",
  userId: 19n,
  userPublicId: "9dc31c21-87e7-4aa5-a1ac-648ebc812028",
};

function createBusinessAccessMock(): {
  service: BusinessAccessService;
  assertAllowed: ReturnType<typeof vi.fn>;
} {
  const assertAllowed = vi.fn().mockResolvedValue(undefined);
  const service = {
    resolve: vi.fn().mockResolvedValue(ACCESS),
    assertAllowed,
  } as unknown as BusinessAccessService;
  return { service, assertAllowed };
}

interface ApiKeyRow {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  businessId: bigint;
  name: string;
  prefix: string;
  secretHash: string;
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  business?: { publicId: string };
}

function baseRow(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: 1n,
    publicId: "aaaaaaaa-0000-4000-8000-000000000001",
    tenantId: ACCESS.tenantId,
    businessId: ACCESS.businessId,
    name: "Test key",
    prefix: "bzo_00000000",
    secretHash: "x".repeat(64),
    scopes: ["invoices:read"],
    status: ApiKeyStatus.ACTIVE,
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    business: { publicId: ACCESS.businessPublicId },
    ...overrides,
  };
}

function createDatabaseMock(client: Record<string, unknown>): DatabaseService {
  return { client } as unknown as DatabaseService;
}

describe("hashApiKeySecret / verifyApiKeySecret", () => {
  it("produces a 64-char hex digest and verifies the matching secret", () => {
    const secret = "bzo_deadbeef";
    const hash = hashApiKeySecret(secret);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyApiKeySecret(secret, hash)).toBe(true);
  });

  it("rejects a non-matching secret", () => {
    const hash = hashApiKeySecret("bzo_correct");

    expect(verifyApiKeySecret("bzo_wrong", hash)).toBe(false);
  });

  it("never stores the plaintext secret (hash differs from input)", () => {
    const secret = "bzo_plaintext";
    expect(hashApiKeySecret(secret)).not.toContain(secret);
  });
});

describe("ApiKeysService.create", () => {
  it("issues a key, returns the plaintext secret once, and persists only the hash", async () => {
    let persisted: Record<string, unknown> = {};
    const create = vi
      .fn()
      .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        persisted = data;
        return baseRow({
          name: data.name as string,
          prefix: data.prefix as string,
          secretHash: data.secretHash as string,
          scopes: data.scopes as string[],
        });
      });
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(createDatabaseMock({ apiKey: { create } }), access);

    const issued = await service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
      name: "CI",
      scopes: ["invoices:read"],
      expiresAt: null,
    });

    expect(issued.secret.startsWith("bzo_")).toBe(true);
    expect(persisted.secretHash).toBe(hashApiKeySecret(issued.secret));
    expect(persisted).not.toHaveProperty("secret");
    expect(issued.prefix).toBe(issued.secret.slice(0, 12));
  });
});

describe("ApiKeysService.authenticate", () => {
  it("resolves an active, matching, unexpired key and stamps lastUsedAt", async () => {
    const secret = "bzo_1234567890abcdef";
    const update = vi.fn().mockResolvedValue(baseRow());
    const findMany = vi.fn().mockResolvedValue([baseRow({ secretHash: hashApiKeySecret(secret) })]);
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findMany, update } }),
      access,
    );

    const principal = await service.authenticate(secret);

    expect(principal).not.toBeNull();
    expect(principal?.businessPublicId).toBe(ACCESS.businessPublicId);
    expect(principal?.scopes).toEqual(["invoices:read"]);
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects a key whose secret does not match (fail closed)", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([baseRow({ secretHash: hashApiKeySecret("bzo_theRealOne") })]);
    const update = vi.fn();
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findMany, update } }),
      access,
    );

    expect(await service.authenticate("bzo_animposter")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an expired key even when the secret matches", async () => {
    const secret = "bzo_expiredsecret";
    const findMany = vi.fn().mockResolvedValue([
      baseRow({
        secretHash: hashApiKeySecret(secret),
        expiresAt: new Date("2026-08-19T00:00:00.000Z"),
      }),
    ]);
    const update = vi.fn();
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findMany, update } }),
      access,
    );

    const decision = await service.authenticate(secret, new Date("2026-08-20T00:00:00.000Z"));

    expect(decision).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("only queries ACTIVE keys, so revoked keys are never candidates", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findMany, update: vi.fn() } }),
      access,
    );

    expect(await service.authenticate("bzo_whatever")).toBeNull();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ApiKeyStatus.ACTIVE }),
      }),
    );
  });

  it("rejects a key that does not carry the bzo_ prefix without hitting the database", async () => {
    const findMany = vi.fn();
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findMany, update: vi.fn() } }),
      access,
    );

    expect(await service.authenticate("sk_live_nope")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("ApiKeysService.revoke / rotate", () => {
  let update: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    update = vi.fn().mockResolvedValue(baseRow({ status: ApiKeyStatus.REVOKED }));
    findFirst = vi.fn().mockResolvedValue({ id: 1n });
  });

  it("revoke sets status REVOKED for a key scoped to the caller's business", async () => {
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findFirst, update } }),
      access,
    );

    const result = await service.revoke(ACCESS.userPublicId, ACCESS.businessPublicId, "pub");

    expect(result.status).toBe("REVOKED");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ApiKeyStatus.REVOKED }),
      }),
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: ACCESS.tenantId,
          businessId: ACCESS.businessId,
        }),
      }),
    );
  });

  it("rotate issues a new secret on the same key and returns it once", async () => {
    let persisted: Record<string, unknown> = {};
    update = vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      persisted = data;
      return baseRow({ prefix: data.prefix as string, secretHash: data.secretHash as string });
    });
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findFirst, update } }),
      access,
    );

    const issued = await service.rotate(ACCESS.userPublicId, ACCESS.businessPublicId, "pub");

    expect(issued.secret.startsWith("bzo_")).toBe(true);
    expect(persisted.secretHash).toBe(hashApiKeySecret(issued.secret));
  });

  it("revoke throws NotFound when the key is not in the caller's business", async () => {
    findFirst = vi.fn().mockResolvedValue(null);
    const { service: access } = createBusinessAccessMock();
    const service = new ApiKeysService(
      createDatabaseMock({ apiKey: { findFirst, update } }),
      access,
    );

    await expect(
      service.revoke(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
