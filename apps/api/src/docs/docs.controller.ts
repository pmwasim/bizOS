import { Controller, Get } from "@nestjs/common";
import { type OpenAPIObject } from "@nestjs/swagger";

import { Public } from "../security/public.decorator.js";
import { buildOpenApiDocument } from "./openapi-document.js";

/**
 * Serves the machine-readable OpenAPI 3.1 description of the public API at a stable, versioned,
 * unauthenticated route (`GET /api/v1/docs/openapi.json`). The interactive reference UI is mounted
 * separately in `main.ts` via {@link SwaggerModule}; both render the same {@link buildOpenApiDocument}
 * output, so the spec has a single source of truth.
 */
@Public()
@Controller("docs")
export class DocsController {
  private readonly document: OpenAPIObject = buildOpenApiDocument();

  @Get("openapi.json")
  getOpenApiDocument(): OpenAPIObject {
    return this.document;
  }
}
