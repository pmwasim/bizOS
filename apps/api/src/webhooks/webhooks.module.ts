import { Module } from "@nestjs/common";

import { WebhookDispatchService } from "./webhook-dispatch.service.js";
import { WebhooksController } from "./webhooks.controller.js";
import { WebhooksService } from "./webhooks.service.js";

/**
 * Outbound webhooks: endpoint management, signed dispatch, and the durable retry queue. Exports
 * `WebhookDispatchService` so domain modules can enqueue events onto the queue (the domain-event
 * consumer seam), and the queue is drained by the poll-based worker `WebhookDispatchService.tick`.
 */
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDispatchService],
  exports: [WebhooksService, WebhookDispatchService],
})
export class WebhooksModule {}
