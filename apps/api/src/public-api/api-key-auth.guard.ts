import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Request } from "express";

import { type ApiScope } from "@bizo/contracts/api-keys";

import { type ApiKeyPrincipal } from "./api-key-principal.js";
import { ApiKeysService } from "./api-keys.service.js";
import { REQUIRED_API_SCOPES } from "./require-scopes.decorator.js";

export type ApiKeyRequest = Request & { apiKey?: ApiKeyPrincipal };

/**
 * Authenticates a request bearing a public API key and enforces the scopes the endpoint requires.
 *
 * The key is read from `Authorization: Bearer <key>` or the `X-API-Key` header. It is resolved by
 * {@link ApiKeysService.authenticate}, which fails closed on unknown/revoked/expired keys. On
 * success the resolved {@link ApiKeyPrincipal} is attached to the request and every scope declared
 * with `@RequireScopes(...)` must be present, otherwise the request is rejected with 403.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ApiKeysService) private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const rawKey = this.extractKey(request);
    if (!rawKey) {
      throw new UnauthorizedException("Provide an API key.");
    }

    const principal = await this.apiKeys.authenticate(rawKey);
    if (!principal) {
      throw new UnauthorizedException("That API key is not valid.");
    }
    request.apiKey = principal;

    const requiredScopes = this.reflector.getAllAndOverride<readonly ApiScope[]>(
      REQUIRED_API_SCOPES,
      [context.getHandler(), context.getClass()],
    );
    if (requiredScopes && requiredScopes.length > 0) {
      const granted = new Set<ApiScope>(principal.scopes);
      const missing = requiredScopes.some((scope) => !granted.has(scope));
      if (missing) {
        throw new ForbiddenException("This API key is missing a required scope.");
      }
    }

    return true;
  }

  private extractKey(request: ApiKeyRequest): string | undefined {
    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const token = authorization.slice(7).trim();
      if (token.length > 0) {
        return token;
      }
    }

    const headerKey = request.headers["x-api-key"];
    if (typeof headerKey === "string" && headerKey.trim().length > 0) {
      return headerKey.trim();
    }

    return undefined;
  }
}
