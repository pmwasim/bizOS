import { z } from "zod";

/**
 * Permission scopes a public API key can be granted.
 *
 * Each scope is a `<resource>:<access>` string. `read` grants retrieval of that resource through
 * the public REST API; `write` grants creation and mutation. Scopes are the coarse-grained
 * capability model for programmatic callers and are deliberately independent of the fine-grained
 * per-role human permissions enforced by the internal authorization layer.
 */
export const API_SCOPES = [
  "invoices:read",
  "invoices:write",
  "payments:read",
  "payments:write",
  "customers:read",
  "customers:write",
  "products:read",
  "products:write",
] as const;

export const apiScopeSchema = z.enum(API_SCOPES);

export type ApiScope = z.infer<typeof apiScopeSchema>;

/** Lifecycle state of an issued key. Mirrors the `ApiKeyStatus` enum in the database schema. */
export const apiKeyStatusSchema = z.enum(["ACTIVE", "REVOKED"]);

export type ApiKeyStatusValue = z.infer<typeof apiKeyStatusSchema>;

export const createApiKeyRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(apiScopeSchema).min(1).max(API_SCOPES.length),
  // ISO-8601 instant after which the key is rejected. `null` means the key never expires.
  expiresAt: z.iso.datetime().nullable().default(null),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

/** Metadata for a key. Never carries the plaintext secret — that is returned only once, at issue. */
export const apiKeySchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(apiScopeSchema),
  status: apiKeyStatusSchema,
  lastUsedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

/**
 * The one-time response returned when a key is created or rotated. The `secret` field is the only
 * moment the plaintext key is ever available; it is not persisted and cannot be retrieved again.
 */
export const issuedApiKeySchema = apiKeySchema.extend({
  secret: z.string(),
});

export type IssuedApiKey = z.infer<typeof issuedApiKeySchema>;
