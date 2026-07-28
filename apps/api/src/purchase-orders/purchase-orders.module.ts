import { Module } from "@nestjs/common";

import { ConfigurationModule } from "../configuration/configuration.module.js";
import { ObjectStoreModule } from "../storage/object-store.module.js";
import {
  PurchaseOrdersController,
  QuotationPurchaseOrdersController,
} from "./purchase-orders.controller.js";
import { PurchaseOrdersService } from "./purchase-orders.service.js";

@Module({
  imports: [ObjectStoreModule, ConfigurationModule],
  controllers: [PurchaseOrdersController, QuotationPurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
