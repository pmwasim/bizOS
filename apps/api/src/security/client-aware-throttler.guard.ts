import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { type Request } from "express";

import { readApiEnvironment } from "@bizo/config/api";

import {
  BIZO_CLIENT_IP_HEADER,
  BIZO_CLIENT_IP_SIGNATURE_HEADER,
  isWellFormedIp,
  parseTrustedClientIp,
} from "./client-ip.js";

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  // The throttler package calls getTracker(req) once per named throttler and
  // builds the storage key as generateKey(context, tracker, throttler.name).
  // Returning the account email for the perAccount throttler therefore shares
  // one counter per account across all source IPs (BIZ-003). Endpoints that do
  // not opt into perAccount fall through to the IP tracker below.
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    return this.extractEmail(request) ?? this.ipTracker(request);
  }

  private ipTracker(request: Request): string {
    const peer = request.ip || request.socket.remoteAddress || "unknown";
    const secret = this.signatureSecret();
    const forwardedHeader = request.headers[BIZO_CLIENT_IP_HEADER];

    if (!secret) {
      if (isWellFormedIp(forwardedHeader)) {
        return forwardedHeader.trim();
      }
      return peer;
    }

    const forwarded = parseTrustedClientIp(
      forwardedHeader,
      request.headers[BIZO_CLIENT_IP_SIGNATURE_HEADER],
      secret,
    );
    if (!forwarded) {
      return peer;
    }
    return forwarded;
  }

  private extractEmail(request: Request): string | undefined {
    const body = request.body as unknown;
    if (typeof body !== "object" || body === null) {
      return undefined;
    }
    const email = (body as { email?: unknown }).email;
    if (typeof email !== "string") {
      return undefined;
    }
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 && normalized.length <= 320 ? normalized : undefined;
  }

  private signatureSecret(): string | undefined {
    try {
      return readApiEnvironment(process.env).CLIENT_IP_SIGNATURE_SECRET;
    } catch {
      return undefined;
    }
  }
}
