import { Module } from "@nestjs/common";

import { CreditNotesController } from "./credit-notes.controller.js";
import { CreditNotesService } from "./credit-notes.service.js";

@Module({
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
