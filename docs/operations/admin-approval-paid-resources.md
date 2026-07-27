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

Recommendation: approve free-tier Resend (or Brevo) for `quotations@bizos.qloudihub.com` and allow
DNS TXT record creation for SPF/DKIM on the existing Cloudflare zone.

## Already provisioned at $0

- Prisma Postgres primary database in `eu-central-1`
- MVP migration `20260727090000_mvp_core` applied (via `prisma+postgres` Accelerate path)
- GitHub `preview` and `production` environments
- Generated `AUTH_SECRET` / `INTERNAL_AUTH_SECRET` (production)
- Production `DATABASE_URL` (Accelerate `prisma+postgres` form required because GitHub Actions
  cannot open TCP to `db.prisma.io:5432`)
- Production non-secret variables (`NODE_ENV`, `AUTH_URL`, `API_INTERNAL_URL`, `SMTP_FROM`)
- Cloudflare account secrets present at repository level (token currently invalid — must rotate)
- Production deploy, migrate, and Cloudflare edge bootstrap workflows on `main`
- Immutable GHCR images published for MVP SHA `aa8de955455ad085709a768db921acc76dbbbd62`

## Additional Admin actions required to go live

1. Rotate `CLOUDFLARE_API_TOKEN` — current repository secret returns `Invalid API Token`.
2. Provide Render free/starter auth (`RENDER_API_KEY`, service IDs) or approve paid always-on
   hosting.
3. Create transactional SMTP credentials and set `SMTP_URL` production secret; verify sender DNS.
4. Confirm Nest runtime can use Accelerate/`prisma+postgres` (or a reachable pooled TCP URL).
   Current API env validation requires `postgresql://`, so a small runtime adapter follow-up may be
   required before app boot against Prisma Postgres from restricted networks.
5. Set `WEB_ORIGIN_HOST` / `API_ORIGIN_HOST` production variables once Render hostnames exist, then
   re-run Cloudflare edge bootstrap.
