import { Controller, Get, Inject, Param } from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { StatementsService } from "./statements.service.js";

@Controller("businesses/:businessId/statements")
export class StatementsController {
  constructor(@Inject(StatementsService) private readonly statements: StatementsService) {}

  @Get("customers/:customerId")
  getCustomerStatement(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.statements.getCustomerStatement(principal.userId, businessId, customerId);
  }
}
