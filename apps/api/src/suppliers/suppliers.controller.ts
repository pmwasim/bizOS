import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createSupplierRequestSchema,
  type CreateSupplierRequest,
  updateSupplierRequestSchema,
  type UpdateSupplierRequest,
} from "@bizo/contracts/suppliers";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { SuppliersService } from "./suppliers.service.js";

@Controller("businesses/:businessId/suppliers")
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly suppliers: SuppliersService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createSupplierRequestSchema)) input: CreateSupplierRequest,
    @RequestId() requestId: string,
  ) {
    return this.suppliers.create(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.suppliers.list(principal.userId, _businessId);
  }

  @Get(":supplierId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("supplierId") supplierId: string,
  ) {
    return this.suppliers.get(principal.userId, _businessId, supplierId);
  }

  @Put(":supplierId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("supplierId") supplierId: string,
    @Body(new ContractPipe(updateSupplierRequestSchema)) input: UpdateSupplierRequest,
    @RequestId() requestId: string,
  ) {
    return this.suppliers.update(principal.userId, _businessId, supplierId, input, requestId);
  }

  @Post(":supplierId/deactivate")
  deactivate(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("supplierId") supplierId: string,
    @RequestId() requestId: string,
  ) {
    return this.suppliers.deactivate(principal.userId, _businessId, supplierId, requestId);
  }
}
