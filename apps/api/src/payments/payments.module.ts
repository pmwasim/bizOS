import { Module } from "@nestjs/common";

import { InvoicePaymentsController, PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({
  controllers: [PaymentsController, InvoicePaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
