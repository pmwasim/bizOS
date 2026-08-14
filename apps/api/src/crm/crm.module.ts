import { Module } from "@nestjs/common";

import { LeadsController, OpportunitiesController } from "./crm.controller.js";
import { LeadsService } from "./leads.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

@Module({
  controllers: [LeadsController, OpportunitiesController],
  providers: [LeadsService, OpportunitiesService],
  exports: [LeadsService, OpportunitiesService],
})
export class CrmModule {}
