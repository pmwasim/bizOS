import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  createCustomerPaymentRequestSchema,
  type CreateCustomerPaymentRequest,
  type VoidCustomerPaymentRequest,
  voidCustomerPaymentRequestSchema,
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
    @Body(new ContractPipe(createCustomerPaymentRequestSchema))
    input: CreateCustomerPaymentRequest,
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

  @Post(":paymentId/void")
  voidPayment(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("paymentId") paymentId: string,
    @Body(new ContractPipe(voidCustomerPaymentRequestSchema)) input: VoidCustomerPaymentRequest,
    @RequestId() requestId: string,
  ) {
    return this.payments.void(principal.userId, businessId, paymentId, input, requestId);
  }
}

@Controller("businesses/:businessId/invoices/:invoiceId/payments")
export class InvoicePaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @Get()
  summarize(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("invoiceId") invoiceId: string,
  ) {
    return this.payments.summarizeInvoice(principal.userId, businessId, invoiceId);
  }
}
