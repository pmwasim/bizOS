import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  createSupplierPoRequestSchema,
  type CreateSupplierPoRequest,
} from "@bizo/contracts/supplier-pos";
import {
  createSupplierBillRequestSchema,
  type CreateSupplierBillRequest,
  createGrnRequestSchema,
  type CreateGrnRequest,
} from "@bizo/contracts/supplier-bills";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { ProcurementService } from "./procurement.service.js";

@Controller("businesses/:businessId/procurement/supplier-pos")
export class SupplierPosController {
  constructor(@Inject(ProcurementService) private readonly procurement: ProcurementService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createSupplierPoRequestSchema)) input: CreateSupplierPoRequest,
    @RequestId() requestId: string,
  ) {
    return this.procurement.createSupplierPo(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.procurement.listSupplierPos(principal.userId, _businessId);
  }

  @Get(":poId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("poId") poId: string,
  ) {
    return this.procurement.getSupplierPo(principal.userId, _businessId, poId);
  }

  @Post(":poId/issue")
  issue(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("poId") poId: string,
    @RequestId() requestId: string,
  ) {
    return this.procurement.issueSupplierPo(principal.userId, _businessId, poId, requestId);
  }
}

@Controller("businesses/:businessId/procurement/supplier-bills")
export class SupplierBillsController {
  constructor(@Inject(ProcurementService) private readonly procurement: ProcurementService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createSupplierBillRequestSchema)) input: CreateSupplierBillRequest,
    @RequestId() requestId: string,
  ) {
    return this.procurement.createSupplierBill(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.procurement.listSupplierBills(principal.userId, _businessId);
  }
}

@Controller("businesses/:businessId/procurement/grn")
export class GrnsController {
  constructor(@Inject(ProcurementService) private readonly procurement: ProcurementService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createGrnRequestSchema)) input: CreateGrnRequest,
    @RequestId() requestId: string,
  ) {
    return this.procurement.createGrn(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.procurement.listGrns(principal.userId, _businessId);
  }
}
