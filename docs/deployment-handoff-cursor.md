# Cursor deployment handoff

Status: Merge-ready application contract; Cloudflare deployment not performed

Last reviewed: 2026-07-27

## Scope and target

Deploy the quotation MVP only after its pull request is merged. This handoff does not authorize
Cloudflare deployment, DNS changes, database creation, secret creation, or production migrations.

- Expected web domain: `bizOS.qloudihub.com` (DNS-normalized: `https://bizos.qloudihub.com`).
- Recommended separate API hostname: `https://api.bizos.qloudihub.com`.
- The browser talks only to Next.js. `API_INTERNAL_URL` should use a private service address when
  Cloudflare networking permits it; the public API hostname is a fallback and must still require the
  internal assertion on every non-public route.

## Applications and commands

| Component      | Path                | Build command                                  | Start command                   | Port | Health check         |
| -------------- | ------------------- | ---------------------------------------------- | ------------------------------- | ---- | -------------------- |
| Web and BFF    | `apps/web`          | `pnpm --filter @bizo/web... build`             | `pnpm --filter @bizo/web start` | 3000 | `GET /`              |
| NestJS API     | `apps/api`          | `pnpm --filter @bizo/api... build`             | `pnpm --filter @bizo/api start` | 3001 | `GET /api/v1/health` |
| Prisma tooling | `packages/database` | `pnpm --filter @bizo/database prisma:generate` | Not a long-running service      | —    | —                    |

Install with `pnpm install --frozen-lockfile`. Apply production migrations once per release, before
starting new application instances:

```bash
pnpm --filter @bizo/database prisma:migrate:deploy
```

The OCI definitions are [apps/web/Dockerfile](../apps/web/Dockerfile) and
[apps/api/Dockerfile](../apps/api/Dockerfile). Both run as non-root users and include container
health checks. Build them from the repository root:

```bash
docker build --file apps/web/Dockerfile --tag bizo/web:<git-sha> .
docker build --file apps/api/Dockerfile --tag bizo/api:<git-sha> .
```

Promote immutable image digests rather than rebuilding per environment.

## Required production variables

### Runtime secrets

| Variable               | Consumer                 | Requirement                                                                                                         |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`          | Web/Auth.js              | Unique random value of at least 32 bytes. Do not reuse elsewhere.                                                   |
| `INTERNAL_AUTH_SECRET` | Web and API              | A different random value of at least 32 bytes, identical on both services, used only for two-minute API assertions. |
| `DATABASE_URL`         | API and migration runner | PostgreSQL URL using a dedicated least-privilege identity, TLS, and no public network exposure.                     |
| `SMTP_URL`             | API                      | Trusted `smtp://` or `smtps://` provider URL. Keep credentials in the deployment secret store.                      |

### Required non-secret runtime configuration

| Variable           | Consumer    | Production value or rule                                                                                                              |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`         | Both        | `production`                                                                                                                          |
| `AUTH_URL`         | Web/Auth.js | `https://bizos.qloudihub.com`; the exact trusted Auth.js origin. Do not set broad `AUTH_TRUST_HOST` when this exact URL is available. |
| `API_INTERNAL_URL` | Web         | Private API base URL ending in `/api/v1`; public fallback: `https://api.bizos.qloudihub.com/api/v1`.                                  |
| `SMTP_FROM`        | API         | Verified sender, for example `quotations@bizos.qloudihub.com`.                                                                        |
| `WEB_PORT`         | Web         | Optional override; default `3000`.                                                                                                    |
| `API_PORT`         | API         | Optional override; default `3001`.                                                                                                    |

There are no required build-time secrets. `NEXT_TELEMETRY_DISABLED=1` and
`TURBO_TELEMETRY_DISABLED=1` are optional build/runtime controls and do not affect application
behavior.

## Reserved dependencies not active in this MVP path

