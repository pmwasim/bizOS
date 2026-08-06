# bizOS local test and evaluation report

Status: Independent assessment — not an approval or release authorization

Date: 2026-08-06

Commit under test: `16f48ef` (tip of `main`) plus the uncommitted ERPNext working tree

Method: local launch on macOS (arm64), Playwright execution, direct API probing with curl, a clean
comparison build on Linux, and source review. No production system was contacted.

> **Corrections applied.** An earlier draft of this report claimed `main` does not build and that CI
> skips database tests. Both were wrong and are corrected below. The build failure is specific to
> macOS/arm64, and CI does run the database tests. The original claims are retained in "Corrections"
> so the reasoning trail stays honest.

## Verdict

The engineering discipline here is well above average for this stage — validation, error contracts,
authorization seams, migration hygiene, and operational documentation are all genuinely strong.

One real security defect was found and fixed. One build failure was found and traced to an upstream
macOS-specific problem outside this codebase. Nothing found invalidates the architecture.

## Fixed during this session

### FIXED-1 — Rate limiting could be bypassed by rotating a request header (was BLOCKER-2)

`ClientAwareThrottlerGuard` derived its throttle key from the `x-bizo-client-ip` header, and
`parseTrustedClientIp` validated only the _format_ of the value, never its _provenance_. Any caller
reaching the API could therefore choose its own rate-limit bucket.

Measured against a running instance, 14 requests to `POST /api/v1/auth/verify` (limit 10/min):

| Test                           | Before fix                      | After fix                        |
| ------------------------------ | ------------------------------- | -------------------------------- |
| Fixed `x-bizo-client-ip`       | `429` × 14 — enforced           | `429` — enforced                 |
| Rotating `x-bizo-client-ip`    | `401` × 14 — **fully bypassed** | `401` × 10 then `429` — enforced |
| Rotating IP + forged signature | n/a                             | `429` — rejected                 |

`/auth/signup` and `/auth/verify` are `@Public()`, so `InternalAuthGuard` returns early and no
internal assertion is required. Per `production-runbook.md` the API is published at
`api.bizos.qloudihub.com`, so this was reachable from the internet: unlimited credential
brute-forcing and account creation, with the audit trail recording attacker-chosen IPs.

**Fix applied.** The web BFF now HMAC-signs the forwarded IP with the existing
`INTERNAL_AUTH_SECRET` and sends `x-bizo-client-ip-signature`. The API accepts a forwarded IP only
when the signature verifies, compared with `timingSafeEqual`. No new configuration is required.
Replaying a captured signature only re-asserts the IP it was issued for — the bucket that caller
already belongs to.

Files: `apps/web/src/lib/client-ip.ts`, `apps/web/src/lib/client-ip-header.ts`,
`apps/api/src/security/client-ip.ts`, `apps/api/src/security/client-aware-throttler.guard.ts`,
`apps/api/src/security/client-ip.spec.ts` (6 tests: valid signature, missing signature, wrong
secret, signature bound to a different IP, malformed and wrong-length signatures).

API suite after the change: **149 passed, 43 skipped**, up from 145.

### FIXED-2 — `turbo.json` omitted `env` on the `dev` task, so `pnpm dev` could not start

Turbo 2 runs in strict environment mode. The `dev` task declared no `env` array, so every variable
except `NODE_ENV` was stripped and the API aborted at boot in `readApiEnvironment`. The documented
quick-start in `README.md` could not work on a clean machine. Added the 22 variables the API, web,
storage, and queue configs actually read.

## Open — environment

### OPEN-1 — Production web build fails on macOS/arm64 only

`next build` fails during prerender of Next's own framework pages:

```
Error occurred prerendering page "/_global-error"
TypeError: Cannot read properties of null (reading 'useContext')
```

Isolated systematically. All of the following still fail **on macOS/arm64**:

| Variable changed                              | Result |
| --------------------------------------------- | ------ |
| Clean `.next` (not stale build state)         | fails  |
| Webpack builder instead of Turbopack          | fails  |
| React `19.2.7` instead of `19.2.8`            | fails  |
| Next `16.2.11`, and Next `16.3.0`             | fails  |
| Explicit `not-found.tsx` + `global-error.tsx` | fails  |

The same commit, same `pnpm-lock.yaml`, same `next@16.2.12` and `react@19.2.8`, **builds
successfully on Linux** (verified in a clean container install, exit 0, with and without custom
error pages).

Conclusion: an upstream `@next/swc-darwin-arm64` / React-dispatcher problem, not a defect in this
repository. CI runs `ubuntu-24.04` and is unaffected. `main` is not broken.

Impact is limited but real: macOS developers cannot run `pnpm check` or exercise Playwright against
a production build locally. Workaround is to build in Docker/Linux or rely on CI. No code change is
recommended until the upstream issue is identified.

### FIXED-3 — `prisma.config.ts` could not see the root `.env`

