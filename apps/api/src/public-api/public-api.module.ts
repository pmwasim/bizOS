import { Module } from "@nestjs/common";

import { ApiKeyAuthGuard } from "./api-key-auth.guard.js";
import { ApiKeyRateLimitGuard } from "./api-key-rate-limit.guard.js";
import { ApiKeyRateLimiter } from "./api-key-rate-limiter.js";
import { ApiKeysController } from "./api-keys.controller.js";
import { ApiKeysService } from "./api-keys.service.js";

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyRateLimiter, ApiKeyAuthGuard, ApiKeyRateLimitGuard],
  exports: [ApiKeysService, ApiKeyRateLimiter, ApiKeyAuthGuard, ApiKeyRateLimitGuard],
})
export class PublicApiModule {}
