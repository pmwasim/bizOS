import { type ApiScope } from "@bizo/contracts/api-keys";

/**
 * The identity resolved from a valid API key and attached to the request by
 * {@link ApiKeyAuthGuard}. Downstream guards, decorators, and handlers read the resolved business
 * scope and granted permission scopes from here.
 */
export interface ApiKeyPrincipal {
  /** Public UUID of the key (never the secret). */
  keyId: string;
  /** Internal business id the key belongs to. */
  businessId: bigint;
  /** Public UUID of the business the key belongs to. */
  businessPublicId: string;
  /** Internal tenant id the key belongs to. */
  tenantId: bigint;
  /** Permission scopes granted to the key. */
  scopes: readonly ApiScope[];
}
