import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { type Request } from "express";

import { readApiEnvironment } from "@bizo/config/api";

import {
  BIZO_CLIENT_IP_HEADER,
  BIZO_CLIENT_IP_SIGNATURE_HEADER,
  parseTrustedClientIp,
} from "./client-ip.js";

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  private readonly secret = readApiEnvironment(process.env).INTERNAL_AUTH_SECRET;

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const forwarded = parseTrustedClientIp(
      request.headers[BIZO_CLIENT_IP_HEADER],
      request.headers[BIZO_CLIENT_IP_SIGNATURE_HEADER],
      this.secret,
    );
    if (forwarded) {
      return forwarded;
    }
    return request.ip || request.socket.remoteAddress || "unknown";
  }
}
