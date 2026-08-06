#!/usr/bin/env node
/**
 * graphify — build the bizOS repository knowledge graph.
 *
 * Writes `.agent/graph.json` (machine-readable) and `.agent/graph.md` (human-readable). Both are
 * committed so an agent can orient itself by reading one file instead of crawling the tree.
 *
 * Usage:
 *   node scripts/agent/graphify.mjs           # regenerate both artifacts
 *   node scripts/agent/graphify.mjs --check   # fail if the committed graph is stale
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  discoverWorkspaces,
  internalDependencies,
  markdownFiles,
  ownersForPath,
  readCodeowners,
  readJsonFile,
  repositoryRoot,
  serializeJson,
  summarizeSource,
} from "./lib/workspace.mjs";

const GRAPH_VERSION = 1;
const agentDirectory = join(repositoryRoot, ".agent");
const graphJsonPath = join(agentDirectory, "graph.json");
const graphMarkdownPath = join(agentDirectory, "graph.md");

const checkOnly = process.argv.includes("--check");

const graph = await buildGraph();
const graphJson = serializeJson(graph);
const graphMarkdown = renderMarkdown(graph);

if (checkOnly) {
  await verifyCommittedArtifacts(graphJson, graphMarkdown);
} else {
  await mkdir(agentDirectory, { recursive: true });
  await writeFile(graphJsonPath, graphJson, "utf8");
  await writeFile(graphMarkdownPath, graphMarkdown, "utf8");
  process.stdout.write(
    `Repository graph written: ${graph.summary.workspaceCount} workspaces, ` +
      `${graph.summary.edgeCount} internal dependency edges, ` +
      `${graph.summary.adrCount} decision records.\n`,
  );
}

async function buildGraph() {
  const workspaces = await discoverWorkspaces();
  const knownNames = new Set(workspaces.map((workspace) => workspace.name));
  const codeowners = await readCodeowners();
  const adrs = await readDecisionRecords();
  const handbookDocuments = await readHandbookDocuments();

  const nodes = [];
  const edges = [];

  for (const workspace of workspaces) {
    const dependencies = internalDependencies(workspace.manifest, knownNames);
    const source = await summarizeSource(workspace.absoluteDirectory);

    for (const dependency of dependencies) {
      edges.push({ from: workspace.name, to: dependency, kind: "workspace-dependency" });
    }

    nodes.push({
      name: workspace.name,
      type: workspace.type,
      path: workspace.directory,
      description: workspace.manifest.description ?? null,
      owners: ownersForPath(codeowners, workspace.directory),
      dependsOn: dependencies,
      dependedOnBy: [],
      scripts: Object.keys(workspace.manifest.scripts ?? {}).sort(),
      sourceFiles: source.sourceFiles,
      testFiles: source.testFiles,
      areas: source.areas,
      governingDocs: [],
    });
  }

  const nodesByName = new Map(nodes.map((node) => [node.name, node]));

  for (const edge of edges) {
    nodesByName.get(edge.to)?.dependedOnBy.push(edge.from);
  }

  for (const node of nodes) {
    node.dependedOnBy.sort();
    node.governingDocs = documentsReferencing(handbookDocuments, node);
  }

  return {
    version: GRAPH_VERSION,
    generator: "scripts/agent/graphify.mjs",
    note: "Generated artifact. Run `pnpm graph` after changing workspaces, docs, or decisions.",
    summary: {
      workspaceCount: nodes.length,
      appCount: nodes.filter((node) => node.type === "app").length,
      packageCount: nodes.filter((node) => node.type === "package").length,
      edgeCount: edges.length,
      adrCount: adrs.length,
      handbookDocumentCount: handbookDocuments.length,
    },
    buildOrder: topologicalLayers(nodes),
    workspaces: nodes,
    edges: edges.sort(
      (left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
    ),
    decisions: adrs,
    rootCommands: await readRootCommands(),
    entryPoints: knownEntryPoints(nodesByName),
  };
}

/**
 * Group workspaces into dependency layers. Layer 0 has no internal dependencies; each later layer
 * depends only on earlier ones. Agents use this to reason about blast radius and build order.
 */
function topologicalLayers(nodes) {
  const remaining = new Map(nodes.map((node) => [node.name, new Set(node.dependsOn)]));
  const layers = [];
  const settled = new Set();

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => [...dependencies].every((name) => settled.has(name)))
      .map(([name]) => name)
      .sort();

    if (ready.length === 0) {
      // A cycle would be a real architecture problem; surface it rather than looping forever.
      layers.push({ layer: layers.length, cycle: [...remaining.keys()].sort() });
      break;
    }

    layers.push({ layer: layers.length, workspaces: ready });

    for (const name of ready) {
      remaining.delete(name);
      settled.add(name);
    }
  }

  return layers;
}

