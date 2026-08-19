import { Module } from "@nestjs/common";

import { TaxController } from "./tax.controller.js";
import { TaxSummaryService } from "./tax.service.js";

/** Country Tax Summary & VAT/GST return preparation (MVP Module 9). */
@Module({
  controllers: [TaxController],
  providers: [TaxSummaryService],
  exports: [TaxSummaryService],
})
export class TaxModule {}
