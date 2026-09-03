import { Body, Controller, Get, Inject, Param, Post, Put, Query } from "@nestjs/common";

import {
  createInventoryItemRequestSchema,
  type CreateInventoryItemRequest,
  createStockLocationRequestSchema,
  type CreateStockLocationRequest,
  recordStockMovementRequestSchema,
  type RecordStockMovementRequest,
  stockOnHandQuerySchema,
  stockReservationQuerySchema,
  type StockReservationQuery,
  type StockOnHandQuery,
  stockValuationQuerySchema,
  type StockValuationQuery,
  transferStockRequestSchema,
  type TransferStockRequest,
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

@Controller("businesses/:businessId/inventory/stock")
export class StockController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Post("locations")
  createLocation(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createStockLocationRequestSchema)) input: CreateStockLocationRequest,
    @RequestId() requestId: string,
  ) {
    return this.inventory.createLocation(principal.userId, businessId, input, requestId);
  }

  @Get("locations")
  listLocations(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
  ) {
    return this.inventory.listLocations(principal.userId, businessId);
  }

  @Post("movements")
  recordMovement(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(recordStockMovementRequestSchema)) input: RecordStockMovementRequest,
    @RequestId() requestId: string,
  ) {
    return this.inventory.recordMovement(principal.userId, businessId, input, requestId);
  }

  @Get("movements")
  listMovements(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query("itemId") itemId?: string,
    @Query("locationId") locationId?: string,
  ) {
    return this.inventory.listMovements(principal.userId, businessId, {
      ...(itemId ? { itemPublicId: itemId } : {}),
      ...(locationId ? { locationPublicId: locationId } : {}),
    });
  }

  @Post("transfers")
  transfer(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(transferStockRequestSchema)) input: TransferStockRequest,
    @RequestId() requestId: string,
  ) {
    return this.inventory.transferStock(principal.userId, businessId, input, requestId);
  }

  @Get("on-hand")
  onHand(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(stockOnHandQuerySchema)) query: StockOnHandQuery,
  ) {
    return this.inventory.onHand(principal.userId, businessId, query.itemId, query.locationId);
  }

  @Get("atp")
  atp(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(stockOnHandQuerySchema)) query: StockOnHandQuery,
  ) {
    return this.inventory.atp(principal.userId, businessId, query.itemId, query.locationId);
  }

  @Get("valuation")
  valuation(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(stockValuationQuerySchema)) query: StockValuationQuery,
  ) {
    return this.inventory.valuation(
      principal.userId,
      businessId,
      query.itemId,
      query.locationId,
      query.method,
    );
  }

  @Get("reservations")
  listReservations(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query(new ContractPipe(stockReservationQuerySchema)) query: StockReservationQuery,
  ) {
    return this.inventory.listReservations(principal.userId, businessId, query.documentId);
  }
}
