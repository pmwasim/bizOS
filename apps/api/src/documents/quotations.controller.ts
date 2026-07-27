import { Body, Controller, Get, Inject, Param, Post, Res, StreamableFile } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type Response } from "express";

import {
  saveQuotationRequestSchema,
  type SaveQuotationRequest,
  sendQuotationRequestSchema,
  type SendQuotationRequest,
} from "@bizo/contracts/quotations";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { QuotationsService } from "./quotations.service.js";

@Controller("businesses/:businessId/quotations")
export class QuotationsController {
  constructor(@Inject(QuotationsService) private readonly quotations: QuotationsService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(saveQuotationRequestSchema)) input: SaveQuotationRequest,
    @RequestId() requestId: string,
  ) {
    return this.quotations.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.quotations.list(principal.userId, businessId);
  }

  @Get(":quotationId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("quotationId") quotationId: string,
  ) {
    return this.quotations.get(principal.userId, businessId, quotationId);
  }

  @Get(":quotationId/pdf")
  async pdf(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("quotationId") quotationId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.quotations.renderPdf(principal.userId, businessId, quotationId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":quotationId/send")
  send(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("quotationId") quotationId: string,
    @Body(new ContractPipe(sendQuotationRequestSchema)) input: SendQuotationRequest,
    @RequestId() requestId: string,
  ) {
    return this.quotations.send(principal.userId, businessId, quotationId, input, requestId);
  }
}
