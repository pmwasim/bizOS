import { Module, RequestMethod } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

import { HealthModule } from "./health/health.module.js";

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
    HealthModule,
  ],
})
export class AppModule {}
