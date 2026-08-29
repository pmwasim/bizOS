import { Module } from "@nestjs/common";

import { DocumentsModule } from "../documents/documents.module.js";
import { CrmActivitiesService } from "./activities.service.js";
import {
  CrmActivitiesController,
  LeadsController,
  OpportunitiesController,
} from "./crm.controller.js";
import { LeadsService } from "./leads.service.js";
import { OpportunitiesService } from "./opportunities.service.js";

@Module({
  imports: [DocumentsModule],
  controllers: [LeadsController, OpportunitiesController, CrmActivitiesController],
  providers: [LeadsService, OpportunitiesService, CrmActivitiesService],
  exports: [LeadsService, OpportunitiesService, CrmActivitiesService],
})
export class CrmModule {}
