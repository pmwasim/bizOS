import { Module } from "@nestjs/common";

import { SalesOrdersController } from "./sales-orders.controller.js";
import { SalesOrdersService } from "./sales-orders.service.js";
import { InventoryModule } from "../inventory/inventory.module.js";

@Module({
  imports: [InventoryModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
