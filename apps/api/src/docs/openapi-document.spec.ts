import { describe, expect, it } from "vitest";

import { API_SCOPES } from "@bizo/contracts/api-keys";
import { WEBHOOK_EVENT_TYPES } from "@bizo/contracts/webhooks";

import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../webhooks/webhook-signature.js";
import { DocsController } from "./docs.controller.js";
import {
  API_KEY_HEADER_SECURITY_SCHEME,
  API_KEY_SECURITY_SCHEME,
  buildOpenApiDocument,
  SESSION_SECURITY_SCHEME,
} from "./openapi-document.js";

/** Collects every `$ref` string reachable from an arbitrary JSON value. */
function collectRefs(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRefs(item, found);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") {
        found.push(child);
      } else {
        collectRefs(child, found);
      }
    }
  }
  return found;
}

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument();

  it("is an OpenAPI 3.1 document", () => {
    expect(document.openapi).toMatch(/^3\.1\.\d+$/);
  });

  it("declares the API-key security scheme as HTTP bearer", () => {
    const scheme = document.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME];
    expect(scheme).toMatchObject({ type: "http", scheme: "bearer" });
  });

  it("declares a machine-readable X-API-Key header scheme alongside the bearer form", () => {
    const scheme = document.components?.securitySchemes?.[API_KEY_HEADER_SECURITY_SCHEME];
    expect(scheme).toMatchObject({ type: "apiKey", in: "header", name: "X-API-Key" });
  });

  it("models the management-endpoint scheme as the bearer JWT InternalAuthGuard actually verifies", () => {
    // Not a cookie: InternalAuthGuard reads `Authorization: Bearer <jwt>`.
    const scheme = document.components?.securitySchemes?.[SESSION_SECURITY_SCHEME];
    expect(scheme).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
  });

  it("enumerates every API scope", () => {
    const apiScope = document.components?.schemas?.ApiScope as { enum?: string[] } | undefined;
    expect(apiScope?.enum).toEqual([...API_SCOPES]);

    // Each scope is also spelled out in the API-key scheme description for human readers.
    const description = (
      document.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME] as { description?: string }
    ).description;
    for (const scope of API_SCOPES) {
      expect(description).toContain(scope);
    }
  });

  it("lists the public API-key and webhook management endpoints", () => {
    const paths = Object.keys(document.paths ?? {});
    expect(paths).toContain("/businesses/{businessId}/api-keys");
    expect(paths).toContain("/businesses/{businessId}/api-keys/{keyId}");
    expect(paths).toContain("/businesses/{businessId}/api-keys/{keyId}/rotate");
    expect(paths).toContain("/businesses/{businessId}/webhooks");
    expect(paths).toContain("/businesses/{businessId}/webhooks/{endpointId}");
    expect(paths).toContain("/businesses/{businessId}/webhooks/{endpointId}/disable");
    expect(paths).toContain("/businesses/{businessId}/webhooks/{endpointId}/rotate-secret");
  });

  it("serves version 1 under the /api/v1 base path", () => {
    expect(document.servers?.[0]?.url).toBe("/api/v1");
  });

  it("documents request and response DTOs as components", () => {
    const schemas = document.components?.schemas ?? {};
    for (const name of [
      "ApiKey",
      "IssuedApiKey",
      "CreateApiKeyRequest",
      "WebhookEndpoint",
      "IssuedWebhookEndpoint",
      "CreateWebhookEndpointRequest",
      "UpdateWebhookEndpointRequest",
      "WebhookDelivery",
      "ProblemDetails",
    ]) {
      expect(schemas, `missing schema ${name}`).toHaveProperty(name);
    }
  });

  it("marks the created secret as required on the one-time issue response", () => {
    const issued = document.components?.schemas?.IssuedApiKey as
      { required?: string[] } | undefined;
    expect(issued?.required).toContain("secret");
    // The metadata-only representation never carries the plaintext secret.
    const metadata = document.components?.schemas?.ApiKey as
      { properties?: Record<string, unknown> } | undefined;
    expect(metadata?.properties).not.toHaveProperty("secret");
  });

  it("documents the webhook signature scheme and delivery envelope", () => {
    const description = document.info.description ?? "";
    expect(description).toContain(WEBHOOK_SIGNATURE_HEADER);
    expect(description).toContain(WEBHOOK_TIMESTAMP_HEADER);
    expect(description).toContain(WEBHOOK_DELIVERY_HEADER);
    expect(description).toContain("HMAC-SHA256");

    const envelope = document.components?.schemas?.WebhookDeliveryEnvelope as
      { required?: string[] } | undefined;
    expect(envelope?.required).toEqual(["id", "event", "createdAt", "data"]);

    const eventType = document.components?.schemas?.WebhookEventType as
      { enum?: string[] } | undefined;
    expect(eventType?.enum).toEqual([...WEBHOOK_EVENT_TYPES]);
  });

  it("uses the RFC 9457 problem shape for error responses", () => {
    const problem = document.components?.schemas?.ProblemDetails as
      { properties?: Record<string, unknown> } | undefined;
    expect(problem?.properties).toHaveProperty("code");
    expect(problem?.properties).toHaveProperty("requestId");
  });

  it("references only components that are defined (no dangling $ref)", () => {
    const schemas = document.components?.schemas ?? {};
    const refs = collectRefs(document);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith("#/components/schemas/"), `unexpected ref ${ref}`).toBe(true);
      const name = ref.replace("#/components/schemas/", "");
      expect(schemas, `dangling ref ${ref}`).toHaveProperty(name);
    }
  });

  it("is deterministic across builds", () => {
    expect(JSON.stringify(buildOpenApiDocument())).toBe(JSON.stringify(buildOpenApiDocument()));
  });
});

describe("DocsController", () => {
  it("serves the OpenAPI document at the spec route", () => {
    const document = new DocsController().getOpenApiDocument();
    expect(document.openapi).toMatch(/^3\.1\.\d+$/);
    expect(document.components?.securitySchemes?.[API_KEY_SECURITY_SCHEME]).toBeDefined();
  });
});
