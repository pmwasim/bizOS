# Private-beta cutover handoff (no secrets)

**Paused:** 2026-07-27T17:03Z (Mac Cursor)  
**Resume:** Ubuntu Cursor on a local clone (not remote SSH into Mac)

## Git / release

| Item             | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Repo             | https://github.com/pmwasim/bizOS                             |
| `main` SHA       | `6340ebf2ed1d64fe0c10f49373226fcbd297f973`                   |
| Release tag      | `v0.1.0-beta.1` → `aa8de955455ad085709a768db921acc76dbbbd62` |
| Mac working tree | Clean, on `main`, synced with `origin/main`                  |

Merged this cutover: `#16` (Render git deploys), `#17` (Render custom-domain workflow), `#18`
(tolerate existing domains), `#19` (Resend HTTPS mail for free-tier SMTP block).

Open / ignore: draft PR `#14` (superseded); Dependabot PRs `#1`–`#7` (not release-critical).

## Live endpoints

- Web: https://bizos.qloudihub.com
- API health: https://api.bizos.qloudihub.com/api/v1/health
- Render web origin: https://bizos-web.onrender.com
- Render API origin: https://bizos-api-3z63.onrender.com

At pause: both production hosts returned healthy HTTP responses. Cold starts on free tier are
expected.

## Render (free tier)

| Service        | ID                                 | Notes                                                                           |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Workspace      | `tea-d9jnqf2d0e5s7393ibug` (bizOS) | Free                                                                            |
| bizos-api      | `srv-d9jo3murnols73951gd0`         | Docker from GitHub; Dockerfile `./apps/api/Dockerfile`; health `/api/v1/health` |
| bizos-web      | `srv-d9jo3vv41pts73d0ts5g`         | Docker from GitHub; Dockerfile `./apps/web/Dockerfile`; health `/`              |
| Custom domains | 2/2 free quota used                | `bizos.qloudihub.com`, `api.bizos.qloudihub.com`                                |

Auto-deploy is off; deploy manually or via Production deploy workflow (git/Docker `commitId`, not
private GHCR `imageUrl`).

## Cloudflare DNS

- Zone: `qloudihub.com` (pmwasim Cloudflare account)
- `bizos.qloudihub.com` → CNAME `bizos-web.onrender.com` **DNS-only** (`proxied=false`)
- `api.bizos.qloudihub.com` → CNAME `bizos-api-3z63.onrender.com` **DNS-only**
- Do **not** orange-cloud these records (Cloudflare returns “DNS points to prohibited IP” for
  onrender targets)
- SSL Full (strict) + Always HTTPS already set in dashboard (API token may lack Zone Settings Edit)

## SMTP / Resend

- Provider: Resend; domain `bizos.qloudihub.com` **Verified** (Ireland)
- Sender: `quotations@bizos.qloudihub.com` (`SMTP_FROM`)
- **Render free blocks outbound SMTP 25/465/587.** Fix merged in `#19`: when `SMTP_URL` host is
  `smtp.resend.com`, API uses Resend **HTTPS** API.
- At pause: email send was still stuck / Resend showed no deliveries **before** confirming API Live
  on `6340ebf`. **First Ubuntu task: confirm API deploy of `6340ebf` is Live, then re-test send.**

## Smoke progress (partial)

Completed on production:

- DNS + TLS for web and API
- App load, signup, business setup, customer create
- Quotation create `Q-0001`, tax total SAR 3,450.00 (2×1500 + 15% VAT)
- PDF download (authenticated) OK

Not finished:

- Quotation email send / delivery persistence / resend (blocked by SMTP until HTTPS deploy
  confirmed)
- Unauthorized PDF returned **500** (should be 401/403 — investigate)
- Cross-tenant checks, mobile journey, QA data cleanup
- Monitoring / Prisma backup evidence / Cloudflare token rotation
- Final 21-point readiness report (do **not** claim ready until email + full smoke pass)

QA business path (cleanup after smoke):  
`/b/a4ebfa34-be55-44aa-8886-6b69c9a760c1` — Deploy QA Business / Deploy QA Customer / quotation
`288a8aaf-71f5-45c4-b94c-692f58dcbfae`

## Secrets

Prefer GitHub environment **`production`** (already populated: `DATABASE_URL`, `AUTH_SECRET`,
`INTERNAL_AUTH_SECRET`, `SMTP_URL`, `RENDER_*`, `CLOUDFLARE_*`, `R2_*`, etc.).

Optional Mac copy (chmod 700, never commit): `~/.config/bizos-release/`  
Ubuntu does not need this file if GitHub + provider dashboards are available.

## Constraints

- Free-tier / zero-budget default; escalate for paid always-on Render
- No Redis / BullMQ / worker / extra storage for MVP
- Ship on `cursor/<feature>` branches; draft PRs; merge when required checks green (ignore
  non-required Prisma Compute Deploy failures)
- Never print or commit secrets; rotate Cloudflare token after cutover (previously appeared in
  automation logs)

## Resume checklist

1. `git fetch origin && git checkout main && git pull --ff-only` → expect `6340ebf…`
2. Confirm Render **bizos-api** latest deploy commit is `6340ebf` and status **Live**; redeploy if
   not
3. Re-run quotation email send; verify Resend emails log + UI delivery state
4. Finish remaining smoke items; delete Deploy QA data
5. Monitoring + backup evidence + CF token rotation
6. Emit final 21-point report with honest readiness verdict
