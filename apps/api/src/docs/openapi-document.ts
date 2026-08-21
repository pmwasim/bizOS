import { type OpenAPIObject } from "@nestjs/swagger";
import { z } from "zod";

import {
  API_SCOPES,
  apiKeySchema,
  apiKeyStatusSchema,
  createApiKeyRequestSchema,
  issuedApiKeySchema,
} from "@bizo/contracts/api-keys";
import {
  createWebhookEndpointRequestSchema,
  issuedWebhookEndpointSchema,
  updateWebhookEndpointRequestSchema,
  WEBHOOK_EVENT_TYPES,
  webhookDeliverySchema,
  webhookEndpointSchema,
} from "@bizo/contracts/webhooks";

import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../webhooks/webhook-signature.js";

/**
 * A single JSON-Schema object. `@nestjs/swagger`'s own `SchemaObject` is modelled on OpenAPI 3.0,
 * but an OpenAPI 3.1 document embeds vanilla JSON Schema (draft 2020-12) — which is exactly what
 * {@link z.toJSONSchema} emits — so we carry the fragments as opaque records and cast once at the
 * document boundary.
 */
type JsonSchema = Record<string, unknown>;

/**
 * The OpenAPI version this document targets. Kept as a constant so the endpoint test and the
 * document stay in lockstep; OpenAPI 3.1 is the first release that embeds unmodified JSON Schema.
 */
export const OPENAPI_VERSION = "3.1.1";

/** The security scheme name used throughout the document for programmatic (API-key) callers. */
export const API_KEY_SECURITY_SCHEME = "apiKey";

/** The `X-API-Key` header variant of the API-key scheme (an OpenAPI `apiKey`-in-header scheme). */
export const API_KEY_HEADER_SECURITY_SCHEME = "apiKeyHeader";

/**
 * The security scheme name used for the human-operated management endpoints. `InternalAuthGuard`
 * verifies a server-minted `Authorization: Bearer <JWT>` assertion (not a browser cookie).
 */
export const SESSION_SECURITY_SCHEME = "sessionAuth";

/**
 * Converts a Zod contract schema to a draft-2020-12 JSON Schema fragment suitable for embedding in
 * OpenAPI 3.1 `components/schemas`. The top-level `$schema` dialect marker `z.toJSONSchema` adds is
 * stripped — it is redundant inside an OpenAPI document and would only add noise to the components.
 *
 * `io` selects the input vs output projection: request bodies use `"input"` (so fields with a
 * default become optional), responses use `"output"` (the fully-populated resource).
 */
function toSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io }) as JsonSchema;
  delete json.$schema;
  return json;
}

function ref(name: string): JsonSchema {
  return { $ref: `#/components/schemas/${name}` };
}

/** Reusable path parameter definitions. */
const businessIdParam: JsonSchema = {
  name: "businessId",
  in: "path",
  required: true,
  description: "Opaque identifier of the business (tenant) that owns the resource.",
  schema: { type: "string" },
};

function pathParam(name: string, description: string): JsonSchema {
  return { name, in: "path", required: true, description, schema: { type: "string" } };
}

/** Standard RFC 9457 problem+json responses, referenced from every operation. */
const problemResponse = (description: string): JsonSchema => ({
  description,
  content: { "application/problem+json": { schema: ref("ProblemDetails") } },
});

const commonErrorResponses: Record<string, JsonSchema> = {
  "400": problemResponse("The request failed validation."),
  "401": problemResponse("Authentication is missing or invalid."),
  "403": problemResponse("The caller is not permitted to access this resource."),
  "404": problemResponse("The resource does not exist for this business."),
  "429": problemResponse("The rate limit for the credential has been exceeded."),
};

function jsonBody(schemaName: string): JsonSchema {
  return {
    required: true,
    content: { "application/json": { schema: ref(schemaName) } },
  };
}

