/**
 * Free-tier Cloudflare Worker: demand-driven keep-warm + health probe for bizOS.
 *
 * Render Free spins a service down after ~15 minutes idle and grants 750 instance-hours
 * per workspace per month. Two services kept warm 24/7 would need ~1,460 hours, so warmth
 * here is driven by real usage instead of a clock:
 *
 *   1. The API pings `/wake` (throttled) whenever a genuine request arrives.
 *   2. `/wake` extends a `warm-until` deadline held in KV.
 *   3. The cron only probes while that deadline is in the future — probing is what keeps
 *      Render awake, so staying quiet is what keeps the bill at zero.
 *   4. A daily boot check still runs while cold, so a service that can no longer start is
 *      not mistaken for one that is merely asleep.
 *   5. A monthly budget guard stops pinging before the free instance-hour grant runs out.
 *
 * Does not orange-cloud app hostnames (Render onrender origins must stay DNS-only).
 */

const WEB_URL = "https://bizos.qloudihub.com/";
const API_URL = "https://api.bizos.qloudihub.com/api/v1/health";

const STATUS_KEY = "latest";
const WARM_KEY = "warm";
const BUDGET_KEY = "budget";

/** Minutes of warmth granted by a single /wake call. */
const WARM_WINDOW_MINUTES = 45;
/** Cron cadence, mirrored from wrangler.jsonc. Used for instance-hour accounting. */
const CRON_INTERVAL_MINUTES = 5;
/** Render Free services that this worker keeps awake. */
const KEPT_WARM_SERVICES = 2;
/**
 * Stop keeping warm past this many instance-hours in a calendar month.
 * Render grants 750; the margin absorbs deploys, restarts and probe overshoot.
 */
const MONTHLY_BUDGET_HOURS = 690;
/** While cold, still confirm the services can boot this often. */
const COLD_BOOT_CHECK_HOURS = 24;

/**
 * @typedef {object} WarmState
 * @property {string | null} warmUntil ISO timestamp; warmth ends here.
 * @property {string | null} lastWakeAt ISO timestamp of the last accepted /wake.
 * @property {string | null} lastColdCheckAt ISO timestamp of the last cold boot check.
 */

/**
 * @typedef {object} BudgetState
 * @property {string} month `YYYY-MM` this tally belongs to.
 * @property {number} instanceMinutes Estimated Render instance-minutes spent keeping warm.
 */

/**
 * @param {Env} env
 * @returns {Promise<WarmState>}
 */
async function readWarmState(env) {
  const raw = await env.STATUS.get(WARM_KEY);
  if (!raw) {
    return { warmUntil: null, lastWakeAt: null, lastColdCheckAt: null };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      warmUntil: typeof parsed.warmUntil === "string" ? parsed.warmUntil : null,
      lastWakeAt: typeof parsed.lastWakeAt === "string" ? parsed.lastWakeAt : null,
      lastColdCheckAt: typeof parsed.lastColdCheckAt === "string" ? parsed.lastColdCheckAt : null,
    };
  } catch {
    return { warmUntil: null, lastWakeAt: null, lastColdCheckAt: null };
  }
}

/**
 * @param {Env} env
 * @returns {Promise<BudgetState>}
 */
async function readBudget(env) {
  const month = new Date().toISOString().slice(0, 7);
  const raw = await env.STATUS.get(BUDGET_KEY);
  if (!raw) {
    return { month, instanceMinutes: 0 };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed.month !== month) {
      return { month, instanceMinutes: 0 };
    }
    return {
      month,
      instanceMinutes: Number.isFinite(parsed.instanceMinutes) ? parsed.instanceMinutes : 0,
    };
  } catch {
    return { month, instanceMinutes: 0 };
  }
}

/**
 * @param {BudgetState} budget
 * @returns {boolean}
 */
function budgetExhausted(budget) {
  return budget.instanceMinutes >= MONTHLY_BUDGET_HOURS * 60;
}

/**
 * @param {WarmState} warm
 * @param {Date} now
 * @returns {boolean}
 */
function isWarm(warm, now) {
  return warm.warmUntil !== null && Date.parse(warm.warmUntil) > now.getTime();
}

/**
 * @param {WarmState} warm
 * @param {Date} now
 * @returns {boolean}
 */
function coldCheckDue(warm, now) {
  if (warm.lastColdCheckAt === null) {
    return true;
  }
  const elapsed = now.getTime() - Date.parse(warm.lastColdCheckAt);
  return !Number.isFinite(elapsed) || elapsed >= COLD_BOOT_CHECK_HOURS * 60 * 60 * 1000;
}

/**
 * Probe both services and persist the result.
 *
 * @param {Env} env
 * @param {"warm" | "cold-check" | "manual"} reason
 */
