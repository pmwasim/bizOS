import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { type Request } from "express";

import { BIZO_CLIENT_IP_HEADER, parseTrustedClientIp } from "./client-ip.js";

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const forwarded = parseTrustedClientIp(request.headers[BIZO_CLIENT_IP_HEADER]);
    if (forwarded) {
      return forwarded;
    }
    return request.ip || request.socket.remoteAddress || "unknown";
  }
}
