import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(absolute)));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(absolute);
    }
  }

  return files;
}

const failures = [];
const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;

for (const file of await markdownFiles(root)) {
  const contents = await readFile(file, "utf8");

  for (const match of contents.matchAll(linkPattern)) {
    const destination = match[1]?.trim();
    if (!destination || destination.startsWith("#") || /^(?:https?:|mailto:)/.test(destination)) {
      continue;
    }

    const path = decodeURIComponent(destination.split("#", 1)[0]);
    try {
      const target = await stat(resolve(dirname(file), path));
      if (!target.isFile() && !target.isDirectory()) {
        failures.push(`${file}: ${destination}`);
      }
    } catch {
      failures.push(`${file}: ${destination}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Broken local Markdown links:\n${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("All local Markdown links resolve.\n");
}
