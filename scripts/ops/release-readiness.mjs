#!/usr/bin/env node
/**
 * Release-readiness check (BIZ-011 verification gate).
 *
 * Probes the public web and API surfaces after a production deploy and fails
 * loudly if the release is not actually serving. Read-only: no signup, no data
 * mutation. Safe to run before a deploy (to capture the baseline) and after
 * (to confirm the rollout). Exits non-zero when any required check fails.
 *
 * Usage:
 *   node scripts/ops/release-readiness.mjs
 *   RELEASE_EXPECT_SHA=<40-hex> node scripts/ops/release-readiness.mjs
 *
 * When RELEASE_EXPECT_SHA is provided and the API reports a gitSha (see the
 * release version endpoint, PR #37), the check asserts they match.
 */

const WEB_BASE = process.env.RELEASE_WEB_BASE ?? "https://bizos.qloudihub.com";
const API_BASE = process.env.RELEASE_API_BASE ?? "https://api.bizos.qloudihub.com";
const EXPECT_SHA = process.env.RELEASE_EXPECT_SHA ?? "";
const TIMEOUT_MS = 30_000;

const results = [];
let failed = false;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failed = true;
  console.warn(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "bizos-release-readiness/1.1", ...headers },
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHtmlRoute({ name, path, expectedStatus, marker }) {
  try {
    const response = await get(`${WEB_BASE}${path}`);
    const body = await response.text();
    const statusOk = response.status === expectedStatus;
    const markerOk = body.includes(marker);
    record(
      name,
      statusOk && markerOk,
      `status=${response.status} marker=${markerOk ? "present" : "missing"} path=${path}`,
    );
  } catch (error) {
    record(name, false, String(error));
  }
}

async function main() {
  // 1. Web serves the landing page.
  try {
    const web = await get(`${WEB_BASE}/`);
    record("web.landing.http200", web.status === 200, `status=${web.status}`);
  } catch (error) {
    record("web.landing.http200", false, String(error));
  }

  // 2. Critical public auth routes must be present in the deployed route manifest.
  // Checking only GET / allowed a stale image to pass while /signin returned Next's default 404.
  await checkHtmlRoute({
    name: "web.signin.route",
    path: "/signin",
    expectedStatus: 200,
    marker: "Welcome back",
  });
  await checkHtmlRoute({
    name: "web.signup.route",
    path: "/signup",
    expectedStatus: 200,
    marker: "Create your account",
  });

  // 3. Unknown routes must use the repository's custom not-found page. This distinguishes
  // the intended build from older images that still render Next.js's framework-default 404.
  await checkHtmlRoute({
    name: "web.notFound.custom",
    path: "/__bizos_release_probe_missing_route__",
    expectedStatus: 404,
    marker: "find that page",
  });

  // 4. API liveness returns the documented contract.
  let health;
  try {
    const response = await get(`${API_BASE}/api/v1/health`);
    health = await response.json().catch(() => null);
    const ok = response.status === 200 && health?.service === "api" && health?.status === "ok";
    record("api.health.contract", ok, `status=${response.status} body=${JSON.stringify(health)}`);
  } catch (error) {
    record("api.health.contract", false, String(error));
  }

  // 5. Version surface (when the deployed build reports it) matches the target.
  if (health && typeof health === "object") {
    if ("gitSha" in health && health.gitSha) {
      record("api.health.gitSha.present", true, `gitSha=${health.gitSha}`);
      if (EXPECT_SHA) {
        record(
          "api.health.gitSha.matchesTarget",
          health.gitSha === EXPECT_SHA,
          `expected=${EXPECT_SHA} actual=${health.gitSha}`,
        );
      }
    } else {
      // Not a failure: older images predate the version endpoint (BIZ-011).
      record(
        "api.health.gitSha.present",
        true,
        "not reported by this build (pre-BIZ-011 image); deploy PR #37 to enable",
      );
    }
  }

  // 6. Security headers on the web landing page (BIZ-012). Report-only until
  // CSP/HSTS enforcement lands; surfacing gaps must not block a release.
  try {
    const web = await get(`${WEB_BASE}/`);
    const headers = web.headers;
    const required = ["strict-transport-security", "x-content-type-options", "x-frame-options"];
    const missing = required.filter((h) => !headers.get(h));
    const present = required.filter((h) => headers.get(h));
    record(
      "web.securityHeaders.report",
      true,
      missing.length
        ? `present=[${present}] missing=[${missing}] (tracked under BIZ-012)`
        : `present=[${present}]`,
    );
  } catch (error) {
    record("web.securityHeaders.report", true, `probe error: ${String(error)}`);
  }

  // 7. Unauthenticated API access is rejected.
  try {
    const response = await get(`${API_BASE}/api/v1/me`);
    record("api.unauth.rejected", response.status === 401, `status=${response.status}`);
  } catch (error) {
    record("api.unauth.rejected", false, String(error));
  }

  console.warn(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed.`);
  if (failed) {
    console.error("Release readiness FAILED.");
    process.exit(1);
  }
  console.warn("Release readiness OK.");
}

await main();