function jsonResponse(description: string, schemaName: string): JsonSchema {
  return { description, content: { "application/json": { schema: ref(schemaName) } } };
}

function jsonArrayResponse(description: string, schemaName: string): JsonSchema {
  return {
    description,
    content: { "application/json": { schema: { type: "array", items: ref(schemaName) } } },
  };
}

const infoDescription = [
  "REST API for bizOS. This document covers the programmatic surface introduced by scoped API keys",
  "and outbound webhooks.",
  "",
  "## Authentication",
  "",
  "Programmatic callers present a scoped API key on every request, either as",
  "`Authorization: Bearer <key>` or in the `X-API-Key` header. Keys are issued once (the plaintext",
  "`secret` is returned only at creation or rotation and is never retrievable again) and carry a set",
  "of `<resource>:<access>` scopes. A request whose key is unknown, revoked, or expired is rejected",
  "with `401`; a key that is missing a scope an endpoint requires is rejected with `403`.",
  "",
  `Available scopes: ${API_SCOPES.map((scope) => `\`${scope}\``).join(", ")}.`,
  "",
  "The management endpoints in this document (API-key and webhook administration) are operated by",
  "authenticated humans through the application and are protected by the browser session",
  "(`sessionAuth`), not by an API key.",
  "",
  "## Rate limiting",
  "",
  "API-key-authenticated responses carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`. When the",
  "per-key budget is exhausted the API responds `429 Too Many Requests` with a `Retry-After` header",
  "giving the number of seconds to wait before retrying.",
  "",
  "## Errors",
  "",
  "Errors follow RFC 9457 `application/problem+json` with a stable machine-readable `code`, a",
  "safe human-readable `detail`, and the `requestId` for correlation.",
  "",
  "## Webhooks",
  "",
  "Each webhook endpoint subscribes to a set of event types and receives a signed `POST` for every",
  "matching delivery. The request body is the `WebhookDeliveryEnvelope`. Every delivery carries:",
  "",
  `- \`${WEBHOOK_SIGNATURE_HEADER}: sha256=<hex>\` — HMAC-SHA256, computed over the exact string`,
  "  `` `${timestamp}.${rawBody}` `` using the endpoint's signing secret.",
  `- \`${WEBHOOK_TIMESTAMP_HEADER}\` — the unix-seconds timestamp the signature is bound to. Reject`,
  "  deliveries whose timestamp is outside your freshness window before trusting the body.",
  `- \`${WEBHOOK_EVENT_HEADER}\` — the event type.`,
  `- \`${WEBHOOK_DELIVERY_HEADER}\` — the unique delivery id; deduplicate on it.`,
  "",
  "To verify a delivery: read the timestamp header, recompute",
  "`` HMAC-SHA256(secret, `${timestamp}.${rawBody}`) `` over the **raw** request bytes, and compare it",
  `constant-time against the hex in the \`${WEBHOOK_SIGNATURE_HEADER}\` header. Signing secrets are`,
  `prefixed \`${WEBHOOK_SECRET_PREFIX}\` and are returned only once, at endpoint creation or secret`,
  "rotation.",
].join("\n");

/**
 * Builds the OpenAPI 3.1 document describing the public REST API surface (scoped API keys and
 * outbound webhooks). Pure and deterministic: it takes no runtime state and, for a given set of
 * contracts, always produces byte-for-byte identical output, so it is safe to snapshot and to serve
 * from a cached value.
 */
