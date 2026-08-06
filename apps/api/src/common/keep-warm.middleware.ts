import { Injectable, type NestMiddleware } from "@nestjs/common";
import { type NextFunction, type Request, type Response } from "express";

/**
 * Minimum gap between wake pings. Render Free spins down after ~15 minutes idle, so a
 * 5-minute floor is frequent enough to hold the warm window open without spamming the worker.
 */
const PING_INTERVAL_MS = 5 * 60 * 1000;

/** A wake ping must never delay a real request. */
const PING_TIMEOUT_MS = 2_000;

/**
 * The health endpoint is what the keep-warm worker itself probes. Treating those probes as
 * user activity would hold the warm window open forever and drain the free instance-hour
 * grant, so they are ignored. Matched on the path so it survives prefix and version changes.
 */
function isHealthProbe(request: Request): boolean {
  const path = (request.originalUrl ?? request.url).split("?")[0] ?? "";
  return path === "/health" || path.endsWith("/health");
}

/**
 * Tells the Cloudflare health worker that a genuine request arrived, so it keeps the Render
 * services awake for the next stretch of activity.
 *
 * Deliberately fire-and-forget: failures are swallowed, and the request is never blocked.
 * Disabled entirely unless both KEEP_WARM_URL and KEEP_WARM_SECRET are set.
 */
@Injectable()
export class KeepWarmMiddleware implements NestMiddleware {
  private readonly url: string | undefined;
  private readonly secret: string | undefined;
  private lastPingAt = 0;

  // Shape is validated at boot by readApiEnvironment; read directly here so constructing the
  // middleware never depends on the full environment being present (tests, CLI tasks).
  constructor() {
    this.url = process.env.KEEP_WARM_URL || undefined;
    this.secret = process.env.KEEP_WARM_SECRET || undefined;
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    if (!isHealthProbe(request)) {
      this.schedulePing();
    }
    next();
  }

  private schedulePing(): void {
    const { url, secret } = this;
    if (url === undefined || secret === undefined) {
      return;
    }

    const now = Date.now();
    if (now - this.lastPingAt < PING_INTERVAL_MS) {
      return;
    }
    // Claim the slot before awaiting so concurrent requests cannot pile on.
    this.lastPingAt = now;

    void fetch(url, {
      method: "POST",
      headers: { "x-wake-secret": secret },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    }).catch(() => {
      // The worker being unreachable must never surface to callers. Allow a retry sooner
      // than the full interval so a transient blip does not leave the services to sleep.
      this.lastPingAt = now - PING_INTERVAL_MS / 2;
    });
  }
}