`import "dotenv/config"` resolved relative to `packages/database`, so Prisma commands run through a
workspace filter failed from a clean checkout with
`P1000 ... credentials for 'invalid' are not valid` — the intentional fallback URL. CI injects
`DATABASE_URL` directly and never hit this.

**Fix applied.** `prisma.config.ts` now also loads the repository-root `.env`. Values already in the
environment still win, so CI and deployment injection remain authoritative. Verified:
`prisma migrate status` with `DATABASE_URL` unset now reports `Database schema is up to date!`
instead of failing.

### FIXED-4 — `.env.example` and `playwright.config.ts` disagreed on host

`.env.example` shipped `AUTH_URL=http://localhost:3000` while `playwright.config.ts` uses
`baseURL: http://127.0.0.1:3000` and CI sets `127.0.0.1`. The session cookie was scoped to a
different host than the one under test, so every e2e test failed at signup by redirecting to
`/signin`.

**Fix applied.** `.env.example` now uses `127.0.0.1` for `AUTH_URL` and `API_INTERNAL_URL`, with a
comment explaining why.

### FIXED-5 — Oversized request bodies returned 500 instead of 413

A ~200 KB signup payload against the 100 KB `express.json` limit returned `HTTP 500`. body-parser
rejects with a plain `Error` carrying `type` and `statusCode`, not a Nest `HttpException`, so
`ProblemDetailsFilter` fell through to its 500 branch — reporting a correctly-refused request as a
server fault.

**Fix applied.** The filter now honours 4xx statuses from body-parser errors, and
`PAYLOAD_TOO_LARGE` has a title and code. Verified:

```
HTTP 413
{"title":"That is too large","status":413,"code":"PAYLOAD_TOO_LARGE",...}
```

Minor observation, not changed: the `type` URI falls back to `.../request-failed` for any status
without an explicit `code` on the exception body. Deriving it from the resolved code would be more
useful, but that is a wider contract change than this fix warranted.

### FIXED-6 — No Content-Security-Policy on the web application

The API set a full helmet header set while the Next.js app returned only `X-Frame-Options`,
`X-Content-Type-Options`, and `Referrer-Policy`. The user-facing surface that renders customer data
and handles sessions was the less protected of the two.

**Fix applied.** `next.config.ts` now sends a CSP, plus HSTS in production. `frame-src 'self'` is
required because the quotation and invoice previews embed a same-origin PDF through the BFF.
Development keeps `'unsafe-eval'`/`'unsafe-inline'` on scripts for the React refresh runtime; the
strict `script-src 'self'` and `upgrade-insecure-requests` apply to production builds only.

### FIXED-7 — No custom 404 or error page

Next's unstyled defaults were shown to users. Added `not-found.tsx` and `error.tsx` using the
existing `setup-page` / `setup-panel` styles and plain-language copy. Verified:
`/definitely-not-a- real-page` returns `HTTP 404` rendering "We couldn't find that page".

## Open — findings

### OPEN-6 — Launch markets require RTL and Arabic; neither exists

`product-delivery-baseline.md` commits to Saudi Arabia and UAE with Modern Standard Arabic and RTL.
Currently `layout.tsx` hardcodes `<html lang="en">` with no `dir`, no i18n library is installed in
any workspace, and UI strings are inline literals across 51 components. Structural, not a
translation backlog — retrofitting RTL and message extraction later is materially more expensive.

## Corrections to the earlier draft

- **"`main` does not produce a deployable web build"** — wrong. The failure is macOS/arm64-specific;
  Linux and CI build fine. Corrected in OPEN-1.
- **"DB-backed tests are opt-in and did not run"** — misleading. They are gated behind
  `RUN_DATABASE_TESTS` / `RUN_REDIS_TESTS` locally, but `ci.yml` sets both to `"true"`, so CI does
  exercise the integration and isolation tests. Only the local default run skips them.
- **Throttle findings** — an initial 429 storm during the first Playwright run was self-inflicted
  (two suites launched concurrently), not a product defect. The genuine defect was the header
  bypass, confirmed separately and now fixed.

## What is good

- **Validation and error contracts.** RFC 7807 problem details with stable `type` URIs, field-level
  errors, and a `requestId` on every failure. `forbidNonWhitelisted` rejected an injected
  `"isAdmin": true` with `Unrecognized keys` — mass assignment is closed by construction.
- **Authentication.** JWT verification pins `HS256` with explicit `audience` and `issuer`. Forged
  and `alg:none` tokens rejected; protected business routes returned `401` unauthenticated.
- **Migration discipline.** The enum-then-backfill split carries a comment explaining that Postgres
  cannot use a new enum value in the transaction that added it. Backfill is
  `ON CONFLICT DO NOTHING`. All 9 migrations applied cleanly.
- **The ERPNext seam is safe.** All three `FRAPPE_*` variables are optional with a paired-or-absent
  `superRefine` guard and an HTTPS requirement in production. Unset means inert.
- **Rate limiting is per-route and considered** — 5/min signup, 10/min verify. The design was right;
  only the trust boundary on the tracker was wrong.
