#!/usr/bin/env node
/**
 * journal — the append-only development journal.
 *
 * Git history records what changed. The journal records why, what was tried and rejected, what was
 * verified, and what the next agent should pick up. It is the handoff surface between sessions and
 * between agents.
 *
 * Usage:
 *   node scripts/agent/journal.mjs new --title "<summary>" --agent <id> [--scope <path>]
 *   node scripts/agent/journal.mjs index    # rebuild docs/journal/README.md
 *   node scripts/agent/journal.mjs check    # validate entries and the index
 *   node scripts/agent/journal.mjs latest   # print the most recent entry path
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { repositoryRoot } from "./lib/workspace.mjs";

const journalDirectory = join(repositoryRoot, "docs", "journal");
const indexPath = join(journalDirectory, "README.md");
const templatePath = join(journalDirectory, "TEMPLATE.md");

const REQUIRED_SECTIONS = [
  "## Context",
  "## What changed",
  "## Decisions and trade-offs",
  "## Verification",
  "## Follow-ups",
  "## Handoff notes",
];

const REQUIRED_FIELDS = ["Date", "Agent", "Scope", "Status"];

const [command = "index", ...rest] = process.argv.slice(2);
const options = parseOptions(rest);

const handlers = {
  new: createEntry,
  index: rebuildIndex,
  check: checkJournal,
  latest: printLatest,
};

const handler = handlers[command];

if (!handler) {
  console.error(
    `Unknown command "${command}". Expected one of: ${Object.keys(handlers).join(", ")}.`,
  );
  process.exitCode = 1;
} else {
  await handler();
}

async function entryFiles() {
  if (!existsSync(journalDirectory)) {
    return [];
  }

  const entries = await readdir(journalDirectory, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "README.md" &&
        entry.name !== "TEMPLATE.md",
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

async function createEntry() {
  const title = requireOption("title");
  const agent = requireOption("agent");

  if (process.exitCode === 1) {
    return;
  }

  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const scopes = normalizeList(options.scope);
  const fileName = await uniqueFileName(date, title);
  const absolute = join(journalDirectory, fileName);

  const template = existsSync(templatePath) ? await readFile(templatePath, "utf8") : fallbackBody();

  const body = template
    .replace(/^# .*$/m, `# ${title}`)
    .replace(/^Date: .*$/m, `Date: ${date}`)
    .replace(/^Agent: .*$/m, `Agent: ${agent}`)
    .replace(/^Scope: .*$/m, `Scope: ${scopes.length > 0 ? scopes.join(", ") : "TODO"}`)
    .replace(/^Status: .*$/m, `Status: ${options.status ?? "In progress"}`);

  await writeFormattedMarkdown(absolute, body);
  await rebuildIndex({ quiet: true });

  process.stdout.write(`Journal entry created: docs/journal/${fileName}\n`);
}

async function uniqueFileName(date, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const base = `${date}-${slug || "entry"}`;
  let candidate = `${base}.md`;
  let suffix = 2;

  while (existsSync(join(journalDirectory, candidate))) {
    candidate = `${base}-${suffix}.md`;
    suffix += 1;
  }

  return candidate;
}

async function renderIndex() {
  const files = await entryFiles();
  const lines = [
    "# Development journal",
    "",
    "Append-only record of what each session changed and why. Git history answers *what*; the",
    "journal answers *why*, *what was rejected*, and *what is still open*.",
    "",
    'Create an entry with `pnpm journal:new -- --title "…" --agent <id>`, fill it as you work, and',
    "leave it complete enough that another agent can resume without asking you a question.",
    "",
    "Rules:",
    "",
    "- One entry per work session. Never edit or delete another agent's entry.",
    "- Correct a past entry by writing a new one that links back to it.",
    "- Record verification commands and their real result, not the intended result.",
    "- Regenerate this index with `pnpm journal:index`.",
    "",
    "## Entries",
    "",
  ];

  if (files.length === 0) {
    lines.push("No entries yet.");
    lines.push("");
    return lines.join("\n");
  }

  for (const file of files) {
    const contents = await readFile(join(journalDirectory, file), "utf8");
    const title = contents.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file;
    const agent = readField(contents, "Agent") ?? "unknown";
    const status = readField(contents, "Status") ?? "unknown";

    lines.push(`- [${file.slice(0, 10)} — ${title}](${file})`);
    lines.push(`  - Agent: ${agent} · Status: ${status}`);
  }

  lines.push("");
  return lines.join("\n");
}

async function rebuildIndex({ quiet = false } = {}) {
  await writeFormattedMarkdown(indexPath, await renderIndex());

  if (!quiet) {
    process.stdout.write("Journal index rebuilt.\n");
  }
}

async function checkJournal() {
  const problems = [];
  const files = await entryFiles();

  for (const file of files) {
    const contents = await readFile(join(journalDirectory, file), "utf8");

    for (const field of REQUIRED_FIELDS) {
      if (!readField(contents, field)) {
        problems.push(`${file}: missing "${field}:" header field`);
      }
    }

    for (const section of REQUIRED_SECTIONS) {
      if (!contents.includes(`${section}\n`)) {
        problems.push(`${file}: missing section "${section}"`);
      }
    }

    if (contents.includes("TODO") && readField(contents, "Status") === "Complete") {
      problems.push(`${file}: marked Complete but still contains a TODO placeholder`);
    }
  }

  const expectedIndex = await formatMarkdown(await renderIndex());
  const actualIndex = existsSync(indexPath) ? await readFile(indexPath, "utf8") : "";

  if (expectedIndex !== actualIndex) {
    problems.push("docs/journal/README.md is out of date — run `pnpm journal:index`");
  }

  if (problems.length > 0) {
    console.error("Journal check failed:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  const noun = files.length === 1 ? "entry" : "entries";
  process.stdout.write(`Journal is valid (${files.length} ${noun}).\n`);
}

async function printLatest() {
  const [latest] = await entryFiles();

  if (!latest) {
    console.error("No journal entries yet.");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`docs/journal/${latest}\n`);
}

function readField(contents, field) {
  return contents.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

/**
 * Format with the repository's own Prettier config so generated Markdown never breaks
 * `pnpm format:check`. Falls back to raw output if Prettier cannot be loaded.
 */
async function formatMarkdown(source) {
  try {
    const prettier = await import("prettier");
    const config = (await prettier.resolveConfig(indexPath)) ?? {};
    return await prettier.format(source, { ...config, parser: "markdown" });
  } catch {
    return source.endsWith("\n") ? source : `${source}\n`;
  }
}

async function writeFormattedMarkdown(absolutePath, source) {
  await writeFile(absolutePath, await formatMarkdown(source), "utf8");
}

function fallbackBody() {
  return [
    "# Untitled entry",
    "",
    "Date: TODO",
    "Agent: TODO",
    "Scope: TODO",
    "Status: In progress",
    "",
    ...REQUIRED_SECTIONS.flatMap((section) => [section, "", "TODO", ""]),
  ].join("\n");
}

function normalizeList(raw) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return [
    ...new Set(
      values
        .flatMap((value) => String(value).split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

function requireOption(name) {
  const value = options[name];

  if (typeof value !== "string" || value.trim().length === 0) {
    console.error(`--${name} is required.`);
    process.exitCode = 1;
    return "";
  }

  return value.trim();
}

function parseOptions(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    if (key === "scope") {
      parsed.scope = [...(Array.isArray(parsed.scope) ? parsed.scope : []), next];
    } else {
      parsed[key] = next;
    }

    index += 1;
  }

  return parsed;
}
