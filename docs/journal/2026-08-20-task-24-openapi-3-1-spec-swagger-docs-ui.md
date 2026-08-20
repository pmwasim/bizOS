# TASK-24: OpenAPI 3.1 spec & Swagger docs UI

Date: 2026-08-20

Agent: claude

Scope: apps/api, docs

Status: Done

Related: [docs/api-guidelines.md](../api-guidelines.md); TASK-22 (scoped API keys), TASK-23
(webhooks)

## Context

TASK-22 added scoped API keys (`apps/api/src/public-api`) and TASK-23 added signed outbound webhooks
(`apps/api/src/webhooks`), but the public REST surface had no machine-readable description and no
docs UI. `docs/api-guidelines.md` already commits the public API to being "resource-oriented
HTTP+JSON described by OpenAPI". This task produces that OpenAPI 3.1 document and serves an
interactive reference.

## What changed

1. **`apps/api/src/docs/openapi-document.ts`** — pure, deterministic `buildOpenApiDocument()` that
   assembles an OpenAPI **3.1.1** document. Component schemas are generated from the existing Zod
   contracts (`@bizo/contracts/api-keys`, `@bizo/contracts/webhooks`) via Zod 4's
   `z.toJSONSchema(..., { target: "draft-2020-12", io })` — request bodies use the `"input"`
   projection (defaulted fields become optional), responses use `"output"`. Documents both security
   schemes (`apiKey` HTTP bearer + the eight `<resource>:<access>` scopes; `sessionAuth` for the
   human-operated management endpoints), the seven management endpoints, the RFC 9457
   `ProblemDetails` error shape, the rate-limit headers, and the webhook signature scheme + delivery
   envelope (documentation-only).
2. **`apps/api/src/docs/docs.controller.ts`** — `@Public()` controller serving the raw spec at
   `GET /api/v1/docs/openapi.json`.
3. **`apps/api/src/docs/docs.module.ts`** — wires the controller; added to `AppModule` imports.
4. **`apps/api/src/main.ts`** — mounts Swagger UI at `GET /docs` via `SwaggerModule.setup(...)` over
   the same document. Assets are served from the app origin (swagger-ui-express), so it renders
   offline and under the existing default `helmet` CSP — no CDN at request time.
5. **`apps/api/src/docs/openapi-document.spec.ts`** — 12 tests: asserts `openapi` is `3.1.x`, the
   API-key scheme + all scopes are present, the key endpoints and DTO/error components exist, the
   webhook signature scheme is documented, every `$ref` resolves, and the build is deterministic.
6. **`docs/public-api.md`** — how to authenticate with an API key, the rate-limit headers, and how
   to verify a webhook signature (with a Node snippet mirroring `webhook-signature.ts`).
7. **Dependencies** — added `@nestjs/swagger@11.4.7` and `swagger-ui-express@5.0.1` to
   `apps/api/package.json` (pinned to match repo convention). Set `@scarf/scarf: false` in
   `pnpm-workspace.yaml` `allowBuilds` (transitive telemetry build script, blocked).

## Decisions and trade-offs

- **Generated the spec from the Zod contracts, not from `@nestjs/swagger` decorators.** The repo is
  Zod-first (DTOs are Zod schemas validated by `ContractPipe`, not class-validator classes), so
  `@nestjs/swagger`'s reflection-based DTO introspection would have required hand-annotating
  parallel classes. Converting the existing contracts with `z.toJSONSchema` keeps a single source of
  truth and is deterministic. `@nestjs/swagger` is still used, but only for its
  `SwaggerModule.setup` UI wiring (fed our pre-built document).
- **Swagger UI over Scalar.** Scalar's NestJS integration loads its bundle from a CDN by default,
  which the default helmet CSP (`script-src 'self'`) forbids. `swagger-ui-express` (via
  `SwaggerModule`) serves `swagger-ui-init.js` and assets as files from the app origin, so it
  renders fully offline and CSP-clean.
- The management endpoints are session-authenticated (they sit behind the global
  `InternalAuthGuard`, not the API-key guard), so their operations carry `sessionAuth`; the `apiKey`
  scheme + scopes are documented as the programmatic-access credential. No new endpoints were added.

## Verification

```text
pnpm --filter @bizo/contracts build      # passed
pnpm --filter "@bizo/api^..." build       # passed (built config, contracts, database, etc.)
pnpm --filter @bizo/api typecheck         # passed (exit 0)
pnpm --filter @bizo/api build             # passed (nest build, exit 0)
pnpm --filter @bizo/api exec vitest run   # passed: 865 passed | 71 skipped (0 failures)
pnpm format:check                         # passed (all files use Prettier code style)
pnpm lint                                 # passed (exit 0)
pnpm audit --audit-level=moderate         # passed (No known vulnerabilities found)
```

Runtime spot-check of `buildOpenApiDocument()`: `openapi: 3.1.1`, 7 paths, 13 component schemas,
security schemes `apiKey`/`sessionAuth`, `ApiScope.enum` = all 8 scopes, `CreateApiKeyRequest`
required omits the defaulted `expiresAt`.

## Follow-ups

- When the programmatic data endpoints (the ones actually guarded by `ApiKeyAuthGuard` +
  `@RequireScopes`) are built, add their paths to `buildOpenApiDocument()` with
  `security: [{ apiKey: [] }]`. The scheme and scope components are already in place.
- Optional: a CI check that the served spec parses against an OpenAPI 3.1 validator.

## Handoff notes

- The spec is generated, not committed as a static file — `GET /api/v1/docs/openapi.json` (raw) and
  `GET /docs` (UI). If you add a Zod field to the api-key/webhook contracts it appears
  automatically.
- `z.toJSONSchema` silently ignores `.refine`/`.superRefine` (e.g. the "at least one field" rule on
  the webhook update request), so cross-field constraints are documented in prose, not schema.
- No claim held open; no migration.
