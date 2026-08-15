import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";

import {
  createPurchaseOrderRequestSchema,
  type CreatePurchaseOrderRequest,
  type UpdateApprovalStatusRequest,
  type UpdatePurchaseOrderRequest,
  updateApprovalStatusRequestSchema,
  updatePurchaseOrderRequestSchema,
} from "@bizo/contracts/purchase-orders";
import { StoredObjectKind } from "@bizo/database";
import { MAX_STORED_OBJECT_BYTES } from "@bizo/storage";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { PurchaseOrdersService } from "./purchase-orders.service.js";
import { scaledThrottle } from "../security/throttle-policy.js";

type UploadedBinary = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

function requireUpload(file: Express.Multer.File | undefined): UploadedBinary {
  if (!file?.buffer?.length) {
    throw new BadRequestException("Choose a file to upload.");
  }
  return {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  };
}

@Controller("businesses/:businessId/purchase-orders")
export class PurchaseOrdersController {
  constructor(
    @Inject(PurchaseOrdersService) private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Body(new ContractPipe(createPurchaseOrderRequestSchema)) input: CreatePurchaseOrderRequest,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.create(principal.userId, businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") businessId: string) {
    return this.purchaseOrders.list(principal.userId, businessId);
  }

  @Get(":purchaseOrderId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
  ) {
    return this.purchaseOrders.get(principal.userId, businessId, purchaseOrderId);
  }

  @Put(":purchaseOrderId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @Body(new ContractPipe(updatePurchaseOrderRequestSchema)) input: UpdatePurchaseOrderRequest,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.update(
      principal.userId,
      businessId,
      purchaseOrderId,
      input,
      requestId,
    );
  }

  @Post(":purchaseOrderId/archive")
  archive(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.archive(principal.userId, businessId, purchaseOrderId, requestId);
  }

  @Patch(":purchaseOrderId/approval")
  updateApproval(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @Body(new ContractPipe(updateApprovalStatusRequestSchema)) input: UpdateApprovalStatusRequest,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.updateApproval(
      principal.userId,
      businessId,
      purchaseOrderId,
      input,
      requestId,
    );
  }

  @Post(":purchaseOrderId/files/purchase-order")
  @Throttle(scaledThrottle({ default: { limit: 20, ttl: 60_000 } }))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_STORED_OBJECT_BYTES, files: 1 },
    }),
  )
  uploadPurchaseOrderFile(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.uploadFile(
      principal.userId,
      businessId,
      purchaseOrderId,
      StoredObjectKind.PURCHASE_ORDER,
      requireUpload(file),
      requestId,
    );
  }

  @Post(":purchaseOrderId/files/approval-evidence")
  @Throttle(scaledThrottle({ default: { limit: 20, ttl: 60_000 } }))
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_STORED_OBJECT_BYTES, files: 1 },
    }),
  )
  uploadApprovalEvidence(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @RequestId() requestId: string,
  ) {
    return this.purchaseOrders.uploadFile(
      principal.userId,
      businessId,
      purchaseOrderId,
      StoredObjectKind.APPROVAL_EVIDENCE,
      requireUpload(file),
      requestId,
    );
  }

  @Get(":purchaseOrderId/files/:fileId")
  downloadFile(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("purchaseOrderId") purchaseOrderId: string,
    @Param("fileId") fileId: string,
  ) {
    return this.purchaseOrders.downloadFile(principal.userId, businessId, purchaseOrderId, fileId);
  }
}

@Controller("businesses/:businessId/quotations/:quotationId/purchase-orders")
export class QuotationPurchaseOrdersController {
  constructor(
    @Inject(PurchaseOrdersService) private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  @Get()
  listForQuotation(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") businessId: string,
    @Param("quotationId") quotationId: string,
  ) {
    return this.purchaseOrders.listForQuotation(principal.userId, businessId, quotationId);
  }
}
