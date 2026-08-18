import { Controller, Get, Inject, Param, Query } from "@nestjs/common";

import {
  payablesQuerySchema,
  receivablesQuerySchema,
  statementQuerySchema,
  type PayablesQuery,
  type ReceivablesQuery,
  type StatementQuery,
} from "@bizo/contracts/statements";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { PayablesService } from "./payables.service.js";
import { StatementsService } from "./statements.service.js";

@Controller("businesses/:businessId/statements")
export class StatementsController {
  constructor(
    @Inject(StatementsService) private readonly statements: StatementsService,
    @Inject(PayablesService) private readonly payables: PayablesService,
  ) {}

  /** Everything the business owes its suppliers, with each supplier's ageing. */
  @Get("payables")
  payablesSummary(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(payablesQuerySchema)) query: PayablesQuery,
  ) {
    return this.payables.payables(principal.userId, businessId, query);
  }

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
