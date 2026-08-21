import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createCustomerRequestSchema,
  type CreateCustomerRequest,
  updateCustomerRequestSchema,
  type UpdateCustomerRequest,
} from "@bizo/contracts/customers";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { CustomersService } from "./customers.service.js";

@Controller("businesses/:businessId/customers")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createCustomerRequestSchema)) input: CreateCustomerRequest,
    @RequestId() requestId: string,
  ) {
    return this.customers.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.customers.list(principal.userId, businessId);
  }

  @Get(":customerId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.customers.get(principal.userId, businessId, customerId);
  }

  @Put(":customerId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("customerId") customerId: string,
    @Body(new ContractPipe(updateCustomerRequestSchema)) input: UpdateCustomerRequest,
    @RequestId() requestId: string,
  ) {
    return this.customers.update(principal.userId, businessId, customerId, input, requestId);
  }
}
