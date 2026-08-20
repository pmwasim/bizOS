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

import {
  type RecordPaymentRequest,
  recordPaymentRequestSchema,
  type RefundPaymentRequest,
  refundPaymentRequestSchema,
  reversePaymentRequestSchema,
  voidPaymentRequestSchema,
} from "@bizo/contracts/payments";

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
    @Body() body: unknown,
  ) {
    const { reason } = this.parseOptionalReason(reversePaymentRequestSchema, body);
    return this.payments.reverse(principal.userId, businessId, paymentId, requestId, reason);
  }

  @Patch(":paymentId/status/void")
  void(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @RequestId() requestId: string,
    @Body() body: unknown,
  ) {
    const { reason } = this.parseOptionalReason(voidPaymentRequestSchema, body);
    return this.payments.void(principal.userId, businessId, paymentId, requestId, reason);
  }

  @Post(":paymentId/refunds")
  refund(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @Body(new ContractPipe(refundPaymentRequestSchema)) input: RefundPaymentRequest,
    @RequestId() requestId: string,
  ) {
    return this.payments.refund(principal.userId, businessId, paymentId, input, requestId);
  }

  /**
   * Reverse and void carry only an optional reason, and existing callers PATCH them with no body at
   * all. Coerce a missing body to an empty object so the reason stays optional, while still running
   * the request through the contract schema (via {@link ContractPipe}) for a consistent 400 shape.
   */
  private parseOptionalReason(
    schema: typeof reversePaymentRequestSchema | typeof voidPaymentRequestSchema,
    body: unknown,
  ): { reason?: string | null } {
    const value = body === undefined || body === null ? {} : body;
    return new ContractPipe(schema).transform(value) as { reason?: string | null };
  }
}
