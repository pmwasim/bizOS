// Phase 11 — Business-scoped customization request REST controller.
//
// Endpoints:
//   POST /api/v1/businesses/:businessId/customization-requests
//   GET  /api/v1/businesses/:businessId/customization-requests
//   GET  /api/v1/businesses/:businessId/customization-requests/:requestId

import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import {
  createCustomizationRequestSchema,
  type BusinessCustomizationRequestSummary,
  type CreateCustomizationRequest,
  type ListBusinessCustomizationRequestsResponse,
} from "@bizo/contracts/customization";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { CustomizationService } from "./customization.service.js";

@Controller("businesses/:businessId/customization-requests")
export class CustomizationController {
  constructor(@Inject(CustomizationService) private readonly customization: CustomizationService) {}

  @Post()
  createRequest(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createCustomizationRequestSchema)) input: CreateCustomizationRequest,
  ): Promise<BusinessCustomizationRequestSummary> {
    return this.customization.createRequest({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      ...input,
    });
  }

  @Get()
  listRequests(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
  ): Promise<ListBusinessCustomizationRequestsResponse> {
    return this.customization.listRequests({
      userPublicId: principal.userId,
      businessPublicId: businessId,
    });
  }

  @Get(":requestId")
  getRequest(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("requestId") requestId: string,
  ): Promise<BusinessCustomizationRequestSummary> {
    return this.customization.getRequest({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      requestId,
    });
  }
}
