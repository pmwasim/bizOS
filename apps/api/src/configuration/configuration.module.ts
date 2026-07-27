import { Module } from "@nestjs/common";

import { ConfigurationController } from "./configuration.controller.js";
import { ConfigurationService } from "./configuration.service.js";

@Module({
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
