import { Module } from "@nestjs/common";

import { DocumentsModule } from "../documents/documents.module.js";
import { LeadsController, OpportunitiesController } from "./crm.controller.js";
import { LeadsService } from "./leads.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

@Module({
  imports: [DocumentsModule],
  controllers: [LeadsController, OpportunitiesController],
  providers: [LeadsService, OpportunitiesService],
  exports: [LeadsService, OpportunitiesService],
})
export class CrmModule {}
