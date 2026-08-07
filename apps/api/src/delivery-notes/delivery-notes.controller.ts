import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  createDeliveryNoteRequestSchema,
  type CreateDeliveryNoteRequest,
} from "@bizo/contracts/delivery-notes";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { DeliveryNotesService } from "./delivery-notes.service.js";

@Controller("businesses/:businessId/delivery-notes")
export class DeliveryNotesController {
  constructor(@Inject(DeliveryNotesService) private readonly deliveryNotes: DeliveryNotesService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createDeliveryNoteRequestSchema)) input: CreateDeliveryNoteRequest,
    @RequestId() requestId: string,
  ) {
    return this.deliveryNotes.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.deliveryNotes.list(principal.userId, businessId);
  }

  @Get(":deliveryNoteId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("deliveryNoteId") deliveryNoteId: string,
  ) {
    return this.deliveryNotes.get(principal.userId, businessId, deliveryNoteId);
  }

  @Post(":deliveryNoteId/mark-delivered")
  markDelivered(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("deliveryNoteId") deliveryNoteId: string,
    @RequestId() requestId: string,
  ) {
    return this.deliveryNotes.markDelivered(
      principal.userId,
      businessId,
      deliveryNoteId,
      requestId,
    );
  }
}
