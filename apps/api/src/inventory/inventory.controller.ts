import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createInventoryItemRequestSchema,
  type CreateInventoryItemRequest,
  updateInventoryItemRequestSchema,
  type UpdateInventoryItemRequest,
} from "@bizo/contracts/inventory";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { InventoryService } from "./inventory.service.js";

@Controller("businesses/:businessId/inventory")
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createInventoryItemRequestSchema)) input: CreateInventoryItemRequest,
    @RequestId() requestId: string,
  ) {
    return this.inventory.create(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.inventory.list(principal.userId, _businessId);
  }

  @Get(":itemId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.inventory.get(principal.userId, _businessId, itemId);
  }

  @Put(":itemId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("itemId") itemId: string,
    @Body(new ContractPipe(updateInventoryItemRequestSchema)) input: UpdateInventoryItemRequest,
    @RequestId() requestId: string,
  ) {
    return this.inventory.update(principal.userId, _businessId, itemId, input, requestId);
  }

  @Post(":itemId/deactivate")
  deactivate(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("itemId") itemId: string,
    @RequestId() requestId: string,
  ) {
    return this.inventory.deactivate(principal.userId, _businessId, itemId, requestId);
  }
}
