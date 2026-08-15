/**
 * Repository-root Prisma configuration.
 *
 * The schema lives in `packages/database`, and tooling invoked through the workspace filter picks
 * up that package's own `prisma.config.ts`. Hosted build systems (Prisma Compute Deploy) instead
 * run `prisma migrate deploy` from the repository root, discover the schema by convention, and
 * then fail with "The datasource.url property is required in your Prisma config file". This file
 * gives those runners the same schema, migrations directory, and datasource the package config
 * declares, so root-level and package-level invocations agree.
 *
 * Deliberately import-free: the repository root is not a package with `prisma` or `dotenv`
 * installed, and a hosted runner loading this file must not depend on workspace hoisting. Root
 * invocations always receive a real `DATABASE_URL` from their environment.
 */
export default {
  schema: "packages/database/prisma/schema.prisma",
  migrations: {
    path: "packages/database/prisma/migrations",
  },
  datasource: {
    // Generate and validate never connect. Anything that does connect is given a real
    // DATABASE_URL by its environment; this fallback only keeps static tooling reproducible on a
    // checkout with no environment at all.
    url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@localhost:5432/invalid",
  },
};
