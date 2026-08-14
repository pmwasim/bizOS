import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createSalesOrderRequestSchema,
  type CreateSalesOrderRequest,
  updateSalesOrderRequestSchema,
  type UpdateSalesOrderRequest,
} from "@bizo/contracts/sales-orders";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { SalesOrdersService } from "./sales-orders.service.js";

@Controller("businesses/:businessId/sales-orders")
export class SalesOrdersController {
  constructor(@Inject(SalesOrdersService) private readonly salesOrders: SalesOrdersService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createSalesOrderRequestSchema)) input: CreateSalesOrderRequest,
    @RequestId() requestId: string,
  ) {
    return this.salesOrders.create(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.salesOrders.list(principal.userId, _businessId);
  }

  @Get(":salesOrderId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("salesOrderId") salesOrderId: string,
  ) {
    return this.salesOrders.get(principal.userId, _businessId, salesOrderId);
  }

  @Put(":salesOrderId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("salesOrderId") salesOrderId: string,
    @Body(new ContractPipe(updateSalesOrderRequestSchema)) input: UpdateSalesOrderRequest,
    @RequestId() requestId: string,
  ) {
    return this.salesOrders.update(principal.userId, _businessId, salesOrderId, input, requestId);
  }

  @Post(":salesOrderId/confirm")
  confirm(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("salesOrderId") salesOrderId: string,
    @RequestId() requestId: string,
  ) {
    return this.salesOrders.confirm(principal.userId, _businessId, salesOrderId, requestId);
  }

  @Post(":salesOrderId/cancel")
  cancel(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("salesOrderId") salesOrderId: string,
    @RequestId() requestId: string,
  ) {
    return this.salesOrders.cancel(principal.userId, _businessId, salesOrderId, requestId);
  }
}
