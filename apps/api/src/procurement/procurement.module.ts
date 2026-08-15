import { Module } from "@nestjs/common";

import {
  GrnsController,
  SupplierBillsController,
  SupplierPosController,
} from "./procurement.controller.js";
import { ProcurementService } from "./procurement.service.js";

@Module({
  controllers: [SupplierPosController, SupplierBillsController, GrnsController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
