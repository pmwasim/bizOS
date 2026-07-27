// Phase 5/6 — Database seed entry point.
//
// Run via `prisma db seed` (configured in prisma.config.ts). Reads DATABASE_URL from the
// environment, creates a Prisma client with the pg adapter, and runs all seeds in order.
//
// The seed is idempotent: re-running upserts by natural key and never overwrites a
// PUBLISHED version's immutable JSON. See seeds/index.ts for the orchestrator.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client/client.js";
import { runAllSeeds } from "./seeds/index.js";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env or the environment before running pnpm db:seed.",
    );
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // eslint-disable-next-line no-console
    console.log("[seed] Starting bizOS configuration seed...");
    const result = await runAllSeeds(prisma);
    // eslint-disable-next-line no-console
    console.log("[seed] Seed complete:", {
      modules: result.modules,
      configurationTemplates: result.configurationTemplates,
      configurationTemplateVersions: result.configurationTemplateVersions,
      workflowTemplates: result.workflowTemplates,
      workflowTemplateVersions: result.workflowTemplateVersions,
      skippedPublished: result.skippedPublished,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
