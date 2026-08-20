import { Inject, Injectable, Logger } from "@nestjs/common";

import { type Prisma, WebhookDeliveryStatus, WebhookEndpointStatus } from "@bizo/database";
import { type WebhookEventType } from "@bizo/contracts/webhooks";

import { DatabaseService } from "../database/database.service.js";
import { hasReachedMaxAttempts, nextAttemptAt } from "./webhook-backoff.js";
import { decryptWebhookSecret, resolveWebhookEncryptionKey } from "./webhook-secret-cipher.js";
import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  webhookSignatureHeader,
} from "./webhook-signature.js";
import {
  assertResolvableToPublicAddress,
  type HostLookup,
  UnsafeWebhookUrlError,
} from "./webhook-url.js";

/** A domain event to fan out to subscribed endpoints. Mirrors the shape of an OutboxEvent row. */
export interface WebhookDomainEvent {
  tenantId: bigint;
  businessId: bigint;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}

export interface WebhookTickOptions {
  now?: Date;
  limit?: number;
  fetchFn?: typeof fetch;
  hostLookup?: HostLookup;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

export interface WebhookTickResult {
  processed: number;
  delivered: number;
  failed: number;
  dead: number;
}

const MAX_ERROR_LENGTH = 500;
const DEFAULT_TICK_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
// A claim lease: a row left DELIVERING longer than this is assumed abandoned (the worker crashed or
// was killed mid-attempt) and is reclaimed on a later tick, preserving the at-least-once guarantee.
// Comfortably larger than DEFAULT_TIMEOUT_MS so an in-flight delivery is never stolen from a live worker.
const DELIVERING_LEASE_MS = 60_000;

function truncateError(message: string): string {
  return message.length > MAX_ERROR_LENGTH ? message.slice(0, MAX_ERROR_LENGTH) : message;
}

/**
 * Fans domain events out onto the durable webhook delivery queue and drives that queue.
 *
 * This is the webhook subsystem's outbox: `enqueue` is the domain-event consumer seam — a domain
 * flow calls it (optionally inside the same transaction in which it writes its `OutboxEvent` row),
 * so webhooks are a consumer of domain events rather than a parallel mechanism. Each enqueued
 * `WebhookDelivery` row carries the same durable-worker fields as `OutboxEvent`
 * (attemptCount↔attempts, nextAttemptAt↔availableAt, DELIVERED↔published). `tick` is the poll-based
 * worker that claims due rows, signs and sends them, and applies backoff / dead-lettering.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);
  private readonly encryptionKey = resolveWebhookEncryptionKey();

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /**
   * Enqueues a PENDING delivery for every ACTIVE endpoint in the business subscribed to the event.
   * Accepts an optional transaction client so a domain flow can enqueue atomically alongside its
   * own writes. Returns the number of deliveries enqueued.
   */
  async enqueue(event: WebhookDomainEvent, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx ?? this.database.client;
    const endpoints = await client.webhookEndpoint.findMany({
      where: {
        tenantId: event.tenantId,
        businessId: event.businessId,
        status: WebhookEndpointStatus.ACTIVE,
        events: { has: event.eventType },
      },
      select: { id: true },
    });
    if (endpoints.length === 0) {
      return 0;
    }

    const now = new Date();
    await client.webhookDelivery.createMany({
      data: endpoints.map((endpoint: { id: bigint }) => ({
        tenantId: event.tenantId,
        endpointId: endpoint.id,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: now,
      })),
    });
    return endpoints.length;
  }

  /**
   * Poll-based worker. Claims deliveries whose next attempt is due (PENDING or FAILED with
   * `nextAttemptAt <= now`), delivers them, and transitions each to DELIVERED, or reschedules with
   * exponential backoff, or dead-letters (DEAD) once the attempt budget is exhausted.
   */
  async tick(options: WebhookTickOptions = {}): Promise<WebhookTickResult> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? DEFAULT_TICK_LIMIT;
    const fetchFn = options.fetchFn ?? fetch;
    const hostLookup = options.hostLookup;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const result: WebhookTickResult = { processed: 0, delivered: 0, failed: 0, dead: 0 };

