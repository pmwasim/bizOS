import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { ApiKeysService } from "./api-keys.service.js";
import { createApiKeyRequestSchema } from "./api-keys.schema.js";

@Controller("businesses/:businessId/api-keys")
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private readonly apiKeys: ApiKeysService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createApiKeyRequestSchema)) input: { name: string; scopes: string[] },
    @RequestId() _requestId: string,
  ) {
    return this.apiKeys.create({
      businessPublicId: businessId,
      name: input.name,
      scopes: input.scopes,
    });
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.apiKeys.list(businessId);
  }
}
