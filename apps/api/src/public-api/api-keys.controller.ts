import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";

import { type CreateApiKeyRequest, createApiKeyRequestSchema } from "@bizo/contracts/api-keys";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { ApiKeysService } from "./api-keys.service.js";

/**
 * Management endpoints for a business's API keys. These are operated by authenticated humans
 * through the app, so they sit behind the global `InternalAuthGuard` (JWT) like every other
 * business-scoped route — not behind the API-key guard, which authenticates programmatic callers of
 * the public data API.
 */
@Controller("businesses/:businessId/api-keys")
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private readonly apiKeys: ApiKeysService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createApiKeyRequestSchema)) input: CreateApiKeyRequest,
  ) {
    return this.apiKeys.create(principal.userId, businessId, input);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.apiKeys.list(principal.userId, businessId);
  }

  @Post(":keyId/rotate")
  rotate(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("keyId") keyId: string,
  ) {
    return this.apiKeys.rotate(principal.userId, businessId, keyId);
  }

  @Delete(":keyId")
  revoke(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("keyId") keyId: string,
  ) {
    return this.apiKeys.revoke(principal.userId, businessId, keyId);
  }
}
