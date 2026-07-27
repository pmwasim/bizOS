# Cloudflare API token rotation

Status: Active for private beta  
Zone: `qloudihub.com`  
GitHub secret: `CLOUDFLARE_API_TOKEN` (repository secret; also used by production workflows)

## Required least-privilege permissions

Create a **User API Token** (not Global API Key) with:

**Zone (resource: specific zone `qloudihub.com` only)**

1. **Zone → Zone → Read**
2. **Zone → DNS → Edit**
3. **Zone → Zone Settings → Edit** — SSL Full (strict) / Always HTTPS automation
4. Optional: **Zone → Transform Rules → Edit** (or Rulesets Edit) for secure-header ruleset

**Account (for free Workers health probe `bizos-health`)**

5. **Account → Workers Scripts → Edit**
6. **Account → Workers KV Storage → Edit**
7. **Account → Account Settings → Read** (Wrangler account resolution)

Do **not** grant Global API Key, User administration, unrelated zones, or billing edit.

## Rotation procedure

1. In Cloudflare Dashboard → My Profile → API Tokens → Create Token → Custom token with the
   permissions above.
2. Copy the new token once. Never commit it, never paste it into chat logs, never print it in CI
   summaries.
3. Update GitHub:
   - `gh secret set CLOUDFLARE_API_TOKEN --repo pmwasim/bizOS`
   - paste the new token at the prompt (stdin)
4. Run **Infrastructure validation** (`workflow_dispatch`) and confirm:
   - Cloudflare token verify success
   - `qloudihub.com` zone accessible
   - R2 probe still green (separate credentials)
5. Run **Cloudflare edge bootstrap** and confirm DNS remains:
   - `bizos.qloudihub.com` CNAME → web origin, **proxied=false**
   - `api.bizos.qloudihub.com` CNAME → API origin, **proxied=false**
6. Run **Deploy Cloudflare health worker** to refresh the free Workers cron probe.
7. Only after steps 4–6 succeed, revoke the previous token in the Cloudflare dashboard.
8. Record rotation date in an ops note.

## Why DNS-only (proxied=false)

Render `*.onrender.com` targets sit on Cloudflare IPs. Orange-cloud proxying them returns “DNS
points to prohibited IP”. TLS terminates at Render; Cloudflare remains authoritative DNS.

## Free vs paid monitoring

- Use Workers Free cron + KV (`ops/cloudflare-health-worker`) — **feasible on Free**.
- Cloudflare Health Checks are **not** on Free (Pro+). Do not enable without Admin approval.

## Incident note

The previous token appeared in an intermediate automation log during cutover. Treat it as exposed
until rotated and revoked.
