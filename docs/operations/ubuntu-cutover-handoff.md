# Ubuntu production handoff (no secrets)

**Hosting authority:** Product-owner correction on 2026-08-07  
**Production web:** `https://bizos.qloudihub.com`  
**Production host:** Ubuntu desktop  
**Source repository:** `pmwasim/bizOS`

> **Render is retired for bizOS production.** Historical Render service IDs, `onrender.com` origins,
> `RENDER_*` secrets, and Render deployment instructions from earlier releases are obsolete and must
> not be used for deploy, rollback, diagnosis, or recovery. The previous Render handoff remains
> available in Git history only.

## Current operating rule

GitHub `main` is the application source of truth, but a merge to `main` does **not** prove that the
Ubuntu production process has been rebuilt or restarted.

Before changing production, discover and record the actual Ubuntu runtime instead of assuming a
checkout path, process manager, container name, port, or Cloudflare Tunnel target.

## Release validation

`.github/workflows/production-release-gate.yml` is the repository-side production **validation**
workflow. It accepts an exact Git SHA and runs dependency audit, local test-database migrations,
`pnpm check`, and desktop/mobile Playwright journeys.

It deliberately has no production hosting credentials and performs no Ubuntu deployment or
production database migration. A green release gate means a candidate is validated; it does not mean
the candidate is live.

After the Ubuntu deployment mechanism is identified, run `scripts/ops/release-readiness.mjs` against
the local origin before public cutover and against the public host afterward. The probe requires the
landing page, `/signin`, `/signup`, custom not-found page, API health, and unauthenticated API
boundary to behave correctly.

## Production discovery

Run these read-only checks on the Ubuntu production host:

```bash
hostnamectl --static

# Identify the live bizOS processes and listeners.
ps -ef | grep -E '[n]ext|[n]ode .*server\.js|[p]npm.*bizo|[d]ocker.*bizo'
ss -ltnp | grep -E ':3000|:3001' || true

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || true
systemctl --user --type=service --all | grep -Ei 'bizo|bizos' || true
systemctl --type=service --all | grep -Ei 'bizo|bizos|cloudflared' || true

# Identify Cloudflare Tunnel / reverse-proxy configuration without printing credentials.
ps -ef | grep '[c]loudflared' || true
systemctl status cloudflared --no-pager 2>/dev/null || true
```

Do not print `.env` files, tokens, tunnel credentials, database URLs, Auth.js secrets, or private
keys into terminal transcripts, GitHub issues, or chat.

## Locate and verify the production checkout

After identifying the process working directory or deployment path:

```bash
cd <ACTUAL_BIZOS_CHECKOUT>

git remote -v
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin
git rev-parse origin/main
```

A dirty production checkout must be investigated before pull/rebuild. Do not discard local changes
blindly.

## Build verification

The current web image/build uses the existing Next.js App Router application. The sign-in page lives
at `apps/web/src/app/(auth)/signin/page.tsx`; the route group does not appear in the public URL, so
it must resolve as `/signin`.

Before restart or rollout:

```bash
pnpm install --frozen-lockfile
pnpm --filter @bizo/web build
```

If the Ubuntu deployment uses Docker, rebuild/recreate **using the existing production compose or
container procedure after it has been identified**. If it uses systemd or another supervisor,
restart only the actual bizOS unit. Do not invent a new supervisor during incident recovery.

## Required local smoke checks

After starting the candidate build, test the origin locally before relying on the public hostname:

```bash
curl -fsS -o /tmp/bizos-home.html -w '%{http_code}\n' http://127.0.0.1:<WEB_PORT>/
curl -fsS -o /tmp/bizos-signin.html -w '%{http_code}\n' http://127.0.0.1:<WEB_PORT>/signin
grep -q 'Welcome back' /tmp/bizos-signin.html
curl -fsS -o /tmp/bizos-signup.html -w '%{http_code}\n' http://127.0.0.1:<WEB_PORT>/signup

RELEASE_WEB_BASE=http://127.0.0.1:<WEB_PORT> \
RELEASE_API_BASE=http://127.0.0.1:<API_PORT> \
RELEASE_EXPECT_SHA=<DEPLOYED_SHA> \
  node scripts/ops/release-readiness.mjs
```

Expected: all required release-readiness checks pass and `/signin` contains the expected sign-in UI.

## Public verification

After the local origin is correct and Cloudflare is routing to that origin:

```bash
RELEASE_EXPECT_SHA=<DEPLOYED_SHA> node scripts/ops/release-readiness.mjs
```

Also complete a real browser sign-in with a designated QA account. Do not create or expose
credentials in repository automation.

## Current incident

GitHub issue `#56` tracks the production `/signin` 404. Source inspection confirmed that the route
already exists, including in the previously documented beta release. Therefore a live 404 should be
treated first as deployment/runtime/origin drift, not as evidence that a new sign-in page must be
created.

PR `#64` was merged with desktop/mobile Playwright regression coverage requiring `/signin` to return
HTTP 200 and render the credentials form. PR `#67` was merged with release-readiness checks for
`/signin`, `/signup`, and the custom not-found route.

## Deployment acceptance record

For every Ubuntu production rollout, record at minimum:

- deployed Git SHA;
- prior rollback SHA;
- Ubuntu host identity;
- actual checkout/deployment path;
- actual process manager/container names;
- web/API local ports;
- Cloudflare Tunnel or reverse-proxy origin mapping (without credentials);
- build/check result;
- migration result when applicable;
- local smoke result;
- public smoke result;
- restart/rollback command used.

Do not call a deployment successful until the public route is independently verified.

## Rollback principle

Rollback must use the previously recorded known-good application SHA and the **same established
Ubuntu deployment mechanism**. Never reverse a database migration automatically solely because an
application rollback is required.

## Follow-up

Once the actual Ubuntu production mechanism is recovered during issue `#56`, replace the discovery
placeholders in this document with the verified paths, unit/container names, ports, and safe
restart/rollback commands. That information should become the authoritative production runbook.
