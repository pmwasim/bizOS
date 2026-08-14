import { Inject, Injectable, Logger } from "@nestjs/common";

import { createHmac, randomUUID } from "node:crypto";

import { DatabaseService } from "../database/database.service.js";

export interface WebhookSubscription {
  id: string;
  businessId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateWebhookInput {
  businessPublicId: string;
  url: string;
  events: string[];
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(
    input: CreateWebhookInput,
  ): Promise<{ webhook: WebhookSubscription; secret: string }> {
    const secret = `whsec_${randomUUID().replace(/-/g, "")}`;

    const business = await this.database.client.business.findUnique({
      where: { publicId: input.businessPublicId },
      select: { id: true, tenantId: true },
    });
    if (!business) throw new Error("Business not found");

    const record = await this.database.client.webhookSubscription.create({
      data: {
        tenantId: business.tenantId,
        businessId: business.id,
        url: input.url,
        events: input.events,
        secretHash: secret,
      },
    });

    return {
      webhook: {
        id: record.publicId,
        businessId: input.businessPublicId,
        url: record.url,
        events: record.events,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      },
      secret,
    };
  }

  async list(businessPublicId: string): Promise<WebhookSubscription[]> {
    const business = await this.database.client.business.findUnique({
      where: { publicId: businessPublicId },
      select: { id: true },
    });
    if (!business) return [];

    const records = await this.database.client.webhookSubscription.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });
    return records.map(
      (r: {
        publicId: string;
        url: string;
        events: string[];
        isActive: boolean;
        createdAt: Date;
      }) => ({
        id: r.publicId,
        businessId: businessPublicId,
        url: r.url,
        events: r.events,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }),
    );
  }

  async dispatch(input: {
    eventType: string;
    payload: Record<string, unknown>;
    businessPublicId: string;
  }): Promise<void> {
    const business = await this.database.client.business.findUnique({
      where: { publicId: input.businessPublicId },
      select: { id: true },
    });
    if (!business) return;

    const subscriptions = await this.database.client.webhookSubscription.findMany({
      where: { businessId: business.id, isActive: true },
    });

    for (const subscription of subscriptions) {
      if (!subscription.events.includes(input.eventType)) continue;
      await this.sendWebhook(subscription, input.eventType, input.payload);
    }
  }

  private async sendWebhook(
    subscription: { id: bigint; url: string; secretHash: string; events: string[] },
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event: eventType, timestamp, data: payload });
    const signature = createHmac("sha256", subscription.secretHash)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bizos-signature": `t=${timestamp},v1=${signature}`,
          "x-bizos-event": eventType,
          "user-agent": "bizOS-Webhook/1.0",
        },
        body,
      });

      await this.database.client.webhookDelivery.create({
        data: {
          tenantId: 0n,
          webhookSubscriptionId: subscription.id,
          eventType,
          payload: payload as never,
          statusCode: response.status,
          succeeded: response.ok,
        },
      });
    } catch (error) {
      this.logger.error(`Webhook delivery failed for ${subscription.url}`, error as Error);
      await this.database.client.webhookDelivery.create({
        data: {
          tenantId: 0n,
          webhookSubscriptionId: subscription.id,
          eventType,
          payload: payload as never,
          statusCode: 0,
          succeeded: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}
