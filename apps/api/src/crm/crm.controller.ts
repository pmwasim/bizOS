import { Body, Controller, Get, Inject, Param, Post, Put, Query } from "@nestjs/common";

import {
  convertOpportunityRequestSchema,
  type ConvertOpportunityRequest,
  createCrmActivityRequestSchema,
  type CreateCrmActivityRequest,
  createLeadRequestSchema,
  type CreateLeadRequest,
  createOpportunityRequestSchema,
  type CreateOpportunityRequest,
  updateLeadRequestSchema,
  type UpdateLeadRequest,
  updateOpportunityRequestSchema,
  type UpdateOpportunityRequest,
} from "@bizo/contracts/crm";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { CrmActivitiesService } from "./activities.service.js";
import { LeadsService } from "./leads.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

@Controller("businesses/:businessId/leads")
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createLeadRequestSchema)) input: CreateLeadRequest,
    @RequestId() requestId: string,
  ) {
    return this.leads.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.leads.list(principal.userId, businessId);
  }

  @Get(":leadId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("leadId") leadId: string,
  ) {
    return this.leads.get(principal.userId, businessId, leadId);
  }

  @Put(":leadId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("leadId") leadId: string,
    @Body(new ContractPipe(updateLeadRequestSchema)) input: UpdateLeadRequest,
    @RequestId() requestId: string,
  ) {
    return this.leads.update(principal.userId, businessId, leadId, input, requestId);
  }

  @Post(":leadId/convert")
  convert(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("leadId") leadId: string,
    @RequestId() requestId: string,
  ) {
    return this.leads.convert(principal.userId, businessId, leadId, requestId);
  }
}

@Controller("businesses/:businessId/opportunities")
export class OpportunitiesController {
  constructor(@Inject(OpportunitiesService) private readonly opportunities: OpportunitiesService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createOpportunityRequestSchema)) input: CreateOpportunityRequest,
    @RequestId() requestId: string,
  ) {
    return this.opportunities.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.opportunities.list(principal.userId, businessId);
  }

  @Get(":opportunityId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("opportunityId") opportunityId: string,
  ) {
    return this.opportunities.get(principal.userId, businessId, opportunityId);
  }

  @Put(":opportunityId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("opportunityId") opportunityId: string,
    @Body(new ContractPipe(updateOpportunityRequestSchema)) input: UpdateOpportunityRequest,
    @RequestId() requestId: string,
  ) {
    return this.opportunities.update(principal.userId, businessId, opportunityId, input, requestId);
  }

  @Post(":opportunityId/convert-to-quotation")
  convertToQuotation(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("opportunityId") opportunityId: string,
    @Body(new ContractPipe(convertOpportunityRequestSchema)) input: ConvertOpportunityRequest,
    @RequestId() requestId: string,
  ) {
    return this.opportunities.convertToQuotation(
      principal.userId,
      businessId,
      opportunityId,
      input,
      requestId,
    );
  }
}

@Controller("businesses/:businessId/crm/activities")
export class CrmActivitiesController {
  constructor(@Inject(CrmActivitiesService) private readonly activities: CrmActivitiesService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createCrmActivityRequestSchema)) input: CreateCrmActivityRequest,
  ) {
    return this.activities.create(principal.userId, businessId, input);
  }

  @Get()
  list(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query("customerId") customerId?: string,
    @Query("opportunityId") opportunityId?: string,
  ) {
    return this.activities.list(principal.userId, businessId, {
      ...(customerId ? { customerPublicId: customerId } : {}),
      ...(opportunityId ? { opportunityPublicId: opportunityId } : {}),
    });
  }
}
