import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { readApiEnvironment } from "@bizo/config/api";

import { AppModule } from "./app.module.js";

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

  await app.listen(environment.API_PORT, "0.0.0.0");
}

void bootstrap();
