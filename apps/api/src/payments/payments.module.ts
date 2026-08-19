import { Module } from "@nestjs/common";

import { PdfService } from "../documents/pdf.service.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({
  imports: [],
  controllers: [PaymentsController],
  providers: [PaymentsService, PdfService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
