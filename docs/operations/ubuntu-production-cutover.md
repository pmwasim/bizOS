# Ubuntu production cutover: moving off `next dev`

**Status:** **applied on 2026-08-15.** Both `bizos-web.service` and `bizos-api.service` now run the
production build from `/home/wasim/bizos-production`, pinned to `97b877e` (the squash merge of PR
#81). `pnpm ops:release-readiness` reports 8/8. The record of what was done, and the root cause that
had blocked it, is in [Applied](#applied-2026-08-15) at the end of this document.

## Why

`bizos-web.service` runs `pnpm --filter @bizo/web dev` — the Next.js development server — from
`/home/wasim/bizOS`, the development checkout. That means:

- the dev HMR client and `next-devtools` are served publicly;
- the CSP is forced to include `'unsafe-eval'` and drops `upgrade-insecure-requests`, because
  `next.config.ts` only tightens those when `NODE_ENV === "production"`;
- the process sits at ~7.8 GB resident (17.3 GB peak);
- **uncommitted edits in the development checkout change the live site.**

The underlying reason the dev server was never replaced: a production build did not succeed.
`next dev` compiles lazily, so it resolved stale compiled output in the gitignored
`packages/contracts/dist/` for eight contract modules whose TypeScript sources had been lost. Those
sources are now restored (`453fbf4`), and a clean production build succeeds.

## Verification already done

At `a5c9edf`, from a clean checkout:

| Check                      | Result                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `pnpm lint`                | clean                                                         |
| `pnpm typecheck`           | 18/18 tasks                                                   |
| `pnpm test`                | 18/18 tasks, 615 tests passing                                |
| `pnpm build`               | 9/9 tasks, standalone server emitted                          |
| Smoke test on `:3998`      | `/`, `/signin`, `/forgot-password`, `/reset-password` all 200 |
| Dev fingerprints in output | none                                                          |

Payload for `/` is 11.9 KB versus 20.6 KB from the dev server, and the standalone server reports
ready in 0 ms.

## Step 1 — apply the pending migration

One migration is pending: `20260814090000_password_reset_tokens`. It is additive (a single
`CREATE TABLE` plus indexes and one foreign key) and does not alter existing tables.

```bash
cd /home/wasim/bizos-production && set -a && . ./.env && set +a && pnpm --filter @bizo/database exec prisma migrate deploy
```

Confirm afterwards with `prisma migrate status`; it should report no pending migrations and no
divergence.

## Step 2 — point the web service at the production build

The proposed unit is below. It mirrors how `bizos-api.service` already runs (direct `node`, no
package-manager wrapper).

```ini
[Unit]
Description=bizOS Next.js Web Application
After=network.target bizos-api.service

[Service]
Type=simple
User=wasim
WorkingDirectory=/home/wasim/bizos-production/apps/web
EnvironmentFile=/home/wasim/bizos-production/.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node /home/wasim/bizos-production/apps/web/.next/standalone/apps/web/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Apply it:

```bash
sudo cp /etc/systemd/system/bizos-web.service /etc/systemd/system/bizos-web.service.bak && sudo cp /home/wasim/bizos-production/docs/operations/bizos-web.service.new /etc/systemd/system/bizos-web.service && sudo systemctl daemon-reload && sudo systemctl restart bizos-web
```

### Set `APP_BASE_URL` first

Password reset links are built from `APP_BASE_URL`. It must be the public origin, not the internal
API URL. Add to `/home/wasim/bizos-production/.env`:

```
APP_BASE_URL=https://bizos.qloudihub.com
```

It defaults to `http://localhost:3000`, so reset emails will contain unusable links if this is
missed.

## Step 3 — verify

```bash
curl -s https://bizos.qloudihub.com/ | grep -c "hmr-client\|next-devtools"
```

Expect `0`. Also confirm the CSP header no longer contains `'unsafe-eval'` and does contain
`upgrade-insecure-requests`, and that `/forgot-password` returns 200.

## Rollback

```bash
sudo cp /etc/systemd/system/bizos-web.service.bak /etc/systemd/system/bizos-web.service && sudo systemctl daemon-reload && sudo systemctl restart bizos-web
```

The old unit runs from `/home/wasim/bizOS`, which is untouched by this change.

## Applied 2026-08-15

### The root cause that had blocked this for weeks

The production build did not fail because of Next 16 / React 19. It failed because the build was run
with the repository `.env` exported — and that file carried `NODE_ENV=development`. `next build`
under that flag mixes React's development and production bundles, which surfaces as
`TypeError: Cannot read properties of null (reading 'useContext')` while prerendering
`/_global-error`. The same tree builds 9/9 with `NODE_ENV=production`. AGENTS.md had recorded the
failure as pre-existing and unexplained; that entry is corrected.

`/home/wasim/bizos-production/.env` also had `NODE_ENV=development`, so even after the cutover the
API and web would have run in development mode — with `useSecureCookies` off, meaning session
cookies without the `Secure` attribute. It is now `production`.

### What was done

1. `/home/wasim/bizos-production` repointed from the local `/home/wasim/bizOS` clone to
   `https://github.com/pmwasim/bizOS.git` and moved to `97b877e`.
2. `pg_dump -Fc` of the `bizo` database to `/home/wasim/bizos-backups/bizo-20260815-065232.dump`
   before any migration.
3. Three additive migrations applied — `20260814090000_password_reset_tokens`,
   `20260814100000_enable_rls_products`, `20260814110000_business_settings_payment_numbering`.
   `prisma migrate status` then reported the schema up to date.
4. `APP_BASE_URL=https://bizos.qloudihub.com` added and `NODE_ENV` set to `production` in
   `/home/wasim/bizos-production/.env` (previous file kept as `.env.bak.20260815065157`).
5. `pnpm build` — 9/9 tasks, standalone server emitted.
6. Smoke test on `:3998` before touching systemd: `/`, `/signin`, `/forgot-password`,
   `/reset-password` all 200; zero dev fingerprints; CSP without `'unsafe-eval'` and with
   `upgrade-insecure-requests`.
7. Both units replaced (`.bak` copies kept alongside), `daemon-reload`, API restarted first, then
   web. `bizos-api.service` now runs `/home/wasim/bizos-production/apps/api/dist/main.js`;
   `bizos-web.service` runs the standalone server from the same tree.

### Verification after cutover

| Check                                 | Result                                                  |
| ------------------------------------- | ------------------------------------------------------- |
| `systemctl is-active` both units      | active                                                  |
| `pnpm ops:release-readiness`          | 8/8 passed                                              |
| `https://bizos.qloudihub.com/signin`  | 200 (issue #56 was a stale dev-server 404)              |
| Dev fingerprints on the public origin | 0                                                       |
| CSP                                   | no `'unsafe-eval'`; `upgrade-insecure-requests` present |
| Web process resident memory           | from ~7.8 GB to under the API's 260 MB                  |

### Consequences to expect

- **Everyone is signed out once.** `useSecureCookies` is now on, so Auth.js reads
  `__Secure-authjs.session-token` and the old non-prefixed cookie is ignored. Signing in again is
  the whole remedy.
- The development checkout at `/home/wasim/bizOS` no longer affects the live site in any way.

### Rollback

```bash
sudo cp /etc/systemd/system/bizos-web.service.bak /etc/systemd/system/bizos-web.service && sudo cp /etc/systemd/system/bizos-api.service.bak /etc/systemd/system/bizos-api.service && sudo systemctl daemon-reload && sudo systemctl restart bizos-api bizos-web
```

The old units run from `/home/wasim/bizOS`, which is untouched. The three migrations are additive
and need no reversal; the pre-migration dump is in `/home/wasim/bizos-backups/` if one is ever
wanted.

## Resolved since this runbook was written

- **`bizos-api.service` coupling** — repointed at `/home/wasim/bizos-production` in step 7 above.
- **`products` row-level security** — enabled by `20260814100000_enable_rls_products`, applied in
  step 3.
- **The statements page shape mismatch** — fixed in `11a6433`, on `main` as of PR #81.
