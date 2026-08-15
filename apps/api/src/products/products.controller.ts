import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createProductRequestSchema,
  type CreateProductRequest,
  updateProductRequestSchema,
  type UpdateProductRequest,
} from "@bizo/contracts/products";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { ProductsService } from "./products.service.js";

@Controller("businesses/:businessId/products")
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createProductRequestSchema)) input: CreateProductRequest,
    @RequestId() requestId: string,
  ) {
    return this.products.create(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.products.list(principal.userId, _businessId);
  }

  @Get(":productId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("productId") productId: string,
  ) {
    return this.products.get(principal.userId, _businessId, productId);
  }

  @Put(":productId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("productId") productId: string,
    @Body(new ContractPipe(updateProductRequestSchema)) input: UpdateProductRequest,
    @RequestId() requestId: string,
  ) {
    return this.products.update(principal.userId, _businessId, productId, input, requestId);
  }

  @Post(":productId/deactivate")
  deactivate(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("productId") productId: string,
    @RequestId() requestId: string,
  ) {
    return this.products.deactivate(principal.userId, _businessId, productId, requestId);
  }
}
