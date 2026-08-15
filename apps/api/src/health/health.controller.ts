import { Controller, Get } from "@nestjs/common";

import { readApiEnvironment } from "@bizo/config/api";
import { type HealthResponse } from "@bizo/contracts/health";

import { Public } from "../security/public.decorator.js";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    const environment = readApiEnvironment(process.env);
    return {
      buildTime: environment.BUILD_TIME,
      gitSha: environment.GIT_SHA,
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
