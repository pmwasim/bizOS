#!/usr/bin/env node
/**
 * Prove the local n8n bizOS workflows accept signed webhooks and deliver mail.
 *
 * Requires:
 *   - n8n healthy on N8N_BASE_URL (default http://127.0.0.1:5678)
 *   - Mailpit on BIZOS_OPS_MAILPIT_URL host mapping (default http://127.0.0.1:8025)
 *   - N8N_WEBHOOK_SECRET matching BIZOS_WEBHOOK_SECRET in n8n
 */

import { createHmac } from "node:crypto";

const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://127.0.0.1:5678";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const SECRET = process.env.N8N_WEBHOOK_SECRET;
const TIMEOUT_MS = 15_000;

if (!SECRET) {
  console.error("N8N_WEBHOOK_SECRET is required to verify signed webhooks.");
  process.exit(1);
}

function sign(body) {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

async function postWebhook(path, payload) {
  const body = JSON.stringify(payload);
  const response = await fetch(`${N8N_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": payload.idempotencyKey ?? payload.id,
      "X-Signature": sign(body),
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  return { status: response.status, text };
}

async function waitForMailpitSubject(subject, sinceMs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    if (!response.ok) {
      throw new Error(`Mailpit list failed: ${response.status}`);
    }
    const payload = await response.json();
    const messages = payload.messages ?? payload ?? [];
    const match = messages.find((message) => {
      const created = Date.parse(message.Created ?? message.created ?? 0);
      return (
        message.Subject === subject && (!Number.isFinite(created) || created >= sinceMs - 2000)
      );
    });
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Mailpit did not receive subject: ${subject}`);
}

async function main() {
  const health = await fetch(`${N8N_BASE_URL}/healthz`);
  if (!health.ok) {
    throw new Error(`n8n healthz returned ${health.status}`);
  }

  const startedAt = Date.now();
  const customizationId = `verify-customization-${startedAt}`;
  const opsKey = `verify-ops-${startedAt}`;
  const ciKey = `verify-ci-${startedAt}`;

  const customization = await postWebhook("/webhook/bizos/customization-request", {
    id: customizationId,
    tenantId: "tenant_verify",
    businessId: "business_verify",
    urgency: "HIGH",
    status: "OPEN",
    currentConfigurationTemplateVersionId: null,
    createdAt: new Date().toISOString(),
  });
  if (customization.status < 200 || customization.status >= 300) {
    throw new Error(`customization webhook ${customization.status}: ${customization.text}`);
  }

  const ops = await postWebhook("/webhook/bizos/ops-event", {
    event: "document.delivery.failed",
    idempotencyKey: opsKey,
    occurredAt: new Date().toISOString(),
    tenantId: "tenant_verify",
    businessId: "business_verify",
    severity: "high",
    title: `[bizOS] verify delivery failed ${startedAt}`,
    message: "Verification payload for document.delivery.failed",
    data: { documentType: "invoice", documentId: "verify" },
  });
  if (ops.status < 200 || ops.status >= 300) {
    throw new Error(`ops-event webhook ${ops.status}: ${ops.text}`);
  }

  const ci = await postWebhook("/webhook/bizos/ci-failure", {
    event: "ci.failure",
    workflow: "Verify",
    idempotencyKey: ciKey,
    repo: "pmwasim/bizOS",
    branch: "cursor/n8n-automations-561e",
    sha: "verify",
    timestamp: new Date().toISOString(),
  });
  if (ci.status < 200 || ci.status >= 300) {
    throw new Error(`ci-failure webhook ${ci.status}: ${ci.text}`);
  }

  await waitForMailpitSubject("[bizOS] HIGH customization request", startedAt);
  await waitForMailpitSubject(`[bizOS] verify delivery failed ${startedAt}`, startedAt);
  await waitForMailpitSubject("[bizOS] CI failure: Verify", startedAt);

  process.stdout.write(
    JSON.stringify(
      {
        n8n: "healthy",
        webhooks: {
          customization: customization.status,
          opsEvent: ops.status,
          ciFailure: ci.status,
        },
        mailpit: "received customization, ops-event, and ci-failure alerts",
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
