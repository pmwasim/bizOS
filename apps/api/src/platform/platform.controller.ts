import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";

import {
  createBusinessRequestSchema,
  type CreateBusinessRequest,
  updateBusinessSettingsRequestSchema,
  type UpdateBusinessSettingsRequest,
} from "@bizo/contracts/platform";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { type PlatformService } from "./platform.service.js";

@Controller("businesses")
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Post()
  createBusiness(
    @Principal() principal: AuthenticatedPrincipal,
    @Body(new ContractPipe(createBusinessRequestSchema)) input: CreateBusinessRequest,
    @RequestId() requestId: string,
  ) {
    return this.platform.createBusiness(principal.userId, input, requestId);
  }

  @Get(":businessId/settings")
  getSettings(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
  ) {
    return this.platform.getSettings(principal.userId, businessId);
  }

  @Put(":businessId/settings")
  updateSettings(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(updateBusinessSettingsRequestSchema))
    input: UpdateBusinessSettingsRequest,
    @RequestId() requestId: string,
  ) {
    return this.platform.updateSettings(principal.userId, businessId, input, requestId);
  }
}
