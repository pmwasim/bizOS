import { Module } from "@nestjs/common";

import { ConfigurationModule } from "../configuration/configuration.module.js";
import { CustomFieldsController } from "./custom-fields.controller.js";
import { CustomizationController } from "./customization.controller.js";
import { CustomizationService } from "./customization.service.js";

@Module({
  imports: [ConfigurationModule],
  controllers: [CustomizationController, CustomFieldsController],
  providers: [CustomizationService],
  exports: [CustomizationService],
})
export class CustomizationModule {}
