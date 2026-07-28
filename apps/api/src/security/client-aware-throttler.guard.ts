import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { type Request } from "express";

import { readApiEnvironment } from "@bizo/config/api";

import {
  BIZO_CLIENT_IP_HEADER,
  BIZO_CLIENT_IP_SIGNATURE_HEADER,
  isTrustedForwardedIp,
  parseTrustedClientIp,
} from "./client-ip.js";

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const peer = request.ip || request.socket.remoteAddress || "unknown";
    const forwarded = parseTrustedClientIp(request.headers[BIZO_CLIENT_IP_HEADER]);
    if (!forwarded) {
      return peer;
    }
    // BIZ-003: only honour the forwarded IP when it carries a valid BFF HMAC.
    // When no secret is configured (local dev), fall back to legacy trust so
    // the BFF and local E2E keep working; production must set the secret.
    const secret = this.signatureSecret();
    if (!secret) {
      return forwarded;
    }
    const signature = request.headers[BIZO_CLIENT_IP_SIGNATURE_HEADER];
    return isTrustedForwardedIp(forwarded, signature, secret) ? forwarded : peer;
  }

  private signatureSecret(): string | undefined {
    try {
      return readApiEnvironment(process.env).CLIENT_IP_SIGNATURE_SECRET;
    } catch {
      return undefined;
    }
  }
}
