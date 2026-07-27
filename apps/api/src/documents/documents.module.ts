import { Module } from "@nestjs/common";

import { PdfService } from "./pdf.service.js";
import { QuotationsController } from "./quotations.controller.js";
import { QuotationsService } from "./quotations.service.js";

@Module({
  controllers: [QuotationsController],
  providers: [PdfService, QuotationsService],
})
export class DocumentsModule {}