async function readDecisionRecords() {
  const directory = join(repositoryRoot, "docs", "decisions");
  const files = await markdownFiles(directory);
  const records = [];

  for (const file of files) {
    if (file.endsWith("README.md")) {
      continue;
    }

    const contents = await readFile(join(repositoryRoot, file), "utf8");
    const title = contents.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
    const status = contents.match(/^Status:\s*(.+)$/m)?.[1]?.trim() ?? "Unknown";
    const date = contents.match(/^Date:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const identifier = file.match(/(\d{4})-/)?.[1] ?? null;

    records.push({ id: identifier, title, status, date, path: file });
  }

  return records;
}

async function readHandbookDocuments() {
  const files = await markdownFiles(join(repositoryRoot, "docs"));
  const documents = [];

  for (const file of files) {
    if (file.startsWith("docs/journal/")) {
      continue;
    }

    documents.push({ path: file, contents: await readFile(join(repositoryRoot, file), "utf8") });
  }

  return documents;
}

/**
 * A document governs a workspace when it names the workspace package or its directory. This is a
 * heuristic pointer, not an authority claim — the handbook remains the source of truth.
 */
function documentsReferencing(documents, node) {
  const needles = [node.name, node.path];

  return documents
    .filter((document) => needles.some((needle) => document.contents.includes(needle)))
    .map((document) => document.path)
    .sort();
}

async function readRootCommands() {
  const manifest = await readJsonFile(join(repositoryRoot, "package.json"));
  const scripts = manifest?.scripts ?? {};

  return Object.keys(scripts)
    .sort()
    .map((name) => ({ name, command: scripts[name] }));
}

function knownEntryPoints(nodesByName) {
  const candidates = [
    { path: "apps/api/src/main.ts", role: "API process entry point", workspace: "@bizo/api" },
    { path: "apps/api/src/app.module.ts", role: "API module composition", workspace: "@bizo/api" },
    { path: "apps/web/src/app", role: "Next.js App Router tree", workspace: "@bizo/web" },
    { path: "apps/web/src/auth.ts", role: "Auth.js session boundary", workspace: "@bizo/web" },
    {
      path: "packages/database/prisma/schema.prisma",
      role: "Database schema of record",
      workspace: "@bizo/database",
    },
  ];

  return candidates
    .filter(
      (candidate) =>
        nodesByName.has(candidate.workspace) && existsSync(join(repositoryRoot, candidate.path)),
    )
    .map((candidate) => ({ path: candidate.path, role: candidate.role }));
}

function renderMarkdown(graph) {
  const lines = [];

  lines.push("# Repository graph");
  lines.push("");
  lines.push(
    "Generated by `pnpm graph`. Do not edit by hand. This is the fastest orientation surface for an",
    "agent joining the project: read this file, then the handbook sections it points at.",
  );
  lines.push("");
  lines.push(
    `${graph.summary.workspaceCount} workspaces ` +
      `(${graph.summary.appCount} apps, ${graph.summary.packageCount} packages) · ` +
      `${graph.summary.edgeCount} internal dependency edges · ` +
      `${graph.summary.adrCount} decision records.`,
  );
  lines.push("");

  lines.push("## Dependency layers");
  lines.push("");
  lines.push("Layer 0 has no internal dependencies. A change in a lower layer can affect every");
  lines.push("layer above it.");
  lines.push("");
  for (const layer of graph.buildOrder) {
    if (layer.cycle) {
      lines.push(`- **Cycle detected**: ${layer.cycle.join(", ")}`);
      continue;
    }

    lines.push(`- **Layer ${layer.layer}**: ${layer.workspaces.join(", ")}`);
  }
  lines.push("");

  lines.push("## Workspaces");
  lines.push("");
  lines.push("| Workspace | Type | Path | Depends on | Depended on by | Source | Tests |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const workspace of graph.workspaces) {
    lines.push(
      `| \`${workspace.name}\` | ${workspace.type} | \`${workspace.path}\` | ` +
        `${formatList(workspace.dependsOn)} | ${formatList(workspace.dependedOnBy)} | ` +
        `${workspace.sourceFiles} | ${workspace.testFiles} |`,
    );
  }
  lines.push("");

  lines.push("## Claimable areas");
  lines.push("");
  lines.push("First-level source areas. These are the natural units for a work claim");
  lines.push("(`pnpm agent:claim`), because two agents editing the same area will collide.");
  lines.push("");
  for (const workspace of graph.workspaces) {
    if (workspace.areas.length === 0) {
      continue;
    }

    lines.push(`### \`${workspace.name}\``);
    lines.push("");
    for (const area of workspace.areas) {
      lines.push(
        `- \`${area.path}\` — ${plural(area.sourceFiles, "source file")}, ` +
          `${plural(area.testFiles, "test file")}`,
      );
    }
    lines.push("");
  }

  lines.push("## Entry points");
  lines.push("");
  for (const entry of graph.entryPoints) {
    lines.push(`- \`${entry.path}\` — ${entry.role}`);
  }
  lines.push("");

  lines.push("## Decision records");
  lines.push("");
  lines.push("| ADR | Title | Status |");
  lines.push("| --- | --- | --- |");
  for (const decision of graph.decisions) {
    lines.push(`| ${decision.id ?? "—"} | ${decision.title ?? "—"} | ${decision.status} |`);
  }
  lines.push("");

  lines.push("## Governing documents");
  lines.push("");
  lines.push("Handbook documents that name each workspace. Update them in the same change that");
  lines.push("invalidates them.");
  lines.push("");
  for (const workspace of graph.workspaces) {
    lines.push(`- \`${workspace.name}\`: ${formatList(workspace.governingDocs)}`);
  }
  lines.push("");

  return `${lines.join("\n")}`;
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatList(values) {
  if (!values || values.length === 0) {
    return "—";
  }

  return values.map((value) => `\`${value}\``).join(", ");
}

async function verifyCommittedArtifacts(expectedJson, expectedMarkdown) {
  const problems = [];

  for (const [path, expected] of [
    [graphJsonPath, expectedJson],
    [graphMarkdownPath, expectedMarkdown],
  ]) {
    if (!existsSync(path)) {
      problems.push(`${path} is missing`);
      continue;
    }

    if ((await readFile(path, "utf8")) !== expected) {
      problems.push(`${path} is out of date`);
    }
  }

  if (problems.length > 0) {
    console.error("Repository graph is stale:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    console.error("Run `pnpm graph` and commit the result.");
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Repository graph is current.\n");
}
