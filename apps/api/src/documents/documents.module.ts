import { Module } from "@nestjs/common";

import { ConfigurationModule } from "../configuration/configuration.module.js";
import { ErpnextModule } from "../erpnext/erpnext.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { ObjectStoreModule } from "../storage/object-store.module.js";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { PdfService } from "./pdf.service.js";
import { QuotationsController } from "./quotations.controller.js";
import { QuotationsService } from "./quotations.service.js";

@Module({
  imports: [ObjectStoreModule, ConfigurationModule, ErpnextModule, PaymentsModule, InventoryModule],
  controllers: [QuotationsController, InvoicesController],
  providers: [PdfService, QuotationsService, InvoicesService],
  exports: [InvoicesService, QuotationsService, PdfService],
})
export class DocumentsModule {}
