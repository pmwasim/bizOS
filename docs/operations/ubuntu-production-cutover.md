# Ubuntu production cutover: moving off `next dev`

**Status:** prepared and verified; the two mutating steps are not applied. **Prepared build:**
`/home/wasim/bizos-production` pinned to `a5c9edf`.

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

## Still outstanding

- **`bizos-api.service` has the same coupling.** It runs `/home/wasim/bizOS/apps/api/dist/main.js` —
  the development checkout. Until it is repointed at `/home/wasim/bizos-production`, production is
  half-migrated and the development tree can still affect the live API.
- **`products` has no row-level security.** It is tenant/business-scoped but is the only such table
  without the `tenant_business_isolation` policy, because it is created after the RLS migration in
  sort order. Enabling it requires a new migration _and_ confirmation that product queries set the
  tenant/business session context, or product reads will break.
- **The statements page is broken.** `StatementsService` returns `lines`, `currencyCode`, and string
  balances, while the shared contract and the page expect `items`, `currency`, `totalInvoicedMinor`,
  and numeric balances. It fails at runtime, not at build time.
