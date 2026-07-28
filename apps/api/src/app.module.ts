import { Module, RequestMethod } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";

import { DatabaseModule } from "./database/database.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module.js";
import { NoStoreInterceptor } from "./common/no-store.interceptor.js";
import { HealthModule } from "./health/health.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { MailModule } from "./mail/mail.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { ClientAwareThrottlerGuard } from "./security/client-aware-throttler.guard.js";
import { InternalAuthGuard } from "./security/internal-auth.guard.js";
import { SecurityModule } from "./security/security.module.js";

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
    MailModule,
    SecurityModule,
    HealthModule,
    IdentityModule,
    PlatformModule,
    CustomersModule,
    DocumentsModule,
    PurchaseOrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClientAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: NoStoreInterceptor },
  ],
})
export class AppModule {}
