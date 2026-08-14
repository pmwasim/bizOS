import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from "@nestjs/common";

import {
  createCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  type CreateCustomFieldDefinition,
  type CustomFieldDefinition,
  type ListCustomFieldDefinitionsResponse,
  type UpdateCustomFieldDefinition,
} from "@bizo/contracts/customization";

import { ContractPipe } from "../common/contract.pipe.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { CustomizationService } from "./customization.service.js";

@Controller("businesses/:businessId/custom-fields")
export class CustomFieldsController {
  constructor(@Inject(CustomizationService) private readonly customization: CustomizationService) {}

  @Get()
  listDefinitions(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Query("documentType") documentType?: string,
  ): Promise<ListCustomFieldDefinitionsResponse> {
    return this.customization.listCustomFieldDefinitions({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      ...(documentType ? { documentType } : {}),
    });
  }

  @Post()
  createDefinition(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createCustomFieldDefinitionSchema)) input: CreateCustomFieldDefinition,
  ): Promise<CustomFieldDefinition> {
    return this.customization.createCustomFieldDefinition({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      documentType: input.documentType,
      fieldKey: input.fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      ...(input.config ? { config: input.config } : {}),
    });
  }

  @Put(":fieldId")
  updateDefinition(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("fieldId") fieldId: string,
    @Body(new ContractPipe(updateCustomFieldDefinitionSchema)) input: UpdateCustomFieldDefinition,
  ): Promise<CustomFieldDefinition> {
    return this.customization.updateCustomFieldDefinition({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      fieldId,
      ...(input.label ? { label: input.label } : {}),
      ...(input.config ? { config: input.config } : {}),
    });
  }

  @Delete(":fieldId")
  deleteDefinition(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("fieldId") fieldId: string,
  ): Promise<{ success: boolean }> {
    return this.customization.deleteCustomFieldDefinition({
      userPublicId: principal.userId,
      businessPublicId: businessId,
      fieldId,
    });
  }
}