    const staleBefore = new Date(now.getTime() - DELIVERING_LEASE_MS);
    // Due = fresh work (PENDING/FAILED past its next-attempt time) OR an abandoned claim: a row stuck
    // in DELIVERING past the lease because the worker that claimed it died before finishing.
    const dueFilter: Prisma.WebhookDeliveryWhereInput["OR"] = [
      {
        status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED] },
        nextAttemptAt: { lte: now },
      },
      { status: WebhookDeliveryStatus.DELIVERING, updatedAt: { lte: staleBefore } },
    ];
    const due = await this.database.client.webhookDelivery.findMany({
      where: { OR: dueFilter },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      include: {
        endpoint: { select: { url: true, status: true, encryptedSecret: true } },
      },
    });

    for (const delivery of due) {
      // Atomically claim the row so a concurrent worker cannot process it twice. The claim only
      // succeeds if the row still matches the due filter (unclaimed, or a lease-expired DELIVERING),
      // so a live worker's in-flight row is never stolen.
      const claim = await this.database.client.webhookDelivery.updateMany({
        where: { id: delivery.id, OR: dueFilter },
        data: { status: WebhookDeliveryStatus.DELIVERING },
      });
      if (claim.count === 0) {
        continue;
      }
      result.processed += 1;

      const outcome = await this.attemptDelivery(delivery, { now, fetchFn, hostLookup, timeoutMs });
      result[outcome] += 1;
    }

    return result;
  }

  private async attemptDelivery(
    delivery: {
      id: bigint;
      publicId: string;
      eventType: string;
      attemptCount: number;
      payload: Prisma.JsonValue;
      endpoint: { url: string; status: WebhookEndpointStatus; encryptedSecret: string };
    },
    context: {
      now: Date;
      fetchFn: typeof fetch;
      hostLookup?: HostLookup | undefined;
      timeoutMs: number;
    },
  ): Promise<"delivered" | "failed" | "dead"> {
    // A disabled endpoint is terminal: dead-letter without consuming the retry budget.
    if (delivery.endpoint.status !== WebhookEndpointStatus.ACTIVE) {
      await this.markDead(delivery.id, delivery.attemptCount, null, "The endpoint is disabled.");
      return "dead";
    }

    // Fail-closed SSRF re-check immediately before the outbound request. A blocked target is
    // terminal (the URL will not become safe), so dead-letter it.
    try {
      await assertResolvableToPublicAddress(delivery.endpoint.url, context.hostLookup);
    } catch (error) {
      const reason =
        error instanceof UnsafeWebhookUrlError ? error.message : "The webhook URL was rejected.";
      await this.markDead(delivery.id, delivery.attemptCount, null, reason);
      return "dead";
    }

    const timestamp = Math.floor(context.now.getTime() / 1000).toString();
    const body = JSON.stringify({
      id: delivery.publicId,
      event: delivery.eventType,
      createdAt: context.now.toISOString(),
      data: delivery.payload,
    });

    let secret: string;
    try {
      secret = decryptWebhookSecret(delivery.endpoint.encryptedSecret, this.encryptionKey);
    } catch {
      // A secret that cannot be decrypted can never sign; dead-letter rather than loop.
      await this.markDead(delivery.id, delivery.attemptCount, null, "Signing secret unavailable.");
      return "dead";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, context.timeoutMs);
    let responseStatus: number | null = null;
    let failureReason: string | null = null;
    try {
      const response = await context.fetchFn(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: webhookSignatureHeader(secret, timestamp, body),
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
          [WEBHOOK_EVENT_HEADER]: delivery.eventType,
          [WEBHOOK_DELIVERY_HEADER]: delivery.publicId,
          "user-agent": "bizOS-Webhooks/1.0",
        },
        body,
        signal: controller.signal,
        // Never follow redirects: only the original URL passed the SSRF guard, so a redirect to a
        // private target (e.g. 169.254.169.254) would bypass every DNS/IP check. A 3xx is treated as
        // a failed delivery below.
        redirect: "manual",
      });
      responseStatus = response.status;
      if (response.status >= 300 && response.status < 400) {
        failureReason = `The endpoint returned a redirect (${response.status}); redirects are not followed.`;
      } else if (!response.ok) {
        failureReason = `The endpoint responded ${response.status}.`;
      }
    } catch (error) {
      failureReason = error instanceof Error ? error.message : "The delivery request failed.";
    } finally {
      clearTimeout(timer);
    }

    if (failureReason === null) {
      await this.database.client.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.DELIVERED,
          attemptCount: delivery.attemptCount + 1,
          responseStatusCode: responseStatus,
          nextAttemptAt: null,
          lastError: null,
        },
      });
      return "delivered";
    }

    const attempts = delivery.attemptCount + 1;
    if (hasReachedMaxAttempts(attempts)) {
      await this.markDead(delivery.id, attempts, responseStatus, failureReason);
      return "dead";
    }
    await this.database.client.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookDeliveryStatus.FAILED,
        attemptCount: attempts,
        responseStatusCode: responseStatus,
        nextAttemptAt: nextAttemptAt(attempts, context.now),
        lastError: truncateError(failureReason),
      },
    });
    return "failed";
  }

  private async markDead(
    id: bigint,
    attemptCount: number,
    responseStatus: number | null,
    reason: string,
  ): Promise<void> {
    await this.database.client.webhookDelivery.update({
      where: { id },
      data: {
        status: WebhookDeliveryStatus.DEAD,
        attemptCount,
        responseStatusCode: responseStatus,
        nextAttemptAt: null,
        lastError: truncateError(reason),
      },
    });
  }
}
