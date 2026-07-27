// Bundles prisma/seed.ts into dist/seed.js using esbuild.
// The generated Prisma client (TypeScript source) and the seed modules are inlined;
// node_modules dependencies (pg adapter, contracts, dotenv) stay external so Node
// resolves them from node_modules at runtime. This avoids needing a TS runner for the
// seed while keeping the generated client's TS source importable.

import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["prisma/seed.ts"],
  format: "esm",
  outfile: "dist/seed.js",
  packages: "external",
  platform: "node",
  sourcemap: true,
});