Redis and R2 boundaries exist for later asynchronous jobs and object storage, but the synchronous
quotation/PDF/email path does not currently import them into either deployable application.
Provisioning them now is optional; do not claim they are runtime dependencies of this release.

When activated:

- `REDIS_URL` must use a private, TLS-protected, authenticated managed Redis endpoint. Do not
  publish port 6379. BullMQ requires persistence, `noeviction`, and operational monitoring.
- R2 requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`. Use a
  private bucket, a bucket-scoped credential, and no public object access.

The application currently emits structured API logs to standard output. No Sentry or OpenTelemetry
SDK is wired into this release, so there is no application observability secret to configure.
Cloudflare must retain service logs and alert on health-check failures, elevated 5xx responses,
authentication failures, email failures, and database saturation. Adding a telemetry provider
requires a reviewed follow-up change rather than an undeclared environment variable.

## Production service requirements

- PostgreSQL 18-compatible managed service, private networking, TLS, backups, point-in-time
  recovery, connection limits, and migration credentials separate from runtime credentials.
- SMTP provider with a verified domain, SPF, DKIM, DMARC, TLS, bounce handling, and sufficient
  attachment limits for quotation PDFs.
- Web and API instances must share `INTERNAL_AUTH_SECRET`, but the browser must never receive it.
- API access logs and secrets must not contain passwords, session tokens, internal assertions,
  customer content, or SMTP URLs.
- Redis and R2 follow the reserved controls above only when their packages become active.

## CI/CD expectations

Do not deploy unless the merge commit passes:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm security:audit
pnpm test:e2e
```

GitHub Actions additionally applies migrations to an ephemeral PostgreSQL service, exercises
authenticated Redis through BullMQ, sends through Mailpit, runs desktop and mobile Playwright
journeys, builds both OCI images, performs dependency review and CodeQL analysis, and relies on
GitHub secret scanning with push protection. Production deployment should consume the exact
merge-commit image digests after an image vulnerability scan.

## Rollback

1. Stop promotion if API or web health checks fail.
2. Repoint both services to the previous known-good image digests.
3. Do not reverse the database migration automatically. The current migration is additive; use a
   reviewed forward repair if a database issue appears.
4. Preserve failed email-delivery records for diagnosis; retry only after SMTP health is restored.
5. Confirm the previous web and API versions still read the migrated schema before rollback.
6. Rotate any secret suspected of exposure before restoring traffic.

## Post-deployment smoke test

- `GET https://api.bizos.qloudihub.com/api/v1/health` returns `200` and `status: "ok"`.
- `GET https://bizos.qloudihub.com/` returns `200` over HTTPS with no mixed content.
- Create a new account and confirm secure session-cookie behavior.
- Create a business with the expected country, currency, time zone, and visible tax default.
- Add a customer and verify another business cannot read it.
- Create a one-line quotation and confirm the displayed total, PDF total, and stored total agree.
- Download the PDF and verify its `%PDF` signature, business identity, customer, number, and total.
- Send to a controlled mailbox and verify the attachment, sender alignment, delivery state, and safe
  resend.
- Confirm API/web logs contain correlation data but no passwords, tokens, internal assertions, or
  customer message bodies.
- Confirm PostgreSQL, Redis, SMTP administration, and R2 are not publicly reachable.

Record the deployed image digests, migration result, smoke-test evidence, and rollback target.

## Known private-beta limitations

- Extremely large quotation quantities or unit prices that exceed Prisma `Decimal` column precision
  can still fail at the database boundary with a generic error; tighten request bounds in a
  follow-up.
- If SMTP accepts a message and the subsequent delivery-status write fails, a retry may produce a
  duplicate customer email until provider idempotency or delivery reconciliation is added.
- Redis, BullMQ, and R2 remain inactive production seams for this release and are not provisioned.

This handoff authorizes the release engineer named in the autonomous deployment mandate to proceed
with production configuration after PR merge and green post-merge CI.