- **Operational documentation is unusually honest.** `production-runbook.md` explicitly states "do
  not claim managed backup readiness" and records that PITR is unavailable.
- **Accessibility groundwork.** `fieldset`/`legend` per line item, `aria-label` on every numeric
  input, `role="status"` for send confirmation, real `combobox` semantics.

## Money path — verified

OPEN-1 blocks driving the UI through a production build on macOS, so the money path was verified
directly against the API, where the server totals are authoritative. A signed internal assertion was
minted with `INTERNAL_AUTH_SECRET`, then a business (SA / SAR / scale 2 / VAT 15%), customer, and
quotations were created over HTTP. **16 of 16 checks passed**, and the run was repeated after all
fixes as a regression check with identical results.

| Check                                       | Expected                         | Actual                              |
| ------------------------------------------- | -------------------------------- | ----------------------------------- |
| `subtotalMinor` — 1 × 5000.00               | `500000`                         | `500000`                            |
| `taxMinor` — 15% VAT                        | `75000`                          | `75000`                             |
| `totalMinor`                                | `575000`                         | `575000`                            |
| `lines[0].taxRatePpm`                       | `150000`                         | `150000`                            |
| Rounding probe `subtotalMinor` — 3 × 33.33  | `9999`                           | `9999`                              |
| Rounding probe `taxMinor` — 14.9985 rounded | `1500`                           | `1500`                              |
| Rounding probe `totalMinor`                 | `11499`                          | `11499`                             |
| PDF status / content-type / magic bytes     | 200 / `application/pdf` / `%PDF` | matched (2478 bytes)                |
| Quotation + delivery status after send      | `SENT`                           | `SENT`                              |
| Email received by Mailpit                   | present                          | present (`Quotation Q-0001 from …`) |

The tax arithmetic, minor-unit representation, half-up rounding on a non-terminating tax amount, PDF
generation, and SMTP delivery are all correct. The earlier `SAR 0.00` reading was a hydration
artifact in the browser test, not a calculation defect.

The **client-side estimate** shown while typing is still unverified through a real browser, since
that requires the production build. It is a display-only convenience — the panel itself says "Final
totals are checked when you continue" — but it should be confirmed once OPEN-1 clears.

## Verification summary after all fixes

| Suite                           | Result                           |
| ------------------------------- | -------------------------------- |
| `pnpm lint`                     | clean                            |
| `@bizo/api` tests               | 149 passed, 43 skipped           |
| `@bizo/web` tests               | 6 passed                         |
| `@bizo/config` tests            | 8 passed                         |
| Money-path API verification     | 16 passed, 0 failed              |
| Throttle bypass re-test         | enforced (`401` ×10 then `429`)  |
| `prisma migrate status`, no env | `Database schema is up to date!` |

## Recommended order

1. Review and commit the seven fixes below.
2. Re-run the full Playwright suite in CI (or on Linux) to confirm the browser journey end to end —
   OPEN-1 blocks doing this on macOS.
3. OPEN-6 — decide the i18n/RTL approach before the component count grows further.
4. Watch for an upstream fix to OPEN-1 so macOS developers regain local `pnpm check`.

## Changes made to the repository

All changes are uncommitted and ready for review.

| File                                                    | Change                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/lib/client-ip.ts`                         | HMAC-sign the forwarded client IP (FIXED-1)                        |
| `apps/web/src/lib/client-ip-header.ts`                  | Add the signature header constant (FIXED-1)                        |
| `apps/api/src/security/client-ip.ts`                    | Verify the signature with `timingSafeEqual` (FIXED-1)              |
| `apps/api/src/security/client-aware-throttler.guard.ts` | Pass signature and secret to the parser (FIXED-1)                  |
| `apps/api/src/security/client-ip.spec.ts`               | 6 tests covering forged, missing, and rebound signatures (FIXED-1) |
| `turbo.json`                                            | Declare `env` on the `dev` task (FIXED-2)                          |
| `packages/database/prisma.config.ts`                    | Also load the repository-root `.env` (FIXED-3)                     |
| `.env.example`                                          | `127.0.0.1` for `AUTH_URL` / `API_INTERNAL_URL` (FIXED-4)          |
| `apps/api/src/common/problem-details.filter.ts`         | Honour 4xx from body-parser; add 413 title and code (FIXED-5)      |
| `apps/web/next.config.ts`                               | Content-Security-Policy, plus HSTS in production (FIXED-6)         |
| `apps/web/src/app/not-found.tsx`                        | New — plain-language 404 (FIXED-7)                                 |
| `apps/web/src/app/error.tsx`                            | New — plain-language error boundary (FIXED-7)                      |

Untouched by this session: the ERPNext working tree (`apps/api/src/erpnext/`, `ops/erpnext/`), the
two `business_access_roles` migrations, and the new product documents. `apps/web/package.json` and
`pnpm-lock.yaml` were temporarily modified during OPEN-1 diagnosis and have been restored to `HEAD`.
