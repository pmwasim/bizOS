import { Controller, Get } from "@nestjs/common";

import { type HealthResponse } from "@bizo/contracts/health";

import { Public } from "../security/public.decorator.js";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
