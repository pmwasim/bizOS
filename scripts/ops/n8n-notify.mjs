#!/usr/bin/env node
/**
 * Post a signed JSON payload to an n8n webhook (CI/deploy/local ops).
 *
 * Usage:
 *   node scripts/ops/n8n-notify.mjs ci-failure --repo pmwasim/bizOS --branch main ...
 *   node scripts/ops/n8n-notify.mjs deploy-success --sha abc1234
 *
 * Environment:
 *   N8N_CI_WEBHOOK_URL  — required (unless --url passed)
 *   N8N_WEBHOOK_SECRET  — optional HMAC-SHA256 hex signature
 */

import { createHmac } from "node:crypto";
import { parseArgs } from "node:util";

const EVENT_DEFAULTS = {
  "ci-failure": {
    event: "ci.failure",
    workflow: "CI",
  },
  "deploy-success": {
    event: "deploy.success",
    workflow: "Production deploy",
  },
  "deploy-failure": {
    event: "deploy.failure",
    workflow: "Production deploy",
  },
};

function signPayload(body, secret) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: "string" },
      repo: { type: "string", default: "pmwasim/bizOS" },
      branch: { type: "string" },
      sha: { type: "string" },
      "run-id": { type: "string" },
      "run-url": { type: "string" },
      conclusion: { type: "string", default: "failure" },
      actor: { type: "string" },
      job: { type: "string" },
      "hosting-configured": { type: "string" },
      dryRun: { type: "boolean", default: false },
    },
  });

  const eventType = positionals[0];
  if (!eventType || !EVENT_DEFAULTS[eventType]) {
    console.error(
      `Usage: node scripts/ops/n8n-notify.mjs <${Object.keys(EVENT_DEFAULTS).join("|")}> [options]`,
    );
    process.exit(1);
  }

  return { eventType, values };
}

async function main() {
  const { eventType, values } = parseCli();
  const webhookUrl = values.url ?? process.env.N8N_CI_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("N8N_CI_WEBHOOK_URL is not set; skipping n8n notification.");
    process.exit(0);
  }

  const githubRunId = values["run-id"] ?? process.env.GITHUB_RUN_ID;
  const githubRunUrl =
    values["run-url"] ??
    (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && githubRunId
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${githubRunId}`
      : undefined);

  const payload = {
    ...EVENT_DEFAULTS[eventType],
    idempotencyKey: githubRunId ? `gh-run-${githubRunId}` : `local-${Date.now()}`,
    repo: values.repo ?? process.env.GITHUB_REPOSITORY ?? "pmwasim/bizOS",
    branch: values.branch ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME,
    sha: values.sha ?? process.env.GITHUB_SHA,
    runId: githubRunId,
    runUrl: githubRunUrl,
    conclusion: values.conclusion,
    actor: values.actor ?? process.env.GITHUB_ACTOR,
    job: values.job,
    hostingConfigured: values["hosting-configured"],
    timestamp: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": payload.idempotencyKey,
  };

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    headers["X-Signature"] = signPayload(body, secret);
  }

  if (values.dryRun) {
    console.warn(JSON.stringify({ webhookUrl, headers, payload }, null, 2));
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`n8n webhook returned ${response.status}: ${text}`);
    process.exit(1);
  }

  console.warn(`Notified n8n (${eventType}): ${response.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
