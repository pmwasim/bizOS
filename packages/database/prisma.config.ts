import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

// `dotenv/config` resolves relative to the working directory, which is this package when Prisma is
// invoked through a workspace filter. Load the repository-root `.env` as well so a clean local
// checkout can run migrations without exporting DATABASE_URL by hand. Values already present in the
// environment always win, which keeps CI and deployment injection authoritative.
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
loadEnvironment();
loadEnvironment({ path: join(packageRoot, "../..", ".env") });

const toolingDatabaseUrl =
  process.env.DATABASE_URL ?? "postgresql://invalid:invalid@localhost:5432/invalid";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node dist/seed.js",
  },
  datasource: {
    // Generate/validate do not connect. Runtime and migration environments still validate their
    // real DATABASE_URL before use; this harmless fallback keeps static tooling reproducible.
    url: toolingDatabaseUrl,
  },
});
