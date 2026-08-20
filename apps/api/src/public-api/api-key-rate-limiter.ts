import { Injectable, Optional } from "@nestjs/common";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. Surface as the `Retry-After` header on a 429. */
  retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  windowStart: number;
}

/**
 * Per-key fixed-window rate limiter, in-memory and per-process.
 *
 * In-memory is the deliberate MVP choice: the API's existing `@nestjs/throttler` limiter is also
 * in-memory, so this matches the shipped infrastructure rather than introducing a Redis dependency
 * on the request path. A future multi-instance deployment would swap the backing store for a shared
 * one; the {@link consume} contract stays the same.
 *
 * Fail-closed: the guard only calls this for an already-authenticated key, and a breach returns a
 * denial (429) rather than letting the request through.
 */
@Injectable()
export class ApiKeyRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  private readonly limit: number;
  private readonly windowMs: number;

  constructor(@Optional() limit?: number, @Optional() windowMs?: number) {
    this.limit = limit ?? ApiKeyRateLimiter.defaultLimit();
    this.windowMs = windowMs ?? ApiKeyRateLimiter.defaultWindowMs();
  }

  private static defaultLimit(): number {
    const parsed = Number(process.env.API_KEY_RATE_LIMIT);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 120;
  }

  private static defaultWindowMs(): number {
    const parsed = Number(process.env.API_KEY_RATE_LIMIT_WINDOW_MS);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60_000;
  }

  consume(key: string, now: number = Date.now()): RateLimitDecision {
    const existing = this.windows.get(key);

    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        limit: this.limit,
        remaining: this.limit - 1,
        retryAfterSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    const resetInMs = this.windowMs - (now - existing.windowStart);
    const retryAfterSeconds = Math.max(1, Math.ceil(resetInMs / 1000));

    if (existing.count >= this.limit) {
      return { allowed: false, limit: this.limit, remaining: 0, retryAfterSeconds };
    }

    existing.count += 1;
    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - existing.count,
      retryAfterSeconds,
    };
  }

  /** Test/maintenance helper: drop all tracked windows. */
  reset(): void {
    this.windows.clear();
  }
}
