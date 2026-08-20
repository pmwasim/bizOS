import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  type CreateWebhookEndpointRequest,
  type IssuedWebhookEndpoint,
  type UpdateWebhookEndpointRequest,
  type WebhookEndpoint,
  type WebhookEventType,
  webhookEventTypeSchema,
} from "@bizo/contracts/webhooks";
import { WebhookEndpointStatus } from "@bizo/database";

import {
  type BusinessAccessContext,
  BusinessAccessService,
} from "../security/business-access.service.js";
import { DatabaseService } from "../database/database.service.js";
import { encryptWebhookSecret, resolveWebhookEncryptionKey } from "./webhook-secret-cipher.js";
import { generateWebhookSecret } from "./webhook-signature.js";
import { assertSafeWebhookUrl, UnsafeWebhookUrlError } from "./webhook-url.js";

interface WebhookEndpointRecord {
  publicId: string;
  url: string;
  events: string[];
  status: WebhookEndpointStatus;
  createdAt: Date;
  updatedAt: Date;
}

function onlyKnownEvents(events: readonly string[]): WebhookEventType[] {
  return events.filter(
    (event): event is WebhookEventType => webhookEventTypeSchema.safeParse(event).success,
  );
}

function toEndpoint(record: WebhookEndpointRecord): WebhookEndpoint {
  return {
    id: record.publicId,
    url: record.url,
    events: onlyKnownEvents(record.events),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Management of a business's outbound webhook endpoints. Operated by authenticated humans through
 * the app, so it sits behind the global `InternalAuthGuard` (JWT) and enforces per-role `webhooks`
 * permissions and tenant scoping on every call — matching the API-key management surface.
 */
@Injectable()
export class WebhooksService {
  private readonly encryptionKey = resolveWebhookEncryptionKey();

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(BusinessAccessService) private readonly businessAccess: BusinessAccessService,
  ) {}

  async create(
    userPublicId: string,
    businessPublicId: string,
    input: CreateWebhookEndpointRequest,
  ): Promise<IssuedWebhookEndpoint> {
    const access = await this.authorize(userPublicId, businessPublicId, "create");
    this.assertUrlAllowed(input.url);

    const secret = generateWebhookSecret();
    const record = await this.database.client.webhookEndpoint.create({
      data: {
        tenantId: access.tenantId,
        businessId: access.businessId,
        url: input.url,
        events: input.events,
        encryptedSecret: encryptWebhookSecret(secret, this.encryptionKey),
        status: WebhookEndpointStatus.ACTIVE,
      },
    });

    return { ...toEndpoint(record), secret };
  }

  async list(userPublicId: string, businessPublicId: string): Promise<WebhookEndpoint[]> {
    const access = await this.authorize(userPublicId, businessPublicId, "read");
    const records = await this.database.client.webhookEndpoint.findMany({
      where: { tenantId: access.tenantId, businessId: access.businessId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toEndpoint);
  }

  async update(
    userPublicId: string,
    businessPublicId: string,
    endpointPublicId: string,
    input: UpdateWebhookEndpointRequest,
  ): Promise<WebhookEndpoint> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    const existing = await this.findScopedEndpoint(access, endpointPublicId);
    if (input.url !== undefined) {
      this.assertUrlAllowed(input.url);
    }

    const record = await this.database.client.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        url: input.url ?? undefined,
        events: input.events ?? undefined,
        status: input.status ?? undefined,
      },
    });
    return toEndpoint(record);
  }

  /** Disables an endpoint so it stops receiving deliveries. Convenience wrapper over `update`. */
  async disable(
    userPublicId: string,
    businessPublicId: string,
    endpointPublicId: string,
  ): Promise<WebhookEndpoint> {
    return this.update(userPublicId, businessPublicId, endpointPublicId, {
      status: "DISABLED",
    });
  }

  /**
   * Issues a fresh signing secret on the same endpoint. The previous secret stops validating
   * immediately because the stored ciphertext is overwritten; the new plaintext is returned once.
   */
  async rotateSecret(
    userPublicId: string,
    businessPublicId: string,
    endpointPublicId: string,
  ): Promise<IssuedWebhookEndpoint> {
    const access = await this.authorize(userPublicId, businessPublicId, "update");
    const existing = await this.findScopedEndpoint(access, endpointPublicId);
    const secret = generateWebhookSecret();

    const record = await this.database.client.webhookEndpoint.update({
      where: { id: existing.id },
      data: { encryptedSecret: encryptWebhookSecret(secret, this.encryptionKey) },
    });
    return { ...toEndpoint(record), secret };
  }

  private assertUrlAllowed(url: string): void {
    try {
      assertSafeWebhookUrl(url);
    } catch (error) {
      if (error instanceof UnsafeWebhookUrlError) {
        throw new BadRequestException({ code: "UNSAFE_WEBHOOK_URL", detail: error.message });
      }
      throw error;
    }
  }

  private async findScopedEndpoint(
    access: BusinessAccessContext,
    endpointPublicId: string,
  ): Promise<{ id: bigint }> {
    const existing = await this.database.client.webhookEndpoint.findFirst({
      where: {
        publicId: endpointPublicId,
        tenantId: access.tenantId,
        businessId: access.businessId,
      },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("We could not find that webhook endpoint.");
    }
    return existing;
  }

  private async authorize(
    userPublicId: string,
    businessPublicId: string,
    action: "create" | "read" | "update",
  ): Promise<BusinessAccessContext> {
    const access = await this.businessAccess.resolve(userPublicId, businessPublicId);
    await this.businessAccess.assertAllowed(access, "webhooks", action);
    return access;
  }
}