async function runProbes(env, reason) {
  const checkedAt = new Date().toISOString();
  const [web, api] = await Promise.all([probeWeb(), probeApi()]);
  const ok = web.ok && api.ok;
  const payload = { ok, checkedAt, reason, web, api };

  await env.STATUS.put(STATUS_KEY, JSON.stringify(payload), {
    metadata: { ok: String(ok), checkedAt },
  });

  if (ok) {
    console.warn("bizos_health_ok", checkedAt, reason);
  } else {
    console.error("bizos_health_fail", JSON.stringify(payload));
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

/**
 * Cron entry point. Probes only while warm, so idle periods cost no instance hours.
 *
 * @param {Env} env
 */
async function tick(env) {
  const now = new Date();
  const [warm, budget] = await Promise.all([readWarmState(env), readBudget(env)]);

  if (isWarm(warm, now)) {
    if (budgetExhausted(budget)) {
      console.error("bizos_keepwarm_budget_exhausted", JSON.stringify(budget));
      await env.STATUS.put(WARM_KEY, JSON.stringify({ ...warm, warmUntil: null }), {
        metadata: { reason: "budget_exhausted" },
      });
      return;
    }

    await runProbes(env, "warm");
    await env.STATUS.put(
      BUDGET_KEY,
      JSON.stringify({
        month: budget.month,
        instanceMinutes: budget.instanceMinutes + CRON_INTERVAL_MINUTES * KEPT_WARM_SERVICES,
      }),
    );
    return;
  }

  if (coldCheckDue(warm, now)) {
    await runProbes(env, "cold-check");
    await env.STATUS.put(WARM_KEY, JSON.stringify({ ...warm, lastColdCheckAt: now.toISOString() }));
    return;
  }

  // Asleep by design: no probe, no KV write, no instance hours burned.
}

/**
 * Extend the warm window. Writes are skipped while more than half the window remains,
 * which keeps this well inside the free KV write allowance.
 *
 * @param {Env} env
 * @returns {Promise<{extended: boolean, warmUntil: string}>}
 */
async function wake(env) {
  const now = new Date();
  const warm = await readWarmState(env);
  const windowMs = WARM_WINDOW_MINUTES * 60 * 1000;
  const remaining =
    warm.warmUntil === null ? 0 : Math.max(0, Date.parse(warm.warmUntil) - now.getTime());

  if (remaining > windowMs / 2) {
    return { extended: false, warmUntil: /** @type {string} */ (warm.warmUntil) };
  }

  const warmUntil = new Date(now.getTime() + windowMs).toISOString();
  await env.STATUS.put(
    WARM_KEY,
    JSON.stringify({ ...warm, warmUntil, lastWakeAt: now.toISOString() }),
    { metadata: { warmUntil } },
  );
  return { extended: true, warmUntil };
}

/**
 * @param {Request} request
 * @param {Env} env
 */
function wakeAuthorized(request, env) {
  const expected = env.WAKE_SECRET;
  if (typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  const provided =
    request.headers.get("x-wake-secret") ?? new URL(request.url).searchParams.get("secret") ?? "";
  return timingSafeEqual(provided, expected);
}

/**
 * @param {string} a
 * @param {string} b
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export default {
  /**
   * @param {ScheduledController} _controller
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(tick(env));
  },

  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/wake") {
      if (!wakeAuthorized(request, env)) {
        return Response.json({ ok: false, detail: "Unauthorized." }, { status: 401 });
      }
      const result = await wake(env);
      return Response.json({ ok: true, ...result }, { status: 202 });
    }

    if (url.pathname === "/run") {
      const payload = await runProbes(env, "manual");
      return Response.json(payload, { status: payload.ok ? 200 : 503 });
    }

    if (url.pathname === "/" || url.pathname === "/status") {
      const [raw, warm, budget] = await Promise.all([
        env.STATUS.get(STATUS_KEY),
        readWarmState(env),
        readBudget(env),
      ]);
      const warmNow = isWarm(warm, new Date());
      const budgetHours = Math.round((budget.instanceMinutes / 60) * 10) / 10;

      if (!raw) {
        ctx.waitUntil(runProbes(env, "manual"));
        return Response.json(
          { ok: false, detail: "No probe yet; triggered.", warm: warmNow },
          { status: 503 },
        );
      }

      const payload = JSON.parse(raw);
      const body = {
        ...payload,
        warm: warmNow,
        warmUntil: warm.warmUntil,
        budget: { month: budget.month, usedHours: budgetHours, capHours: MONTHLY_BUDGET_HOURS },
      };

      // A service that is asleep by design is not a failure.
      const healthy = payload.ok || !warmNow;
      return Response.json(body, { status: healthy ? 200 : 503 });
    }

    return new Response("Not found", { status: 404 });
  },
};
