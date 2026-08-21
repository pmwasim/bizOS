import { Controller, Get, Inject } from "@nestjs/common";

import { type BillingEntitlementsResponse } from "@bizo/contracts/billing";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { BillingService } from "./billing.service.js";

@Controller("billing")
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Get("entitlements")
  entitlements(
    @Principal() principal: AuthenticatedPrincipal,
  ): Promise<BillingEntitlementsResponse> {
    return this.billing.getEntitlementsForUser(principal.userId);
  }
}
