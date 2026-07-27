#!/usr/bin/env node

/**
 * Configures bizOS DNS and edge settings in the qloudihub.com Cloudflare zone.
 * Never logs secret values. Only touches bizos.* / api.bizos.* records.
 */

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const webOrigin = process.env.WEB_ORIGIN_HOST;
const apiOrigin = process.env.API_ORIGIN_HOST;

if (!token || !accountId) {
  console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.");
  process.exit(1);
}

async function cf(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    const message = JSON.stringify(body.errors ?? body);
    throw new Error(`Cloudflare API ${path} failed: ${message}`);
  }
  return body.result;
}

function assertBizOsOnly(name) {
  const allowed = new Set(["bizos.qloudihub.com", "api.bizos.qloudihub.com"]);
  if (!allowed.has(name)) {
    throw new Error(`Refusing to modify unrelated DNS name: ${name}`);
  }
}

async function upsertCname(zoneId, name, target, proxied) {
  assertBizOsOnly(name);
  if (!target) {
    console.warn(`Skipping ${name}: origin host not configured yet.`);
    return;
  }
  const existing = await cf(
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
  );
  const payload = {
    type: "CNAME",
    name,
    content: target,
    proxied,
    ttl: 1,
  };
  if (existing.length > 0) {
    await cf(`/zones/${zoneId}/dns_records/${existing[0].id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    console.warn(`Updated CNAME ${name} -> ${target} (proxied=${proxied})`);
    return;
  }
  await cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.warn(`Created CNAME ${name} -> ${target} (proxied=${proxied})`);
}

async function ensureHttps(zoneId) {
  await cf(`/zones/${zoneId}/settings/ssl`, {
    method: "patch",
    body: JSON.stringify({ value: "strict" }),
  });
  await cf(`/zones/${zoneId}/settings/always_use_https`, {
    method: "patch",
    body: JSON.stringify({ value: "on" }),
  });
  console.warn("Enabled Full (strict) TLS and Always Use HTTPS.");
}

async function ensureSecurityHeaders(zoneId) {
  const rulesets = await cf(`/zones/${zoneId}/rulesets`);
  const entry = rulesets.find((ruleset) => ruleset.phase === "http_response_headers_transform");
  const expression =
    '(http.host eq "bizos.qloudihub.com" or http.host eq "api.bizos.qloudihub.com")';
  const action_parameters = {
    headers: {
      "Strict-Transport-Security": {
        operation: "set",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      "X-Content-Type-Options": { operation: "set", value: "nosniff" },
      "Referrer-Policy": { operation: "set", value: "strict-origin-when-cross-origin" },
      "Permissions-Policy": {
        operation: "set",
        value: "camera=(), microphone=(), geolocation=()",
      },
      "Cache-Control": {
        operation: "set",
        value: "private, no-store",
      },
    },
  };
  const rule = {
    action: "rewrite",
    expression,
    description: "bizOS secure headers and no-store for app/API hosts",
    enabled: true,
    action_parameters,
  };

  if (!entry) {
    await cf(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "bizOS response headers",
        kind: "zone",
        phase: "http_response_headers_transform",
        rules: [rule],
      }),
    });
    console.warn("Created response header transform ruleset for bizOS hosts.");
    return;
  }

  const detail = await cf(`/zones/${zoneId}/rulesets/${entry.id}`);
  const withoutBizOs = (detail.rules ?? []).filter(
    (item) => !String(item.description ?? "").includes("bizOS"),
  );
  await cf(`/zones/${zoneId}/rulesets/${entry.id}`, {
    method: "PUT",
    body: JSON.stringify({
      rules: [...withoutBizOs, rule],
    }),
  });
  console.warn("Updated response header transform rules for bizOS hosts.");
}

async function main() {
  const tokenStatus = await cf("/user/tokens/verify");
  console.warn(`Cloudflare token status: ${tokenStatus.status}`);
  console.warn(`Using account id length: ${accountId.length}`);

  const zones = await cf("/zones?name=qloudihub.com");
  if (!zones.length) {
    throw new Error("Zone qloudihub.com was not found for this token.");
  }
  const zoneId = zones[0].id;
  console.warn("Found qloudihub.com zone.");

  await ensureHttps(zoneId);
  await upsertCname(zoneId, "bizos.qloudihub.com", webOrigin, true);
  await upsertCname(zoneId, "api.bizos.qloudihub.com", apiOrigin, true);
  await ensureSecurityHeaders(zoneId);

  console.warn("Cloudflare edge bootstrap complete for bizOS hosts only.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