export function buildOpenApiDocument(): OpenAPIObject {
  const document = {
    openapi: OPENAPI_VERSION,
    info: {
      title: "bizOS Public API",
      version: "1.0.0",
      description: infoDescription,
    },
    servers: [{ url: "/api/v1", description: "Version 1 (major version is carried in the path)." }],
    tags: [
      { name: "API keys", description: "Issue, list, rotate, and revoke scoped API keys." },
      {
        name: "Webhooks",
        description: "Register and manage outbound webhook endpoints and their signing secrets.",
      },
    ],
    paths: {
      "/businesses/{businessId}/api-keys": {
        get: {
          tags: ["API keys"],
          summary: "List API keys",
          operationId: "listApiKeys",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam],
          responses: {
            "200": jsonArrayResponse("The business's API keys, without secrets.", "ApiKey"),
            ...commonErrorResponses,
          },
        },
        post: {
          tags: ["API keys"],
          summary: "Create an API key",
          description:
            "Issues a new scoped API key. The plaintext `secret` is returned exactly once in this response.",
          operationId: "createApiKey",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam],
          requestBody: jsonBody("CreateApiKeyRequest"),
          responses: {
            "201": jsonResponse(
              "The newly issued key, including its one-time secret.",
              "IssuedApiKey",
            ),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/api-keys/{keyId}/rotate": {
        post: {
          tags: ["API keys"],
          summary: "Rotate an API key",
          description:
            "Revokes the current secret and issues a replacement. The new plaintext `secret` is returned once.",
          operationId: "rotateApiKey",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam, pathParam("keyId", "Identifier of the API key to rotate.")],
          responses: {
            "201": jsonResponse(
              "The rotated key, including its new one-time secret.",
              "IssuedApiKey",
            ),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/api-keys/{keyId}": {
        delete: {
          tags: ["API keys"],
          summary: "Revoke an API key",
          operationId: "revokeApiKey",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam, pathParam("keyId", "Identifier of the API key to revoke.")],
          responses: {
            "200": jsonResponse("The revoked key's metadata.", "ApiKey"),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook endpoints",
          operationId: "listWebhookEndpoints",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam],
          responses: {
            "200": jsonArrayResponse(
              "The business's webhook endpoints, without signing secrets.",
              "WebhookEndpoint",
            ),
            ...commonErrorResponses,
          },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Create a webhook endpoint",
          description:
            "Registers an HTTPS endpoint. The plaintext signing `secret` is returned exactly once in this response.",
          operationId: "createWebhookEndpoint",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [businessIdParam],
          requestBody: jsonBody("CreateWebhookEndpointRequest"),
          responses: {
            "201": jsonResponse(
              "The newly registered endpoint, including its one-time signing secret.",
              "IssuedWebhookEndpoint",
            ),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/webhooks/{endpointId}": {
        patch: {
          tags: ["Webhooks"],
          summary: "Update a webhook endpoint",
          operationId: "updateWebhookEndpoint",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [
            businessIdParam,
            pathParam("endpointId", "Identifier of the webhook endpoint to update."),
          ],
          requestBody: jsonBody("UpdateWebhookEndpointRequest"),
          responses: {
            "200": jsonResponse("The updated endpoint metadata.", "WebhookEndpoint"),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/webhooks/{endpointId}/disable": {
        post: {
          tags: ["Webhooks"],
          summary: "Disable a webhook endpoint",
          operationId: "disableWebhookEndpoint",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [
            businessIdParam,
            pathParam("endpointId", "Identifier of the webhook endpoint to disable."),
          ],
          responses: {
            "200": jsonResponse("The disabled endpoint metadata.", "WebhookEndpoint"),
            ...commonErrorResponses,
          },
        },
      },
      "/businesses/{businessId}/webhooks/{endpointId}/rotate-secret": {
        post: {
          tags: ["Webhooks"],
          summary: "Rotate a webhook signing secret",
          description:
            "Replaces the endpoint's signing secret. The new plaintext `secret` is returned exactly once.",
          operationId: "rotateWebhookSecret",
          security: [{ [SESSION_SECURITY_SCHEME]: [] }],
          parameters: [
            businessIdParam,
            pathParam("endpointId", "Identifier of the webhook endpoint whose secret to rotate."),
          ],
          responses: {
            "201": jsonResponse(
              "The endpoint with its new one-time signing secret.",
              "IssuedWebhookEndpoint",
            ),
            ...commonErrorResponses,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        [API_KEY_SECURITY_SCHEME]: {
          type: "http",
          scheme: "bearer",
          description: [
            "Scoped API key for programmatic access to the public data API, sent as",
            "`Authorization: Bearer <key>`. Equivalently, send the key in the `X-API-Key` header",
            `(see the \`${API_KEY_HEADER_SECURITY_SCHEME}\` scheme). The key carries a subset of the`,
            `scopes enumerated by \`ApiScope\`: ${API_SCOPES.map((scope) => `\`${scope}\``).join(", ")}.`,
          ].join(" "),
        },
        [API_KEY_HEADER_SECURITY_SCHEME]: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description:
            "The same scoped API key sent in the `X-API-Key` header instead of `Authorization: Bearer`. Either form is accepted; use whichever your client supports.",
        },
        [SESSION_SECURITY_SCHEME]: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Server-minted internal assertion (a short-lived JWT) presented as `Authorization: Bearer <jwt>`; this is what `InternalAuthGuard` verifies. The application mints it server-side for the human-operated management endpoints — it is not a credential a programmatic API-key client holds.",
        },
      },
      schemas: {
        ApiScope: {
          ...toSchema(z.enum(API_SCOPES), "output"),
          description: "A `<resource>:<access>` capability that a scoped API key may be granted.",
        },
        ApiKeyStatus: toSchema(apiKeyStatusSchema, "output"),
        ApiKey: toSchema(apiKeySchema, "output"),
        IssuedApiKey: toSchema(issuedApiKeySchema, "output"),
        CreateApiKeyRequest: toSchema(createApiKeyRequestSchema, "input"),
        WebhookEventType: {
          ...toSchema(z.enum(WEBHOOK_EVENT_TYPES), "output"),
          description: "A `<aggregate>.<event>` domain event a webhook endpoint can subscribe to.",
        },
        WebhookEndpoint: toSchema(webhookEndpointSchema, "output"),
        IssuedWebhookEndpoint: toSchema(issuedWebhookEndpointSchema, "output"),
        CreateWebhookEndpointRequest: toSchema(createWebhookEndpointRequestSchema, "input"),
        UpdateWebhookEndpointRequest: toSchema(updateWebhookEndpointRequestSchema, "input"),
        WebhookDelivery: toSchema(webhookDeliverySchema, "output"),
        WebhookDeliveryEnvelope: {
          type: "object",
          description:
            "The signed JSON body POSTed to a subscribed endpoint for every matching event. The signature is computed over the raw bytes of this document.",
          additionalProperties: false,
          required: ["id", "event", "createdAt", "data"],
          properties: {
            id: {
              type: "string",
              description:
                "Unique delivery id. Also sent in the delivery header; deduplicate on it.",
            },
            event: ref("WebhookEventType"),
            createdAt: {
              type: "string",
              format: "date-time",
              description: "RFC 3339 timestamp at which the delivery was generated.",
            },
            data: {
              type: "object",
              description: "The event payload. Its shape depends on the event type.",
              additionalProperties: true,
            },
          },
        },
        ProblemDetails: {
          type: "object",
          description: "RFC 9457 problem detail returned as `application/problem+json` on error.",
          required: ["type", "title", "status", "code"],
          properties: {
            type: {
              type: "string",
              format: "uri",
              description: "URI identifying the problem type.",
            },
            title: { type: "string", description: "Short, human-readable summary of the problem." },
            status: { type: "integer", description: "HTTP status code." },
            detail: {
              type: "string",
              description: "Safe, human-readable explanation; never contains secrets or internals.",
            },
            code: { type: "string", description: "Stable machine-readable error code." },
            requestId: { type: "string", description: "Correlation id, echoed as `x-request-id`." },
            errors: {
              type: "array",
              description: "Field-level validation errors, when applicable.",
              items: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
  };

  return document as unknown as OpenAPIObject;
}
