/**
 * Shared workspace inspection helpers for the agent tooling.
 *
 * These helpers are intentionally dependency-free and deterministic: the repository graph is
 * committed, so two agents running `pnpm graph` on the same tree must produce byte-identical
 * output. Anything non-deterministic (timestamps, git history, machine paths) belongs outside the
 * comparable payload.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";

export const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "test-results",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const TEST_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;

/** Convert an absolute path into a repository-relative POSIX path. */
export function toRepositoryPath(absolutePath) {
  return relative(repositoryRoot, absolutePath).split(sep).join(posix.sep);
}

/** Read and parse a JSON file, returning `undefined` when it does not exist. */
export async function readJsonFile(absolutePath) {
  if (!existsSync(absolutePath)) {
    return undefined;
  }

  return JSON.parse(await readFile(absolutePath, "utf8"));
}

/** Write JSON with a trailing newline so Prettier and git stay happy. */
export function serializeJson(value) {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

/**
 * Discover workspace members. The `pnpm-workspace.yaml` globs are fixed (`apps/*`, `packages/*`),
 * so this reads those directories directly rather than adding a YAML parser dependency.
 */
export async function discoverWorkspaces() {
  const groups = [
    { directory: "apps", type: "app" },
    { directory: "packages", type: "package" },
  ];

  const workspaces = [];

  for (const group of groups) {
    const absoluteGroup = join(repositoryRoot, group.directory);
    if (!existsSync(absoluteGroup)) {
      continue;
    }

    const entries = await readdir(absoluteGroup, { withFileTypes: true });

    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort(byName)) {
      const absoluteDirectory = join(absoluteGroup, entry.name);
      const manifest = await readJsonFile(join(absoluteDirectory, "package.json"));

      if (!manifest?.name) {
        continue;
      }

      workspaces.push({
        name: manifest.name,
        type: group.type,
        directory: toRepositoryPath(absoluteDirectory),
        absoluteDirectory,
        manifest,
      });
    }
  }

  return workspaces.sort((left, right) => left.name.localeCompare(right.name));
}

function byName(left, right) {
  return left.name.localeCompare(right.name);
}

/** Internal (`workspace:`) dependencies declared by a manifest, in stable order. */
export function internalDependencies(manifest, knownNames) {
  const declared = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };

  return Object.keys(declared)
    .filter((name) => knownNames.has(name))
    .sort();
}

/**
 * Walk a directory and collect source-file statistics plus first-level "areas".
 * An area is a first-level subdirectory of `src/`, which maps closely to a NestJS module or a
 * Next.js route group and is the unit agents most often claim.
 */
export async function summarizeSource(absoluteDirectory) {
  const sourceRoot = join(absoluteDirectory, "src");

  if (!existsSync(sourceRoot)) {
    return { sourceFiles: 0, testFiles: 0, areas: [] };
  }

  const totals = await countTree(sourceRoot);
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const areas = [];

  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort(byName)) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absoluteArea = join(sourceRoot, entry.name);
    const areaTotals = await countTree(absoluteArea);

    areas.push({
      name: entry.name,
      path: toRepositoryPath(absoluteArea),
      sourceFiles: areaTotals.sourceFiles,
      testFiles: areaTotals.testFiles,
    });
  }

  return { sourceFiles: totals.sourceFiles, testFiles: totals.testFiles, areas };
}

async function countTree(absoluteDirectory) {
  let sourceFiles = 0;
  let testFiles = 0;

  const entries = await readdir(absoluteDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const nested = await countTree(join(absoluteDirectory, entry.name));
      sourceFiles += nested.sourceFiles;
      testFiles += nested.testFiles;
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }

    sourceFiles += 1;
    if (TEST_PATTERN.test(entry.name)) {
      testFiles += 1;
    }
  }

  return { sourceFiles, testFiles };
}

/** Collect every Markdown file under a directory, as repository-relative paths. */
export async function markdownFiles(absoluteDirectory) {
  if (!existsSync(absoluteDirectory)) {
    return [];
  }

  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort(byName)) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      files.push(...(await markdownFiles(join(absoluteDirectory, entry.name))));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(toRepositoryPath(join(absoluteDirectory, entry.name)));
    }
  }

  return files.sort();
}

/** Parse `.github/CODEOWNERS` into ordered pattern/owner rules. */
export async function readCodeowners() {
  const absolute = join(repositoryRoot, ".github", "CODEOWNERS");

  if (!existsSync(absolute)) {
    return [];
  }

  const contents = await readFile(absolute, "utf8");

  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { pattern, owners };
    });
}

/** Resolve the owners for a repository path using last-match-wins CODEOWNERS semantics. */
export function ownersForPath(rules, repositoryPath) {
  let owners = [];

  for (const rule of rules) {
    if (matchesCodeownersPattern(rule.pattern, repositoryPath)) {
      owners = rule.owners;
    }
  }

  return owners;
}

function matchesCodeownersPattern(pattern, repositoryPath) {
  if (pattern === "*") {
    return true;
  }

  const normalized = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  const target = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;

  return repositoryPath === target || repositoryPath.startsWith(`${target}/`);
}

/** Ensure a file's parent directory exists. */
export function parentDirectory(absolutePath) {
  return dirname(absolutePath);
}
