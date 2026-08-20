import { SetMetadata } from "@nestjs/common";

import { type ApiScope } from "@bizo/contracts/api-keys";

export const REQUIRED_API_SCOPES = "bizo.required-api-scopes";

/**
 * Declares the API scopes an endpoint (or controller) requires. {@link ApiKeyAuthGuard} reads this
 * metadata and rejects any authenticated key that is missing one of the listed scopes with 403.
 * An endpoint with no `@RequireScopes(...)` requires authentication but no particular scope.
 */
export const RequireScopes = (...scopes: readonly ApiScope[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_API_SCOPES, scopes);
