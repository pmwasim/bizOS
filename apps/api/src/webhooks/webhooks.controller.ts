import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";

import {
  type CreateWebhookEndpointRequest,
  createWebhookEndpointRequestSchema,
  type UpdateWebhookEndpointRequest,
  updateWebhookEndpointRequestSchema,
} from "@bizo/contracts/webhooks";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { WebhooksService } from "./webhooks.service.js";

/**
 * Management endpoints for a business's outbound webhook endpoints. Operated by authenticated
 * humans through the app, so — like the API-key surface — they sit behind the global
 * `InternalAuthGuard` (JWT) and enforce per-role `webhooks` permissions and tenant scoping.
 */
@Controller("businesses/:businessId/webhooks")
export class WebhooksController {
  constructor(@Inject(WebhooksService) private readonly webhooks: WebhooksService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createWebhookEndpointRequestSchema)) input: CreateWebhookEndpointRequest,
  ) {
    return this.webhooks.create(principal.userId, businessId, input);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.webhooks.list(principal.userId, businessId);
  }

  @Patch(":endpointId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("endpointId") endpointId: string,
    @Body(new ContractPipe(updateWebhookEndpointRequestSchema)) input: UpdateWebhookEndpointRequest,
  ) {
    return this.webhooks.update(principal.userId, businessId, endpointId, input);
  }

  @Post(":endpointId/disable")
  disable(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("endpointId") endpointId: string,
  ) {
    return this.webhooks.disable(principal.userId, businessId, endpointId);
  }

  @Post(":endpointId/rotate-secret")
  rotateSecret(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("endpointId") endpointId: string,
  ) {
    return this.webhooks.rotateSecret(principal.userId, businessId, endpointId);
  }
}
