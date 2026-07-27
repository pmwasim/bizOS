/**
 * Free-tier Cloudflare Worker: probe bizOS web + API on a cron, store last status in KV.
 * Does not orange-cloud app hostnames (Render onrender origins must stay DNS-only).
 */

const WEB_URL = "https://bizos.qloudihub.com/";
const API_URL = "https://api.bizos.qloudihub.com/api/v1/health";
const STATUS_KEY = "latest";

/**
 * @param {Env} env
 */
async function runProbes(env) {
  const checkedAt = new Date().toISOString();
  const [web, api] = await Promise.all([probeWeb(), probeApi()]);
  const ok = web.ok && api.ok;
  const payload = {
    ok,
    checkedAt,
    web,
    api,
  };
  await env.STATUS.put(STATUS_KEY, JSON.stringify(payload), {
    metadata: { ok: String(ok), checkedAt },
  });
  if (!ok) {
    console.error("bizos_health_fail", JSON.stringify(payload));
  } else {
    console.warn("bizos_health_ok", checkedAt);
  }
  return payload;
}

async function probeWeb() {
  const started = Date.now();
  try {
    const response = await fetch(WEB_URL, {
      method: "GET",
      redirect: "follow",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    return {
      ok: response.status === 200,
      status: response.status,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : "web_probe_failed",
    };
  }
}

async function probeApi() {
  const started = Date.now();
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const text = await response.text();
    const healthy = response.status === 200 && /"status"\s*:\s*"ok"/.test(text);
    return {
      ok: healthy,
      status: response.status,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : "api_probe_failed",
    };
  }
}

export default {
  /**
   * @param {ScheduledController} _controller
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runProbes(env));
  },

  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const payload = await runProbes(env);
      return Response.json(payload, { status: payload.ok ? 200 : 503 });
    }
    if (url.pathname === "/" || url.pathname === "/status") {
      const raw = await env.STATUS.get(STATUS_KEY);
      if (!raw) {
        ctx.waitUntil(runProbes(env));
        return Response.json({ ok: false, detail: "No probe yet; triggered." }, { status: 503 });
      }
      const payload = JSON.parse(raw);
      return Response.json(payload, { status: payload.ok ? 200 : 503 });
    }
    return new Response("Not found", { status: 404 });
  },
};
