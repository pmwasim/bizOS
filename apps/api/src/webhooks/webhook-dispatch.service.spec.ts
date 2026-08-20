import { describe, expect, it, vi } from "vitest";

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ??= "test-webhook-encryption-key-0123456789";

import { WebhookDeliveryStatus, WebhookEndpointStatus } from "@bizo/database";

import { type DatabaseService } from "../database/database.service.js";
import { WEBHOOK_MAX_ATTEMPTS } from "./webhook-backoff.js";
import { WebhookDispatchService } from "./webhook-dispatch.service.js";
import { encryptWebhookSecret, resolveWebhookEncryptionKey } from "./webhook-secret-cipher.js";
import { verifyWebhookSignature } from "./webhook-signature.js";
import { type HostLookup } from "./webhook-url.js";

const KEY = resolveWebhookEncryptionKey(process.env);
const SECRET = `whsec_${"a".repeat(64)}`;
const PUBLIC_LOOKUP: HostLookup = async () => [{ address: "93.184.216.34" }];

function createDatabaseMock(client: Record<string, unknown>): DatabaseService {
  return { client } as unknown as DatabaseService;
}

interface DueDelivery {
  id: bigint;
  publicId: string;
  eventType: string;
  attemptCount: number;
  payload: unknown;
  endpoint: { url: string; status: WebhookEndpointStatus; encryptedSecret: string };
}

function dueDelivery(overrides: Partial<DueDelivery> = {}): DueDelivery {
  return {
    id: 1n,
    publicId: "dddddddd-0000-4000-8000-000000000001",
    eventType: "invoice.paid",
    attemptCount: 0,
    payload: { invoiceId: "inv_1" },
    endpoint: {
      url: "https://hooks.example.com/ingest",
      status: WebhookEndpointStatus.ACTIVE,
      encryptedSecret: encryptWebhookSecret(SECRET, KEY),
      ...overrides.endpoint,
    },
    ...overrides,
  };
}

function deliveryClientFor(delivery: DueDelivery) {
  const update = vi.fn().mockResolvedValue({});
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const findMany = vi.fn().mockResolvedValue([delivery]);
  return { client: { webhookDelivery: { findMany, updateMany, update } }, update, updateMany };
}

describe("WebhookDispatchService.enqueue", () => {
  it("creates a PENDING delivery for every active subscribed endpoint", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 5n }, { id: 6n }]);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new WebhookDispatchService(
      createDatabaseMock({ webhookEndpoint: { findMany }, webhookDelivery: { createMany } }),
    );

    const count = await service.enqueue({
      tenantId: 17n,
      businessId: 11n,
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_1" },
    });

    expect(count).toBe(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 17n,
          businessId: 11n,
          status: WebhookEndpointStatus.ACTIVE,
          events: { has: "invoice.paid" },
        }),
      }),
    );
    const rows = createMany.mock.calls[0]![0].data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      endpointId: 5n,
      eventType: "invoice.paid",
      status: WebhookDeliveryStatus.PENDING,
      attemptCount: 0,
    });
  });

  it("enqueues nothing when no endpoint subscribes to the event", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const createMany = vi.fn();
    const service = new WebhookDispatchService(
      createDatabaseMock({ webhookEndpoint: { findMany }, webhookDelivery: { createMany } }),
    );

    const count = await service.enqueue({
      tenantId: 17n,
      businessId: 11n,
      eventType: "invoice.paid",
      payload: {},
    });

    expect(count).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("WebhookDispatchService.tick — delivery", () => {
  it("signs the payload and marks the delivery DELIVERED on a 2xx response", async () => {
    const delivery = dueDelivery();
    const { client, update } = deliveryClientFor(delivery);
    const now = new Date("2026-08-20T00:00:00.000Z");
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 202 } as Response);
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ now, fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result).toMatchObject({ processed: 1, delivered: 1, failed: 0, dead: 0 });

    const [, init] = fetchFn.mock.calls[0]!;
    const headers = init.headers as Record<string, string>;
    const timestamp = headers["X-Bizo-Timestamp"]!;
    const signature = headers["X-Bizo-Signature"]!;
    expect(headers["X-Bizo-Event"]).toBe("invoice.paid");
    expect(headers["X-Bizo-Delivery"]).toBe(delivery.publicId);
    expect(verifyWebhookSignature(SECRET, timestamp, init.body as string, signature)).toBe(true);
    // A tampered body must not verify against the sent signature.
    expect(verifyWebhookSignature(SECRET, timestamp, `${init.body as string}x`, signature)).toBe(
      false,
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WebhookDeliveryStatus.DELIVERED,
          responseStatusCode: 202,
          nextAttemptAt: null,
          lastError: null,
        }),
      }),
    );
  });
});

