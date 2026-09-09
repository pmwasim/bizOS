import { Module } from "@nestjs/common";

import { DeliveryNotesController } from "./delivery-notes.controller.js";
import { DeliveryNotesService } from "./delivery-notes.service.js";
import { InventoryModule } from "../inventory/inventory.module.js";

@Module({
  imports: [InventoryModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
