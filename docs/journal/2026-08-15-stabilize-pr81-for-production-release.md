# Stabilize PR81 for production release

Date: 2026-08-15

Agent: claude-cowork

Scope: apps/api/src, apps/web/src, e2e

Status: Complete

Related: PR #81, issue #56, ADR-0023, `2026-08-07-retire-render-production-path.md`

## Context

PR #81 (`chore/commit-live-production-work`) is the release-blocking branch: it commits the API
modules and web routes that were running in production as untracked files, recovers contract sources
that survived only as compiled artifacts, and fixes the statements and products RLS defects. It had
been red for five pushes. No journal entry exists for the work on 2026-08-14, so the branch's
history is the only record of it — this entry starts the record from the point the branch had to be
made mergeable.

Three checks were failing on the branch head (`0761954`):

- **Quality gate** — 5 of 6 Playwright journeys failed.
- **CodeQL** — 3 new alerts (2 high, 1 medium).
- **Prisma Compute Deploy** — failure #5 with the same error every push.

## What changed

### E2E throttling (the Quality gate failure)

The job log shows `ThrottlerException: Too Many Requests` throughout the run, and the failures that
follow are its symptoms, not independent defects: `/start` never rendered so
`getByLabel(/Business name/)` timed out, and the quotation PDF fetch returned not-ok. The whole
suite drives the product from `127.0.0.1`, so every test shares one throttle bucket — the global
`{ limit: 100, ttl: 60_000 }` plus `{ limit: 5 }` on `auth/signup`. A real user never approaches
those numbers; a six-journey suite exhausts them in the first minute.

- Added `apps/api/src/security/throttle-policy.ts` exposing `throttleScale`, `scaledLimit`, and
  `scaledThrottle`. `THROTTLE_SCALE` widens every limit by a fixed factor and can only widen —
  values below 1, non-numeric values, and `NODE_ENV=production` all resolve to 1.
- Applied it to `ThrottlerModule.forRoot` in `app.module.ts` and to all eight `@Throttle` decorators
  (`identity`, `documents/quotations`, `documents/invoices`, `purchase-orders`).
- `packages/config/src/api.ts` validates `THROTTLE_SCALE` and refuses to boot a production process
  that sets it to anything but 1, so the guard exists at both boot and call time.
- `.github/workflows/ci.yml` sets `THROTTLE_SCALE: "40"` for the quality job only.
- `apps/api/src/security/throttle-policy.spec.ts` pins the strict defaults, the
  production-ignores-the-knob behaviour, and the never-narrows property.

### Sign-in assertion (the second Quality gate failure)

`e2e/signin.spec.ts` asserted `heading "Welcome back"`. The page renders `Welcome back` as the
`step-label` span and `Sign in to bizOS` as the `h1` — the assertion had never matched the markup.
Corrected to assert both the label text and the real heading. This is a test defect, not the
production `/signin` 404 tracked in issue #56, which remains open.

### CodeQL alerts

- `js/polynomial-redos` in `apps/api/src/ai/ocr-extractor.service.ts:112` — the line-item regex
  `^([A-Za-z0-9\s]+?)\s+(\d+)\s+...$` backtracks quadratically because the lazy class and the
  following `\s+` both match spaces, on attacker-supplied document text. Replaced with an exported
  `parseLineItem` that splits on whitespace once and reads fixed positions from the end.
- `js/polynomial-redos` in `apps/api/src/ai/rag-search.service.ts:70` — `/System prompt:.*$/i` over
  attacker-supplied query text. Replaced with an exported `stripPromptInjectionMarker` using
  `indexOf`.
- `js/client-side-unvalidated-url-redirection` in `apps/web/src/app/signin/page.tsx:41` — the
  `callbackUrl` sanitiser checked only `startsWith("/")` and `!startsWith("//")`, which backslash
  variants (`/\evil.com`) defeat in some browsers. Now resolves the candidate against
  `window.location.origin` and rejects anything whose resolved origin differs.
- Both parsers gained specs, including timing assertions on pathological input.

### Prisma Compute Deploy

The hosted runner executes `prisma migrate deploy` from the repository root, finds the schema by
convention, and fails with "The datasource.url property is required in your Prisma config file" —
`packages/database/prisma.config.ts` is only consulted when Prisma runs with that package as its
working directory. Added a root `prisma.config.ts` pointing at the same schema, migrations
directory, and `DATABASE_URL`. It is deliberately import-free: the repository root has neither
`prisma` nor `dotenv` installed, and the hosted runner must not depend on workspace hoisting.

### Review findings (second pass, `8d95fbf`)

The codex review on PR #81 raised six P1s and one P2. Three were already resolved by the 2026-08-14
commits and are recorded here so nobody re-investigates them:

- Duplicate API-key/webhook migration — **not reproducible**. Every statement in
  `20260807040000_api_keys_and_webhooks` is `IF NOT EXISTS` and every constraint is guarded by a
  `pg_constraint` lookup (fixed in `a1c4458`). CI applies migrations and reports no divergence.
- Payment form field mapping — **already fixed** in `a7c5c0a`. `recordPaymentAction` builds a
  `recordPaymentRequestSchema` payload against `POST /businesses/:id/payments`.
- Statements scoping by customer — **already fixed** in `11a6433`.

Four were real and are fixed here:

- **Invoice settlement was never written.** `complete` and `reverse` wrote `status: "PAID"` /
  `"PARTIAL"` and an `amountPaidMinor` column onto the document. `DocumentStatus` has neither member
  and the table has no such column, so each write threw into a bare `catch {}`. The payment was
  marked completed, the invoice was untouched, nothing was logged. Settlement is now derived from
  `payment_allocations` — ADR-0023.