describe("WebhookDispatchService.tick — retry and dead-letter", () => {
  it("schedules a backoff retry (FAILED) on a non-2xx response below the attempt budget", async () => {
    const delivery = dueDelivery({ attemptCount: 1 });
    const { client, update } = deliveryClientFor(delivery);
    const now = new Date("2026-08-20T00:00:00.000Z");
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ now, fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result).toMatchObject({ failed: 1, delivered: 0, dead: 0 });
    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.status).toBe(WebhookDeliveryStatus.FAILED);
    expect(data.attemptCount).toBe(2);
    expect(data.responseStatusCode).toBe(500);
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
    expect((data.nextAttemptAt as Date).getTime()).toBeGreaterThan(now.getTime());
    expect(typeof data.lastError).toBe("string");
  });

  it("dead-letters (DEAD) once the attempt budget is exhausted", async () => {
    const delivery = dueDelivery({ attemptCount: WEBHOOK_MAX_ATTEMPTS - 1 });
    const { client, update } = deliveryClientFor(delivery);
    const now = new Date("2026-08-20T00:00:00.000Z");
    const fetchFn = vi.fn().mockRejectedValue(new Error("connection refused"));
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ now, fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result).toMatchObject({ dead: 1, delivered: 0, failed: 0 });
    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.status).toBe(WebhookDeliveryStatus.DEAD);
    expect(data.attemptCount).toBe(WEBHOOK_MAX_ATTEMPTS);
    expect(data.nextAttemptAt).toBeNull();
  });

  it("does not process a row that a concurrent worker already claimed", async () => {
    const delivery = dueDelivery();
    const { client, update, updateMany } = deliveryClientFor(delivery);
    updateMany.mockResolvedValue({ count: 0 });
    const fetchFn = vi.fn();
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result.processed).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("WebhookDispatchService.tick — fail-closed guards", () => {
  it("dead-letters without sending when the target resolves to a private address", async () => {
    const delivery = dueDelivery({
      endpoint: {
        url: "http://10.0.0.1/hook",
        status: WebhookEndpointStatus.ACTIVE,
        encryptedSecret: encryptWebhookSecret(SECRET, KEY),
      },
    });
    const { client, update } = deliveryClientFor(delivery);
    const fetchFn = vi.fn();
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result.dead).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect((update.mock.calls[0]![0].data as Record<string, unknown>).status).toBe(
      WebhookDeliveryStatus.DEAD,
    );
  });

  it("dead-letters without sending when the endpoint is disabled", async () => {
    const delivery = dueDelivery({
      endpoint: {
        url: "https://hooks.example.com/ingest",
        status: WebhookEndpointStatus.DISABLED,
        encryptedSecret: encryptWebhookSecret(SECRET, KEY),
      },
    });
    const { client, update } = deliveryClientFor(delivery);
    const fetchFn = vi.fn();
    const service = new WebhookDispatchService(createDatabaseMock(client));

    const result = await service.tick({ fetchFn, hostLookup: PUBLIC_LOOKUP });

    expect(result.dead).toBe(1);
    expect(fetchFn).not.toHaveBeenCalled();
    expect((update.mock.calls[0]![0].data as Record<string, unknown>).status).toBe(
      WebhookDeliveryStatus.DEAD,
    );
  });
});
