import { Module } from "@nestjs/common";

import { ErpnextModule } from "../erpnext/erpnext.module.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";

@Module({
  imports: [ErpnextModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
