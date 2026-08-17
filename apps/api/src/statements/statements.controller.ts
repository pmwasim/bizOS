import { Controller, Get, Inject, Param, Query } from "@nestjs/common";

import {
  receivablesQuerySchema,
  statementQuerySchema,
  type ReceivablesQuery,
  type StatementQuery,
} from "@bizo/contracts/statements";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { StatementsService } from "./statements.service.js";

@Controller("businesses/:businessId/statements")
export class StatementsController {
  constructor(@Inject(StatementsService) private readonly statements: StatementsService) {}

  /** Everything the business is owed, with each customer's ageing. */
  @Get("receivables")
  receivables(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(receivablesQuerySchema)) query: ReceivablesQuery,
  ) {
    return this.statements.receivables(principal.userId, businessId, query);
  }

  @Get("customers/:customerId")
  customer(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
    @Query(new ContractPipe(statementQuerySchema)) query: StatementQuery,
  ) {
    return this.statements.customer(principal.userId, businessId, customerId, query);
  }
}
