import { Module } from "@nestjs/common";

import { readApiEnvironment } from "@bizo/config/api";

import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";
import { REVENUECAT_CLIENT } from "./billing.tokens.js";
import { RevenueCatClient } from "./revenuecat.client.js";

@Module({
  controllers: [BillingController],
  providers: [
    {
      provide: REVENUECAT_CLIENT,
      useFactory: () => new RevenueCatClient(readApiEnvironment(process.env).REVENUECAT_API_KEY),
    },
    BillingService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
