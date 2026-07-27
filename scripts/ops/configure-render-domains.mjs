#!/usr/bin/env node

/**
 * Adds Render custom domains for bizOS production hosts.
 * Never logs secret values.
 */

const apiKey = String(process.env.RENDER_API_KEY ?? "").trim();
const apiServiceId = String(process.env.RENDER_API_SERVICE_ID ?? "").trim();
const webServiceId = String(process.env.RENDER_WEB_SERVICE_ID ?? "").trim();
const webDomain = String(process.env.WEB_CUSTOM_DOMAIN ?? "bizos.qloudihub.com").trim();
const apiDomain = String(process.env.API_CUSTOM_DOMAIN ?? "api.bizos.qloudihub.com").trim();

if (!apiKey || !apiServiceId || !webServiceId) {
  console.error("RENDER_API_KEY, RENDER_API_SERVICE_ID, and RENDER_WEB_SERVICE_ID are required.");
  process.exit(1);
}

async function render(path, init = {}) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Render API ${path} failed: non-JSON http=${response.status}`);
  }
  if (!response.ok) {
    throw new Error(
      `Render API ${path} failed: http=${response.status} body=${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function ensureDomain(serviceId, name) {
  const existing = await render(`/services/${serviceId}/custom-domains`);
  const list = Array.isArray(existing) ? existing : (existing ?? []);
  const found = list.find(
    (item) => (item.name ?? item.domain?.name) === name || item?.domain?.name === name,
  );
  if (found) {
    console.warn(`Custom domain already present on ${serviceId}: ${name}`);
    return found;
  }
  const created = await render(`/services/${serviceId}/custom-domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  console.warn(`Added custom domain ${name} to ${serviceId}`);
  return created;
}

async function main() {
  await ensureDomain(webServiceId, webDomain);
  await ensureDomain(apiServiceId, apiDomain);
  console.warn("Render custom domain configuration complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
