#!/usr/bin/env node
/**
 * Thin launcher. Prefer: pnpm --filter @bizo/storage validate:r2
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync("pnpm", ["--filter", "@bizo/storage", "validate:r2"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
