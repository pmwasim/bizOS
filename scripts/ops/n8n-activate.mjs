#!/usr/bin/env node
/**
 * Import sanitized bizOS n8n workflow templates and optionally activate them.
 *
 *   node scripts/ops/n8n-activate.mjs [--container bizos-n8n] [--activate]
 *
 * Templates in git always ship with active: false. Activation happens only at
 * runtime against a running n8n container.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "../..");
const WORKFLOW_DIR = join(REPO_ROOT, "docs/operations/n8n-workflows");
const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://127.0.0.1:5678";
const OWNER_EMAIL = process.env.N8N_OWNER_EMAIL ?? "ops@bizos.local";
const OWNER_PASSWORD = process.env.N8N_OWNER_PASSWORD ?? "BizosN8nLocal1";

function parseArgs(argv) {
  const options = { activate: false, container: process.env.N8N_CONTAINER ?? "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--activate") {
      options.activate = true;
    } else if (arg === "--container") {
      options.container = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.error("Usage: node scripts/ops/n8n-activate.mjs [--container NAME] [--activate]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function docker(args, options = {}) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function resolveContainer(preferred) {
  if (preferred) {
    docker(["inspect", preferred]);
    return preferred;
  }
  for (const name of ["bizos-n8n", "qh-n8n"]) {
    try {
      docker(["inspect", name]);
      return name;
    } catch {
      // try next
    }
  }
  throw new Error(
    "No n8n container found. Start one with: docker compose --env-file .env --profile ops up -d n8n",
  );
}

function workflowFiles() {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(WORKFLOW_DIR, name))
    .sort();
}

function loadTemplate(path) {
  const workflow = JSON.parse(readFileSync(path, "utf8"));
  if (workflow.active !== false) {
    throw new Error(`${path} must ship with active: false`);
  }
  return { ...workflow, active: false };
}

function importViaCli(container, files) {
  const tempDir = mkdtempSync(join(tmpdir(), "bizos-n8n-"));
  for (const file of files) {
    const workflow = loadTemplate(file);
    const payload = [workflow];
    const staged = join(tempDir, `${workflow.name.replaceAll(" ", "-")}.json`);
    writeFileSync(staged, JSON.stringify(payload));
    const remote = `/tmp/bizos-import-${workflow.name.replaceAll(" ", "-")}.json`;
    docker(["cp", staged, `${container}:${remote}`]);
    const output = docker(["exec", container, "n8n", "import:workflow", `--input=${remote}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.stderr.write(`Imported ${workflow.name}\n${output}`);
  }
}

function parseWorkflowList(text) {
  const workflows = [];
  const jsonMatch = text.trim().startsWith("[") || text.trim().startsWith("{");
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.workflows ?? []);
      for (const row of rows) {
        if (row?.id && row?.name) {
          workflows.push({
            id: String(row.id),
            name: String(row.name),
            active: Boolean(row.active),
          });
        }
      }
      return workflows;
    } catch {
      // fall through to text parse
    }
  }

  for (const line of text.split("\n")) {
    const columns = line.split("|").map((part) => part.trim());
    if (columns.length >= 3 && /^\d+$/.test(columns[0])) {
      workflows.push({
        id: columns[0],
        name: columns[1],
        active: columns[2] === "true" || columns[2] === "Active",
      });
    }
  }
  return workflows.filter((row) => row.name.toLowerCase().includes("bizos"));
}

function listWorkflows(container) {
  let rows = [];
  try {
    const json = docker(["exec", container, "n8n", "list:workflow", "--onlyId"]);
    rows = parseWorkflowList(json);
  } catch {
    // older CLI without --onlyId
  }
  if (rows.length === 0) {
    const text = docker(["exec", container, "n8n", "list:workflow"]);
    rows = parseWorkflowList(text);
  }
  return rows.filter((row) => /bizos/i.test(row.name));
}

function activateViaCli(container, workflows) {
  for (const workflow of workflows) {
    docker(["exec", container, "n8n", "update:workflow", `--id=${workflow.id}`, "--active=true"]);
    process.stderr.write(`Activated ${workflow.name} (${workflow.id})\n`);
  }
}

async function requestJson(url, init = {}, cookieJar = []) {
  const headers = { ...(init.headers ?? {}) };
  if (cookieJar.length > 0) {
    headers.cookie = cookieJar.join("; ");
  }
  const response = await fetch(url, { ...init, headers });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    cookieJar.push(cookie.split(";")[0]);
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, cookieJar };
}

async function bootstrapAndActivateViaRest(workflows) {
  const cookieJar = [];
  const setup = await requestJson(
    `${N8N_BASE_URL}/rest/owner/setup`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: OWNER_EMAIL,
        firstName: "bizOS",
        lastName: "Ops",
        password: OWNER_PASSWORD,
      }),
    },
    cookieJar,
  );

  if (!setup.response.ok && setup.response.status !== 400) {
    throw new Error(`n8n owner setup failed: ${setup.response.status}`);
  }

  const login = await requestJson(
    `${N8N_BASE_URL}/rest/login`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailOrLdapLoginId: OWNER_EMAIL, password: OWNER_PASSWORD }),
    },
    cookieJar,
  );

  if (!login.response.ok) {
    const basicAuth = Buffer.from(
      `${process.env.N8N_BASIC_AUTH_USER ?? "admin"}:${process.env.N8N_BASIC_AUTH_PASSWORD ?? "bizos-local-n8n-password"}`,
    ).toString("base64");
    const basicLogin = await requestJson(
      `${N8N_BASE_URL}/rest/login`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({ emailOrLdapLoginId: OWNER_EMAIL, password: OWNER_PASSWORD }),
      },
      cookieJar,
    );
    if (!basicLogin.response.ok) {
      throw new Error(`n8n login failed: ${login.response.status}`);
    }
  }

  const listed = await requestJson(`${N8N_BASE_URL}/rest/workflows`, { method: "GET" }, cookieJar);
  const rows = Array.isArray(listed.body) ? listed.body : (listed.body?.data ?? []);
  const byName = new Map(rows.map((row) => [row.name, row]));

  for (const workflow of workflows) {
    const remote = byName.get(workflow.name);
    if (!remote?.id) {
      continue;
    }
    const updated = await requestJson(
      `${N8N_BASE_URL}/rest/workflows/${remote.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: true }),
      },
      cookieJar,
    );
    if (!updated.response.ok) {
      throw new Error(`Failed to activate ${workflow.name}: ${updated.response.status}`);
    }
    process.stderr.write(`Activated ${workflow.name} via API (${remote.id})\n`);
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${N8N_BASE_URL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`n8n did not become healthy at ${N8N_BASE_URL}/healthz`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = workflowFiles();
  if (files.length === 0) {
    throw new Error(`No workflow JSON files in ${WORKFLOW_DIR}`);
  }

  const container = resolveContainer(options.container);
  process.stderr.write(`Using n8n container ${container}\n`);
  await waitForHealth();
  importViaCli(container, files);

  const workflows = listWorkflows(container);
  process.stderr.write(
    `Imported bizOS workflows:\n${workflows.map((row) => `  ${row.id}  ${row.active ? "active" : "inactive"}  ${row.name}`).join("\n")}\n`,
  );

  if (!options.activate) {
    process.stderr.write(
      "Skipping activation. Re-run with --activate after reviewing env/credentials.\n",
    );
    return;
  }

  try {
    activateViaCli(container, workflows);
  } catch (error) {
    process.stderr.write(
      `CLI activate failed (${error instanceof Error ? error.message : error}); trying REST.\n`,
    );
    await bootstrapAndActivateViaRest(workflows);
  }

  const after = listWorkflows(container);
  const inactive = after.filter((row) => !row.active);
  if (inactive.length > 0) {
    throw new Error(
      `Activation incomplete: ${inactive.map((row) => row.name).join(", ")} still inactive`,
    );
  }
  process.stderr.write("All imported bizOS workflows are active.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
