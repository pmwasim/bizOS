#!/usr/bin/env node
/**
 * Send a test customization-request payload to the local n8n webhook.
 *
 *   N8N_CUSTOMIZATION_WEBHOOK_URL=http://127.0.0.1:5678/webhook/bizos/customization-request \
 *   N8N_WEBHOOK_SECRET=your-secret \
 *   node scripts/ops/n8n-test-customization-webhook.mjs
 */

import { createHmac } from "node:crypto";

const webhookUrl = process.env.N8N_CUSTOMIZATION_WEBHOOK_URL;
if (!webhookUrl) {
  console.error("Set N8N_CUSTOMIZATION_WEBHOOK_URL to the n8n production webhook URL.");
  process.exit(1);
}

const payload = {
  id: `test-${Date.now()}`,
  tenantId: "tenant_test",
  businessId: "business_test",
  urgency: process.argv.includes("--high") ? "HIGH" : "MEDIUM",
  status: "OPEN",
  currentConfigurationTemplateVersionId: null,
  createdAt: new Date().toISOString(),
};

const body = JSON.stringify(payload);
const headers = {
  "Content-Type": "application/json",
  "X-Idempotency-Key": payload.id,
};

const secret = process.env.N8N_WEBHOOK_SECRET;
if (secret) {
  headers["X-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
}

const response = await fetch(webhookUrl, { method: "POST", headers, body });
const text = await response.text();
console.warn(`${response.status} ${text}`);
