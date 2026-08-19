import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type Response } from "express";

import {
  sendStatementRequestSchema,
  type SendStatementRequest,
  statementQuerySchema,
  type StatementQuery,
} from "@bizo/contracts/statements";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { scaledThrottle } from "../security/throttle-policy.js";
import { StatementDeliveryService } from "./statement-delivery.service.js";

/**
 * PDF export and email delivery for customer statements. Kept on its own controller so the
 * statements read model and its controller stay untouched by the delivery concern.
 */
@Controller("businesses/:businessId/statements")
export class StatementDeliveryController {
  constructor(
    @Inject(StatementDeliveryService) private readonly delivery: StatementDeliveryService,
  ) {}

  @Get("customers/:customerId/pdf")
  async pdf(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
    @Query(new ContractPipe(statementQuerySchema)) query: StatementQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.delivery.renderPdf(principal.userId, businessId, customerId, query);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @Throttle(scaledThrottle({ default: { limit: 10, ttl: 60_000 } }))
  @Post("customers/:customerId/send")
  send(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
    @Body(new ContractPipe(sendStatementRequestSchema)) input: SendStatementRequest,
    @RequestId() requestId: string,
  ) {
    return this.delivery.send(principal.userId, businessId, customerId, input, requestId);
  }
}
