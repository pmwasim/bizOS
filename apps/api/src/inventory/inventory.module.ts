import { Module } from "@nestjs/common";

import { InventoryController, StockController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";

@Module({
  controllers: [InventoryController, StockController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
