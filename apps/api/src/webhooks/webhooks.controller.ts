import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { WebhooksService } from "./webhooks.service.js";
import { createWebhookRequestSchema } from "./webhooks.schema.js";

@Controller("businesses/:businessId/webhooks")
export class WebhooksController {
  constructor(@Inject(WebhooksService) private readonly webhooks: WebhooksService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createWebhookRequestSchema)) input: { url: string; events: string[] },
    @RequestId() _requestId: string,
  ) {
    return this.webhooks.create({
      businessPublicId: businessId,
      url: input.url,
      events: input.events,
    });
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.webhooks.list(businessId);
  }
}
