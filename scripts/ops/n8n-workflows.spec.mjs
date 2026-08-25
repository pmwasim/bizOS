import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DELIVER_ALERT, FETCH_GITHUB_RUNS } from "./n8n-code-snippets.mjs";

const WORKFLOW_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/operations/n8n-workflows",
);

const REQUIRED = [
  "customization-request-notify.json",
  "ci-failure-notify.json",
  "github-actions-poll.json",
  "health-monitor.json",
  "ops-event-notify.json",
];

function loadWorkflows() {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => ({
      name,
      workflow: JSON.parse(readFileSync(join(WORKFLOW_DIR, name), "utf8")),
    }));
}

function nodeNames(workflow) {
  return new Set((workflow.nodes ?? []).map((node) => node.name));
}

function connectionTargets(workflow) {
  const targets = new Set();
  for (const outputs of Object.values(workflow.connections ?? {})) {
    for (const branch of outputs.main ?? []) {
      for (const link of branch ?? []) {
        targets.add(link.node);
      }
    }
  }
  return targets;
}

test("exports the required sanitized bizOS workflow catalog", () => {
  const files = new Set(loadWorkflows().map((entry) => entry.name));
  for (const required of REQUIRED) {
    assert.ok(files.has(required), `missing ${required}`);
  }
});

test("templates stay inactive, secret-free, and internally connected", () => {
  for (const { name, workflow } of loadWorkflows()) {
    assert.equal(workflow.active, false, `${name} must ship inactive`);
    assert.match(workflow.name, /^bizOS /);
    const serialized = JSON.stringify(workflow);
    assert.doesNotMatch(serialized, /sk_live|ghp_|xoxb-|BEGIN PRIVATE KEY/);
    assert.doesNotMatch(serialized, /N8N_WEBHOOK_SECRET=.+/);

    const names = nodeNames(workflow);
    const targets = connectionTargets(workflow);
    for (const target of targets) {
      assert.ok(names.has(target), `${name} connects to missing node ${target}`);
    }
  }
});

test("webhook and cron workflows deliver alerts instead of log-only stubs", () => {
  const byFile = Object.fromEntries(loadWorkflows().map((entry) => [entry.name, entry.workflow]));

  assert.ok(
    (byFile["ops-event-notify.json"].nodes ?? []).some((node) => node.name === "Deliver Alert"),
  );
  assert.ok(JSON.stringify(byFile["ops-event-notify.json"]).includes("BIZOS_OPS_MAILPIT_URL"));
  assert.ok(JSON.stringify(byFile["ops-event-notify.json"]).includes("bizos/ops-event"));

  for (const file of [
    "customization-request-notify.json",
    "ci-failure-notify.json",
    "github-actions-poll.json",
    "health-monitor.json",
  ]) {
    const serialized = JSON.stringify(byFile[file]);
    assert.equal(serialized.includes("Log Route"), false, `${file} still has a log-only stub`);
    assert.ok(serialized.includes("Deliver Alert"), `${file} must deliver`);
    assert.ok(serialized.includes("BIZOS_OPS_MAILPIT_URL"), `${file} must know Mailpit`);
  }

  assert.ok(JSON.stringify(byFile["health-monitor.json"]).includes("neverError"));
  assert.ok(JSON.stringify(byFile["github-actions-poll.json"]).includes("User-Agent"));
  assert.equal(
    JSON.stringify(byFile["github-actions-poll.json"]).includes(
      "GITHUB_TOKEN is not configured in n8n environment",
    ),
    false,
  );
});

test("Code nodes use Node http/https instead of fetch, and skip Merge", () => {
  for (const { name, workflow } of loadWorkflows()) {
    const serialized = JSON.stringify(workflow);
    assert.equal(serialized.includes("await fetch("), false, `${name} still uses fetch`);
    assert.equal(
      workflow.nodes.some((node) => node.name === "Merge"),
      false,
      `${name} must not use a Merge node`,
    );
    const deliver = (workflow.nodes ?? []).find((node) => node.name === "Deliver Alert");
    assert.ok(deliver, `${name} missing Deliver Alert`);
    assert.match(deliver.parameters.jsCode, /require\('http'\)/);
    assert.match(deliver.parameters.jsCode, /require\('https'\)/);
  }

  const github = loadWorkflows().find((entry) => entry.name === "github-actions-poll.json");
  const fetchRuns = github.workflow.nodes.find((node) => node.name === "Fetch Recent Runs");
  assert.match(fetchRuns.parameters.jsCode, /require\('https'\)/);
  assert.equal(fetchRuns.parameters.jsCode, FETCH_GITHUB_RUNS);

  for (const { workflow } of loadWorkflows()) {
    const deliver = workflow.nodes.find((node) => node.name === "Deliver Alert");
    assert.equal(deliver.parameters.jsCode, DELIVER_ALERT);
  }
});
