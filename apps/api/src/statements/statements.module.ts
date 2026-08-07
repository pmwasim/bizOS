import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { SecurityModule } from "../security/security.module.js";
import { StatementsController } from "./statements.controller.js";
import { StatementsService } from "./statements.service.js";

@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [StatementsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule {}
