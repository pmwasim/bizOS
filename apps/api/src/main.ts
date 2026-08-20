import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { readApiEnvironment } from "@bizo/config/api";

import { AppModule } from "./app.module.js";
import { ProblemDetailsFilter } from "./common/problem-details.filter.js";
import { buildOpenApiDocument } from "./docs/openapi-document.js";

async function bootstrap(): Promise<void> {
  const environment = readApiEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.use(json({ limit: "100kb" }));
  app.use(urlencoded({ extended: false, limit: "50kb", parameterLimit: 100 }));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      frameguard: { action: "deny" },
    }),
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Interactive API reference (Swagger UI). Assets are served from the app's own origin — no CDN at
  // request time — so it renders under the default helmet CSP and offline. The raw spec is also
  // exposed by DocsController at GET /api/v1/docs/openapi.json.
  SwaggerModule.setup("docs", app, buildOpenApiDocument(), {
    useGlobalPrefix: false,
    customSiteTitle: "bizOS API reference",
  });

  await app.listen(environment.API_PORT, "0.0.0.0");
}

void bootstrap();
