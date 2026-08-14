import { Module } from "@nestjs/common";

import { DeliveryNotesController } from "./delivery-notes.controller.js";
import { DeliveryNotesService } from "./delivery-notes.service.js";

@Module({
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
