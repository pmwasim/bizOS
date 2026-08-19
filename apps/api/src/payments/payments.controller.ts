import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { type Response } from "express";

import { type RecordPaymentRequest, recordPaymentRequestSchema } from "@bizo/contracts/payments";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { PaymentsService } from "./payments.service.js";

@Controller("businesses/:businessId/payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(recordPaymentRequestSchema)) input: RecordPaymentRequest,
    @RequestId() requestId: string,
  ) {
    return this.payments.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.payments.list(principal.userId, businessId);
  }

  @Get(":paymentId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
  ) {
    return this.payments.get(principal.userId, businessId, paymentId);
  }

  @Get(":paymentId/pdf")
  async pdf(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.payments.renderReceipt(principal.userId, businessId, paymentId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }

  @Put(":paymentId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @Body(new ContractPipe(recordPaymentRequestSchema)) input: RecordPaymentRequest,
    @RequestId() requestId: string,
  ) {
    return this.payments.update(principal.userId, businessId, paymentId, input, requestId);
  }

  @Patch(":paymentId/status/complete")
  markAsCompleted(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @RequestId() requestId: string,
  ) {
    return this.payments.markAsCompleted(principal.userId, businessId, paymentId, requestId);
  }

  @Patch(":paymentId/status/reverse")
  reverse(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @RequestId() requestId: string,
  ) {
    return this.payments.reverse(principal.userId, businessId, paymentId, requestId);
  }
}
