import { Module } from "@nestjs/common";

import { PdfService } from "../documents/pdf.service.js";
import { PayablesService } from "./payables.service.js";
import { StatementDeliveryController } from "./statement-delivery.controller.js";
import { StatementDeliveryService } from "./statement-delivery.service.js";
import { StatementsController } from "./statements.controller.js";
import { StatementsService } from "./statements.service.js";

@Module({
  controllers: [StatementsController, StatementDeliveryController],
  providers: [StatementsService, PayablesService, StatementDeliveryService, PdfService],
  exports: [StatementsService, PayablesService, StatementDeliveryService],
})
export class StatementsModule {}
