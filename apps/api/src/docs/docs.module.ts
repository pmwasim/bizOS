import { Module } from "@nestjs/common";

import { DocsController } from "./docs.controller.js";

/**
 * Exposes the OpenAPI 3.1 spec route. The interactive Swagger UI is wired in `main.ts` because it is
 * mounted as Express middleware on the HTTP adapter rather than as a Nest controller.
 */
@Module({
  controllers: [DocsController],
})
export class DocsModule {}
