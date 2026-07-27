#!/usr/bin/env node

/**
 * Configures bizOS DNS and edge settings in the qloudihub.com Cloudflare zone.
 * Never logs secret values. Only touches bizos.* / api.bizos.* records.
 */

const token = String(process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const webOrigin = String(process.env.WEB_ORIGIN_HOST ?? "").trim();
const apiOrigin = String(process.env.API_ORIGIN_HOST ?? "").trim();

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
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Cloudflare API ${path} failed: non-JSON response http=${response.status}`);
  }
  if (!response.ok || body.success === false) {
    const message = JSON.stringify(body.errors ?? body);
    const error = new Error(`Cloudflare API ${path} failed: ${message}`);
    error.status = response.status;
    error.codes = (body.errors ?? []).map((item) => item.code);
    throw error;
  }
  return body.result;
}

function isAuthorizationError(error) {
  const codes = error?.codes ?? [];
  return codes.includes(10000) || codes.includes(9109) || error?.status === 403;
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
  try {
    await cf(`/zones/${zoneId}/settings/ssl`, {
      method: "PATCH",
      body: JSON.stringify({ value: "strict" }),
    });
    await cf(`/zones/${zoneId}/settings/always_use_https`, {
      method: "PATCH",
      body: JSON.stringify({ value: "on" }),
    });
    console.warn("Enabled Full (strict) TLS and Always Use HTTPS.");
  } catch (error) {
    if (isAuthorizationError(error)) {
      console.warn(
        "Skipping SSL/HTTPS settings: token lacks Zone Settings Edit. Set SSL to Full (strict) in the dashboard or expand the token.",
      );
      return;
    }
    throw error;
  }
}

async function ensureSecurityHeaders(zoneId) {
  try {
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
  } catch (error) {
    if (isAuthorizationError(error)) {
      console.warn("Skipping response header rules: token lacks Transform Rules / Rulesets Edit.");
      return;
    }
    throw error;
  }
}

async function main() {
  const tokenStatus = await cf("/user/tokens/verify");
  console.warn(`Cloudflare token status: ${tokenStatus.status}`);

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

  if (!webOrigin || !apiOrigin) {
    console.warn(
      "Edge security updated, but DNS origins are incomplete until WEB_ORIGIN_HOST and API_ORIGIN_HOST are set.",
    );
  }

  console.warn("Cloudflare edge bootstrap complete for bizOS hosts only.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
