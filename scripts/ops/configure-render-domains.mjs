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
  return { ok: response.ok, status: response.status, body };
}

function domainName(item) {
  return item?.name ?? item?.domain?.name ?? item?.customDomain?.name ?? null;
}

function normalizeDomainList(body) {
  const raw = Array.isArray(body) ? body : [];
  return raw.map((item) => item?.customDomain ?? item?.domain ?? item).filter(Boolean);
}

async function listDomains(serviceId) {
  const result = await render(`/services/${serviceId}/custom-domains`);
  if (!result.ok) {
    throw new Error(
      `Render API list custom-domains failed: http=${result.status} body=${JSON.stringify(result.body)}`,
    );
  }
  return normalizeDomainList(result.body);
}

async function ensureDomain(serviceId, name) {
  const existing = await listDomains(serviceId);
  const found = existing.find((item) => domainName(item) === name);
  if (found) {
    console.warn(
      `Custom domain already present on service: ${name} (verification=${found.verificationStatus ?? "unknown"})`,
    );
    return found;
  }

  const created = await render(`/services/${serviceId}/custom-domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  if (created.ok) {
    console.warn(`Added custom domain ${name}`);
    return created.body;
  }

  // Domain may already exist on this or another service (common after partial setup).
  if (created.status === 409) {
    console.warn(
      `Custom domain ${name} already exists in the Render account (http=409). Continuing.`,
    );
    return null;
  }

  throw new Error(
    `Render API add custom-domain failed: http=${created.status} body=${JSON.stringify(created.body)}`,
  );
}

async function refreshDomain(serviceId, name) {
  const result = await render(
    `/services/${serviceId}/custom-domains/${encodeURIComponent(name)}/verify`,
    {
      method: "POST",
      body: "{}",
    },
  );
  if (!result.ok && result.status !== 404) {
    console.warn(`Domain verify skipped/failed for ${name}: http=${result.status}`);
    return;
  }
  if (result.ok) {
    console.warn(`Triggered DNS verification for ${name}`);
  }
}

async function main() {
  await ensureDomain(webServiceId, webDomain);
  await ensureDomain(apiServiceId, apiDomain);

  const webDomains = await listDomains(webServiceId);
  const apiDomains = await listDomains(apiServiceId);
  console.warn(
    `Web service domains: ${
      webDomains
        .map((item) => domainName(item))
        .filter(Boolean)
        .join(", ") || "(none)"
    }`,
  );
  console.warn(
    `API service domains: ${
      apiDomains
        .map((item) => domainName(item))
        .filter(Boolean)
        .join(", ") || "(none)"
    }`,
  );

  if (webDomains.some((item) => domainName(item) === webDomain)) {
    await refreshDomain(webServiceId, webDomain);
  }
  if (apiDomains.some((item) => domainName(item) === apiDomain)) {
    await refreshDomain(apiServiceId, apiDomain);
  }

  if (!apiDomains.some((item) => domainName(item) === apiDomain)) {
    throw new Error(
      `API custom domain ${apiDomain} is not attached to the API service. Remove it from any other Render service, then re-run.`,
    );
  }

  console.warn("Render custom domain configuration complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
