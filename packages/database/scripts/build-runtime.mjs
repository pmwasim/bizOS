import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["src/index.ts"],
  format: "esm",
  outfile: "dist/index.js",
  packages: "external",
  platform: "node",
  sourcemap: true,
});
