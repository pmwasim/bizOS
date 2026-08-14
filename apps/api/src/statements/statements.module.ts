import { Module } from "@nestjs/common";

import { StatementsController } from "./statements.controller.js";
import { StatementsService } from "./statements.service.js";

@Module({
  controllers: [StatementsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule {}