- **The invoice payment summary endpoint did not exist.** `payments/new/page.tsx` called
  `GET /businesses/:id/invoices/:id/payments` on every render; no handler matched, so recording a
  payment 404'd before the form appeared. Added as `PaymentsService.invoicePaymentSummary`, exposed
  on `InvoicesController` (which now imports `PaymentsModule`).
- **Statements counted unissued invoices.** Every `INVOICE` document was a debit, drafts included,
  overstating total invoiced and closing balance. Restricted to `SENT` on both the invoice query and
  the allocation join.
- **Password reset had a check-then-act race.** Two confirmations for one token could both read it
  as unused and both write a password. The token is now claimed with a conditional `updateMany`
  inside the transaction and only the winner updates the user. Covered by a new spec.
- **(P2) Issued API keys could never authenticate.** `create` stored `randomBytes(32)` unrelated to
  the `bzo_` secret it returned. Now stores SHA-256 of the returned credential. No verification path
  consumes this yet, so no key in existence is invalidated by the change.

### Cross-agent entrypoints

Claude, Gemini/Antigravity, Copilot, and Cursor each look for their own instruction file. Finding
none, they invent conventions that collide with the claim-and-journal protocol. Added `CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md`, and `.cursor/rules/bizos-agent-protocol.mdc` — all
pointers to `AGENTS.md`, never copies, so a rule still changes in exactly one place.

## Decisions and trade-offs

**Widen throttles for the harness rather than serialise or slow the suite.** Rejected: adding waits
or `workers: 1` pacing (the suite already runs `workers: 1`; the limits are per-minute, so pacing
means a multi-minute suite); rejected: exempting `127.0.0.1` in the guard (that is a production code
path with a permanent hole in it); rejected: forwarding a per-test client IP through
`x-bizo-client-ip` (that header is signature-gated precisely to stop callers choosing their own
bucket — BIZ-003 — and handing the harness the secret would undo it). The chosen knob only widens,
only outside production, and is refused at boot in production. It does mean e2e no longer exercises
the production limit values; `throttle-policy.spec.ts` covers those directly instead.

**Corrected the sign-in assertion rather than the markup.** The heading text is a product decision
already shipped and visible in production; the test simply never matched it. Changing the page to
satisfy a stale test would have been the dishonest direction.

**Tokenised the OCR line parser rather than tightening the regex.** A bounded regex would have
silenced CodeQL, but the ambiguity between the description class and the following separator is
inherent to the pattern. Splitting once is linear by construction and cheaper to reason about.

No ADR raised: none of this changes a binding architectural position. The `THROTTLE_SCALE` contract
is recorded in `docs/security.md` under Application.

## Verification

Run on the branch head with the repository `.env` exported. E2E was **not** run locally: this
machine is serving production on ports 3000/3001 and `playwright.config.ts` sets
`reuseExistingServer: !CI`, so a local run would have driven the suite against the production
database. E2E verification is CI-only until production moves off this host.

```text
pnpm lint                                            # pass (exit 0)
pnpm --filter @bizo/api exec tsc --noEmit            # pass
pnpm --filter @bizo/web exec tsc --noEmit            # pass
pnpm --filter @bizo/config exec tsc --noEmit         # pass
pnpm --filter @bizo/api test                         # pass — 624 passed, 43 skipped (57 files)
pnpm format                                          # pass (no changes)
pnpm docs:check                                      # pass — all local Markdown links resolve
pnpm repo:artifacts                                  # pass
pnpm security:local-services                         # pass
pnpm db:validate                                     # pass (pre-existing SetNull warnings only)
pnpm graph                                           # regenerated — 9 workspaces, 24 decisions
pnpm test:e2e                                        # NOT RUN locally — see above; green in CI
pnpm build                                           # NOT RUN — @bizo/web#build fails locally on
                                                     #   /_global-error prerender (AGENTS.md
                                                     #   documents this as pre-existing local-only;
                                                     #   CI's build and container jobs are green)
```

The 43 skipped API tests are the integration suites, which need `RUN_DATABASE_TESTS=true`; CI sets
it, so they ran there.

## Follow-ups

- **Release-blocking.** PR #81 carries merge commits from local history and the repository requires
  linear history. Squash-merge it; do not rebase-merge.
- **Release-blocking.** The codex review on PR #81 raised three P1s not addressed here: a duplicate
  migration creation failure, a missing invoice-payment summary endpoint, and a payment-form field
  mapping mismatch. Confirm each against the current branch head before merging.
- Production still runs `next dev` on this host. The runbook is committed (`3e02cb3`); executing it
  is the next production task and also unblocks running e2e locally.
- Issue #56 (production `/signin` returns a stale Next.js 404) is untouched. The e2e assertion fix
  does not close it.
- Local `main` is one merge commit ahead of `origin/main` and was never pushed. Reconcile it.
- `~/bizos-production` is a clone of the local `~/bizOS` working copy, not of GitHub, and sits at
  `a5c9edf` in detached HEAD. It drifts from the branch it was cut from.

## Handoff notes

Claim `clm_b243347e` covers `apps/api/src`, `apps/web/src`, `e2e` and is released at the end of this
session.

Sharp edges found:

- Do not run `pnpm test:e2e` on this machine while production occupies ports 3000/3001 —
  `reuseExistingServer` will point the suite at production.
- `THROTTLE_SCALE` reads `process.env` directly rather than through `readApiEnvironment`, because
  `@Throttle` decorators evaluate at import time, before a complete environment is guaranteed.
  `@bizo/config` remains the boot-time authority; the direct read is the fast path.
- CI job logs are reachable through `gh api repos/pmwasim/bizOS/actions/jobs/<id>/logs` when
  `gh run view --log-failed` returns empty, which it does on this repository.
