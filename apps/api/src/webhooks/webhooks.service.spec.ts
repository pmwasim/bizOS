import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The service derives its encryption key from the environment at construction; provide material.
process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ??= "test-webhook-encryption-key-0123456789";

import { WebhookEndpointStatus } from "@bizo/database";

import { type BusinessAccessService } from "../security/business-access.service.js";
import { type DatabaseService } from "../database/database.service.js";
import { decryptWebhookSecret, resolveWebhookEncryptionKey } from "./webhook-secret-cipher.js";
import { WebhooksService } from "./webhooks.service.js";

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

function createDatabaseMock(client: Record<string, unknown>): DatabaseService {
  return { client } as unknown as DatabaseService;
}

interface EndpointRow {
  id: bigint;
  publicId: string;
  tenantId: bigint;
  businessId: bigint;
  url: string;
  events: string[];
  encryptedSecret: string;
  status: WebhookEndpointStatus;
  createdAt: Date;
  updatedAt: Date;
}

function baseRow(overrides: Partial<EndpointRow> = {}): EndpointRow {
  return {
    id: 1n,
    publicId: "aaaaaaaa-0000-4000-8000-000000000001",
    tenantId: ACCESS.tenantId,
    businessId: ACCESS.businessId,
    url: "https://hooks.example.com/ingest",
    events: ["invoice.paid"],
    encryptedSecret: "v1:placeholder",
    status: WebhookEndpointStatus.ACTIVE,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("WebhooksService.create", () => {
  it("issues an endpoint, returns the plaintext secret once, and persists only ciphertext", async () => {
    let persisted: Record<string, unknown> = {};
    const create = vi
      .fn()
      .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        persisted = data;
        return baseRow({
          url: data.url as string,
          events: data.events as string[],
          encryptedSecret: data.encryptedSecret as string,
        });
      });
    const { service: access, assertAllowed } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { create } }),
      access,
    );

    const issued = await service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
      url: "https://hooks.example.com/ingest",
      events: ["invoice.paid"],
    });

    expect(assertAllowed).toHaveBeenCalledWith(ACCESS, "webhooks", "create");
    expect(issued.secret.startsWith("whsec_")).toBe(true);
    expect(persisted).not.toHaveProperty("secret");
    expect(persisted.encryptedSecret).not.toContain(issued.secret);
    // Ciphertext decrypts back to the issued plaintext.
    const key = resolveWebhookEncryptionKey(process.env);
    expect(decryptWebhookSecret(persisted.encryptedSecret as string, key)).toBe(issued.secret);
  });

  it("rejects an SSRF-unsafe URL at registration (fail closed)", async () => {
    const create = vi.fn();
    const { service: access } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { create } }),
      access,
    );

    await expect(
      service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
        url: "https://169.254.169.254/latest/meta-data",
        events: ["invoice.paid"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates a denied authorization and never touches the database", async () => {
    const create = vi.fn();
    const { service: access, assertAllowed } = createBusinessAccessMock();
    assertAllowed.mockRejectedValue(new NotFoundException());
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { create } }),
      access,
    );

    await expect(
      service.create(ACCESS.userPublicId, ACCESS.businessPublicId, {
        url: "https://hooks.example.com/ingest",
        events: ["invoice.paid"],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("WebhooksService.list", () => {
  it("scopes the query to the caller's tenant and business", async () => {
    const findMany = vi.fn().mockResolvedValue([baseRow()]);
    const { service: access, assertAllowed } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { findMany } }),
      access,
    );

    const result = await service.list(ACCESS.userPublicId, ACCESS.businessPublicId);

    expect(assertAllowed).toHaveBeenCalledWith(ACCESS, "webhooks", "read");
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("secret");
    expect(result[0]).not.toHaveProperty("encryptedSecret");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: ACCESS.tenantId, businessId: ACCESS.businessId },
      }),
    );
  });
});

describe("WebhooksService.update / disable", () => {
  let findFirst: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findFirst = vi.fn().mockResolvedValue({ id: 1n });
    update = vi.fn().mockResolvedValue(baseRow({ status: WebhookEndpointStatus.DISABLED }));
  });

  it("rejects an SSRF-unsafe URL on update", async () => {
    const { service: access } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { findFirst, update } }),
      access,
    );

    await expect(
      service.update(ACCESS.userPublicId, ACCESS.businessPublicId, "pub", {
        url: "https://10.0.0.1/hook",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("disable sets status DISABLED for a scoped endpoint", async () => {
    const { service: access, assertAllowed } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { findFirst, update } }),
      access,
    );

    const result = await service.disable(ACCESS.userPublicId, ACCESS.businessPublicId, "pub");

    expect(assertAllowed).toHaveBeenCalledWith(ACCESS, "webhooks", "update");
    expect(result.status).toBe("DISABLED");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISABLED" }),
      }),
    );
  });

  it("throws NotFound when the endpoint is not in the caller's business", async () => {
    findFirst = vi.fn().mockResolvedValue(null);
    const { service: access } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { findFirst, update } }),
      access,
    );

    await expect(
      service.disable(ACCESS.userPublicId, ACCESS.businessPublicId, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("WebhooksService.rotateSecret", () => {
  it("issues a fresh secret and persists new ciphertext", async () => {
    let persisted: Record<string, unknown> = {};
    const findFirst = vi.fn().mockResolvedValue({ id: 1n });
    const update = vi
      .fn()
      .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        persisted = data;
        return baseRow({ encryptedSecret: data.encryptedSecret as string });
      });
    const { service: access, assertAllowed } = createBusinessAccessMock();
    const service = new WebhooksService(
      createDatabaseMock({ webhookEndpoint: { findFirst, update } }),
      access,
    );

    const issued = await service.rotateSecret(ACCESS.userPublicId, ACCESS.businessPublicId, "pub");

    expect(assertAllowed).toHaveBeenCalledWith(ACCESS, "webhooks", "update");
    expect(issued.secret.startsWith("whsec_")).toBe(true);
    const key = resolveWebhookEncryptionKey(process.env);
    expect(decryptWebhookSecret(persisted.encryptedSecret as string, key)).toBe(issued.secret);
  });
});
