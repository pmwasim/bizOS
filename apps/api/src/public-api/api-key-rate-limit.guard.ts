import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { type Response } from "express";

import { type ApiKeyRequest } from "./api-key-auth.guard.js";
import { ApiKeyRateLimiter } from "./api-key-rate-limiter.js";

/**
 * Enforces the per-key rate limit. Runs after {@link ApiKeyAuthGuard}, which attaches the
 * authenticated principal. Fails closed: a request without a resolved key is rejected rather than
 * allowed to bypass the limiter. On breach it sets `Retry-After` and returns HTTP 429.
 */
@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  constructor(@Inject(ApiKeyRateLimiter) private readonly limiter: ApiKeyRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiKeyRequest>();
    const response = http.getResponse<Response>();

    const principal = request.apiKey;
    if (!principal) {
      throw new UnauthorizedException("Provide an API key.");
    }

    const decision = this.limiter.consume(principal.keyId);
    response.setHeader("X-RateLimit-Limit", decision.limit.toString());
    response.setHeader("X-RateLimit-Remaining", decision.remaining.toString());

    if (!decision.allowed) {
      response.setHeader("Retry-After", decision.retryAfterSeconds.toString());
      throw new HttpException(
        "API rate limit exceeded. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
