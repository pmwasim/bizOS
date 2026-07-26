import "dotenv/config";
import { defineConfig } from "prisma/config";

const toolingDatabaseUrl =
  process.env.DATABASE_URL ?? "postgresql://invalid:invalid@localhost:5432/invalid";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Generate/validate do not connect. Runtime and migration environments still validate their
    // real DATABASE_URL before use; this harmless fallback keeps static tooling reproducible.
    url: toolingDatabaseUrl,
  },
});
