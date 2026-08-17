import { Module } from "@nestjs/common";

import { PayablesService } from "./payables.service.js";
import { StatementsController } from "./statements.controller.js";
import { StatementsService } from "./statements.service.js";

@Module({
  controllers: [StatementsController],
  providers: [StatementsService, PayablesService],
  exports: [StatementsService, PayablesService],
})
export class StatementsModule {}
