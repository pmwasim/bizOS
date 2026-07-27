import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type Response } from "express";

import {
  createInvoiceFromQuotationRequestSchema,
  type CreateInvoiceFromQuotationRequest,
  sendInvoiceRequestSchema,
  type SendInvoiceRequest,
  updateInvoiceRequestSchema,
  type UpdateInvoiceRequest,
} from "@bizo/contracts/invoices";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { InvoicesService } from "./invoices.service.js";

@Controller("businesses/:businessId/invoices")
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoices: InvoicesService) {}

  @Post()
  createFromQuotation(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createInvoiceFromQuotationRequestSchema))
    input: CreateInvoiceFromQuotationRequest,
    @RequestId() requestId: string,
  ) {
    return this.invoices.createFromQuotation(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.invoices.list(principal.userId, businessId);
  }

  @Get(":invoiceId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
  ) {
    return this.invoices.get(principal.userId, businessId, invoiceId);
  }

  @Patch(":invoiceId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
    @Body(new ContractPipe(updateInvoiceRequestSchema)) input: UpdateInvoiceRequest,
    @RequestId() requestId: string,
  ) {
    return this.invoices.update(principal.userId, businessId, invoiceId, input, requestId);
  }

  @Post(":invoiceId/mark-ready")
  markReady(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
    @RequestId() requestId: string,
  ) {
    return this.invoices.markReady(principal.userId, businessId, invoiceId, requestId);
  }

  @Post(":invoiceId/archive")
  archive(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
    @RequestId() requestId: string,
  ) {
    return this.invoices.archive(principal.userId, businessId, invoiceId, requestId);
  }

  @Get(":invoiceId/pdf")
  async pdf(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.invoices.renderPdf(principal.userId, businessId, invoiceId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":invoiceId/send")
  send(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
    @Body(new ContractPipe(sendInvoiceRequestSchema)) input: SendInvoiceRequest,
    @RequestId() requestId: string,
  ) {
    return this.invoices.send(principal.userId, businessId, invoiceId, input, requestId);
  }
}
