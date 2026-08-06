import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { ConfigurationModule } from "./configuration/configuration.module.js";
import { CustomizationModule } from "./customization/customization.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { ErpnextModule } from "./erpnext/erpnext.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { KeepWarmMiddleware } from "./common/keep-warm.middleware.js";
import { NoStoreInterceptor } from "./common/no-store.interceptor.js";
import { HealthModule } from "./health/health.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { MailModule } from "./mail/mail.module.js";
import { OnboardingModule } from "./onboarding/onboarding.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { ClientAwareThrottlerGuard } from "./security/client-aware-throttler.guard.js";
import { InternalAuthGuard } from "./security/internal-auth.guard.js";
import { SecurityModule } from "./security/security.module.js";
import { SystemAdminModule } from "./system-admin/system-admin.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      forRoutes: [{ path: "{*path}", method: RequestMethod.ALL }],
      pinoHttp: {
        autoLogging: true,
        genReqId(request, response) {
          const incoming = request.headers["x-request-id"];
          const requestId =
            typeof incoming === "string" && incoming.length <= 128 ? incoming : crypto.randomUUID();
          response.setHeader("x-request-id", requestId);
          return requestId;
        },
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
          censor: "[REDACTED]",
        },
      },
    }),
    ThrottlerModule.forRoot([{ limit: 100, ttl: 60_000 }]),
    DatabaseModule,
    ErpnextModule,
    MailModule,
    SecurityModule,
    HealthModule,
    IdentityModule,
    PlatformModule,
    ConfigurationModule,
    OnboardingModule,
    CustomizationModule,
    SystemAdminModule,
    CustomersModule,
    DocumentsModule,
    PurchaseOrdersModule,
    PaymentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClientAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: NoStoreInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(KeepWarmMiddleware).forRoutes({ path: "{*path}", method: RequestMethod.ALL });
  }
}
