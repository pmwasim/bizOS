# Admin approval packet — paid production resources

Date: 2026-07-27

Autonomous no-cost work continues while these items are pending.

## 1) Application hosting always-on (recommended)

- Provider: Render (preferred for fewest app changes) or Cloudflare Containers
- Resource: two always-on web services (web + API), or Workers Paid + two Containers
- Reason: free Render instances sleep after ~15 minutes idle and cold-start 30–60s, which breaks a
  usable private-beta customer journey; Cloudflare Containers are unavailable on Workers Free
- Expected pricing:
  - Render Starter: about $7 USD/month per service (≈ $14 USD/month for web+API)
  - Cloudflare Workers Paid: $5 USD/month minimum, then container GB-second / vCPU-second usage
- Free-tier availability: Render Free exists but sleeps; Cloudflare Containers have no free plan
- Payment details required: yes for always-on Render Starter or Workers Paid
- Current blocker: `RENDER_API_KEY`, `RENDER_API_SERVICE_ID`, and `RENDER_WEB_SERVICE_ID` are still
  absent from GitHub secrets

Recommendation: approve Render Starter for web and API for private beta, keep Cloudflare as DNS/TLS
edge. Migrate to Cloudflare Containers later if consolidating vendors.

## 2) Transactional SMTP

- Provider: Resend, Brevo, or Postmark
- Resource: transactional sending domain + API/SMTP credentials
- Reason: quotation PDF delivery is a release requirement
- Expected pricing: free tiers commonly allow low daily volume (for example Resend 100 emails/day);
  paid plans if volume grows
- Free-tier availability: yes for low-volume private beta
- Payment details required: usually no for free tier signup; browser authentication is required
- Current blocker: `SMTP_URL` is still absent from production secrets (`SMTP_FROM` variable exists)

Recommendation: approve free-tier Resend (or Brevo) for `quotations@bizos.qloudihub.com` and allow
DNS TXT record creation for SPF/DKIM on the existing Cloudflare zone.

## 3) Cloudflare API token repair

- Provider: Cloudflare
- Resource: API token used by GitHub Actions edge bootstrap
- Reason: `CLOUDFLARE_API_TOKEN` was updated but Actions still receive `Invalid API Token` from
  `/user/tokens/verify`, so DNS/TLS automation cannot proceed from CI
- Expected pricing: free
- Free-tier availability: yes
- Payment details required: no
- Required permissions (least privilege): Zone DNS Edit and Zone Settings Edit for `qloudihub.com`;
  optionally Account R2 read for inventory. Prefer a scoped API Token, not the Global API Key.

## Already provisioned at $0

- Prisma Postgres primary database in `eu-central-1`
- MVP migration `20260727090000_mvp_core` applied
- GitHub `preview` and `production` environments
- Generated `AUTH_SECRET` / `INTERNAL_AUTH_SECRET` (production)
- Production `DATABASE_URL` (pooled `postgresql://` form)
- Production variables: `NODE_ENV`, `AUTH_URL`, `API_INTERNAL_URL`, `SMTP_FROM`, `R2_BUCKET`
- Repo secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (invalid in Actions), R2 access
  keys, `R2_ENDPOINT`
- R2 Standard bucket `bizos-production` (EEUR, private) — application seam remains inactive
- Production deploy / migrate / Cloudflare edge / infrastructure-validation workflows
- Immutable GHCR images published for MVP SHA `aa8de955455ad085709a768db921acc76dbbbd62`
