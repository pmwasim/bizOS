# bizOS launch-readiness assessment — 2026-09-07

**Method:** Local, loopback-only. No production deploy, no production systemd unit touched, no
Cloudflare/tunnel change, nothing resumed under the open "Systems and Definitions" maintenance
window. Everything marked **Verified** below was actually run this session; everything marked
**Reported** is carried from a document (a prior audit, a journal entry) and re-checked against
current code/config where practical, but not independently re-executed in full.

---

## 1. Where the code is — one project, five directories with distinct jobs

This is one project (`github.com/pmwasim/bizOS`) laid out across five directories under
`/home/wasim/`, not rival copies. Each has a specific, checkable role:

| Directory             | What it is                                                                                                    | Role                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `~/bizOS`             | Primary git checkout, branch `cursor/autodeploy-activated-catchup`                                            | **Development.** Where agents/humans edit, branch, and run the local dev stack. 8.7 GB (full `node_modules`, build caches, `.agent`/`.agents` scratch state for the multi-agent claim protocol).                                                                                                                                                                                                                                           |
| `~/bizo-task32`       | A `git worktree` of the **same repository** as `~/bizOS` (`git worktree list` shows both, sharing one `.git`) | **Parallel in-flight work.** Checked out on branch `sprint8-task32`, one commit ahead of `origin/main` (`e590fa3`, "add persisted stock valuation"), open as PR #159. This is the standard git mechanism for a second agent to work a different branch without a second full clone or colliding in `~/bizOS`'s working directory. Only 2 dirty files (agent-graph bookkeeping); healthy, active, going through a real PR — not drift risk. |
| `~/bizos-production`  | A **separate, independent git clone** of the same GitHub repo (its own `.git`, not a worktree)                | **Deployment target.** `bizos-api.service`/`bizos-web.service` run directly out of this checkout (`WorkingDirectory=/home/wasim/bizos-production/...`). 448 MB — a production build, not a dev tree.                                                                                                                                                                                                                                       |
| `~/bizos-maintenance` | Standalone Python script + one HTML page, no git repo, no bizOS dependencies                                  | **Ops utility**, not application code: the 503 placeholder page infrastructure serves if the app itself needs to go fully dark. Correctly kept out of the app repo — it doesn't need bizOS's dependency tree at all.                                                                                                                                                                                                                       |
| `~/bizos-backups`     | Plain directory, not a git repo                                                                               | **Artifact storage**: pre-deploy DB dumps, config tarballs, and `deploy-history.log`. Not code.                                                                                                                                                                                                                                                                                                                                            |

**The `~/bizOS` / `~/bizos-production` split is deliberate and documented, not accidental
duplication.** `docs/operations/ubuntu-production-cutover.md` records exactly why it exists: before
2026-08-15, `bizos-web.service` ran `next dev` directly out of `~/bizOS`, which meant the dev HMR
client and `next-devtools` were served publicly, the CSP couldn't be hardened (`next.config.ts` only
tightens it under `NODE_ENV=production`), the process idled at ~7.8 GB resident, and — the specific
failure mode worth naming — **an uncommitted edit in the dev checkout changed the live site
immediately**. The fix was to give production its own checkout, built and restarted deliberately by
`deploy-production.sh`, so editing `~/bizOS` can never touch what's live.
`docs/operations/production-runbook.md` §Architecture states the same thing in one line ("a separate
git checkout of this repo, not the dev checkout") and points back to the cutover doc.

**So the split is itself a real, working safety mechanism, not a launch risk by itself.** The
residual risk it does carry is structural to _any_ two-checkout deploy pipeline: the two checkouts
can go out of sync if the sync step (`deploy-production.sh`/`autodeploy.sh`) fails partway. That's
exactly what happened on 2026-09-03 — see §2, reframed below as a pipeline-state question, not a
"which is authoritative" question.

**What a newcomer isn't told, and should be:** none of this — the `bizos-production` split, the
`bizo-task32` worktree, or the existence of `bizos-maintenance`/`bizos-backups` — is mentioned in
`AGENTS.md`, the document every agent is told to "read first, in full, before touching the
repository." The explanation only exists two hops away, in `docs/operations/production-runbook.md`
and `ubuntu-production-cutover.md`, which nothing in the onboarding path points at. `AGENTS.md`'s
own concurrency story (`pnpm agent:claim`, a single shared working tree) also never mentions that
`git worktree` is a second, already-in-use mechanism for the same problem (`bizo-task32` uses it,
`bizo-task32` isn't claim-registered because it's a different directory entirely). A newcomer
reading only `AGENTS.md` would not know `bizos-production` exists, would not know why a second
checkout of the same repo is sitting on the same box, and would not know a worktree is a sanctioned
way to get a third one. **Recommendation: add a short "Host layout" section to `AGENTS.md` itself**
— even just the five-row table above plus a link to the two ops docs — rather than leaving it to be
discovered.

Aside from the split itself, `~/bizOS`'s dirty working tree (20 uncommitted changes) is not at-risk
work — diffed directly against `5ea9507` (the current production/`origin/main` tip): +158/-690
lines, almost entirely lockfile/version noise plus a slightly smaller, superseded draft of the same
stock-reservation feature that already shipped via PR #156. Nothing here would be lost if the tree
were reset. One genuine (harmless) housekeeping item found while checking this:
`docs/decisions/README.md`'s ADR index is missing entries for **ADR-0026 and ADR-0027**, which exist
on disk — a documentation gap, not a code one.

**Verified** (git worktree/remote inspection on all five directories, `du -sh`, and the two ops docs
read in full).

---

## 2. The production/main gap — a deployment-state question, not a two-projects question

To be clear given §1: this is **one pipeline** (`~/bizOS`/`origin/main` → `deploy-production.sh` →
`~/bizos-production`'s checkout → build → systemd restart), not two projects that drifted apart. The
question that matters is narrower and more mechanical: _is the deploy target's checkout, and the
build actually running from it, both current with what `origin/main` holds?_ Right now, yes — but it
got there through a real bug in the sync step, which is the part worth fixing.

This is now **closed**, but it closed narrowly and by a path that has a real process bug in it.

- `bizos-production`'s checkout (`5ea9507`) exactly matches `origin/main`. Confirmed by
  `git merge-base --is-ancestor` and by `git fetch` + `git log` on both remotes.
- The **running build** (not just the checkout) also matches: `apps/api/dist/*.js` mtimes for the
  files that actually changed in the last few commits land at 2026-09-03 12:52, and the systemd
  `ExecMainStartTimestamp` for `bizos-api` is 2026-09-03 12:53:51 — consistent with a real rebuild
  and restart at that point, not a stale binary.
- **How it got there matters.** Per `docs/journal/2026-09-03-resume-from-maintenance-window-*.md`
  (bizos-production): earlier that same day, an autodeploy tick advanced the git checkout to
  `5ea9507` but **aborted before building** because `mem_guard()` in `deploy-production.sh` tripped
  on swap pressure and called `exit 1` from inside a function — which skips the rollback branch
  entirely rather than returning a handleable failure. That left checkout and running build split
  (checkout at `5ea9507`, serving `7c2c3cc`) for several hours, and the journal explicitly warns
  this **will not self-heal**: `autodeploy.sh` compares `HEAD` to `origin/main`, and since the
  checkout had already moved, the next tick would see "nothing to do" forever. It was closed by a
  **manual** rebuild+restart (evidenced by the Sep 3 12:5x timestamps), not by the automation fixing
  itself.
- **This bug in `mem_guard()`/`autodeploy.sh` is still unfixed in the code** (I did not check
  whether a later PR fixed it — worth a direct look at `scripts/ops/deploy-production.sh` and
  `scripts/ops/autodeploy.sh` before relying on autodeploy again).
- Autodeploy has been **paused since 2026-09-04 02:29** by the open "Systems and Definitions"
  maintenance window (`bizos-autodeploy.timer` stopped and disabled). It has not ticked since.

**Commits currently sitting between `bizos-production`'s local `main` branch pointer and
`origin/main`** (the local `main` branch specifically, not the detached-HEAD checkout, is 15
behind):

| Commit                                     | What it does                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `5ea9507`                                  | Automatic stock reservations (#156) — now live                                        |
| `7c2c3cc`, `ae0c71c`, `40ca2dd`, `a208e19` | Autonomous gated production deploy infra + kill switch (ADR-0027)                     |
| `be72983`                                  | Dark mode on design tokens, persisted toggle                                          |
| `c9dc0d1`                                  | Gated, reversible production deploy script                                            |
| `d10a3f3`, `59d2f8b`                       | Maintenance-mode resume + homepage banner                                             |
| `ff28766`                                  | Resolve open items — main sync, zero-budget AI (security-hardened), prune stray files |
| `09d21ff`                                  | Sprint 8 TASK-30: multi-warehouse stock locations & movement journal                  |
| `10a7b74`                                  | Sprint 7 TASK-29: CRM lifecycle verification gate                                     |
| `9cc7a58`                                  | Sprint 7 TASK-28: customer activity timeline                                          |
| `b1a89c5`                                  | Sprint 7 TASK-27: opportunity → quotation conversion                                  |
| `76c577b`                                  | Sprint 7 TASK-26: lead scoring & lead→opportunity progression                         |

All of this is **already live** (it's in `origin/main`, which is what's deployed) — this table
exists so the actual size of the recent shipped backlog is visible, not because anything here is
still pending.

**19 open PRs** on GitHub, none merged: mostly Dependabot version bumps (oldest from 2026-08-24),
plus `#160` (fix for the `mem_guard`/autodeploy bug above), `#159` (FIFO/AVCO stock valuation),
`#155` (draft, this session's own catch-up docs), and `#135` (draft, merge-conflicting n8n
automation). **0 open issues.**

**Verified** (git state, timestamps, journal cross-check, `gh pr list`).

---

## 3. Running it locally

**Install:** clean, `pnpm install` reported already up to date. **Verified.**

**Build:** `pnpm build` — 9/9 tasks succeed (fully cached from the typecheck run below).
**Typecheck:** `pnpm typecheck` — 18/18 tasks succeed, including a real `next build` of the web app.
**Lint:** `pnpm lint` (root `eslint .`) — clean, zero findings. **Format / docs links /
tracked-artifacts / local-services security:** all pass (`pnpm format:check`, `pnpm docs:check`,
`pnpm repo:artifacts`, `pnpm security:local-services`). **DB schema:** `pnpm db:validate` — schema
valid.

All **Verified**, real command output, not carried from a journal.

### The one real "won't start" finding

Following the **README's own "Start locally" instructions literally** (`pnpm install`,
`docker compose up -d`, `pnpm db:validate`, `pnpm dev`) — **the API crashes on startup**:

```
ZodError: [DATABASE_URL, INTERNAL_AUTH_SECRET, SMTP_FROM, SMTP_URL — all "expected string, received undefined"]
  at readApiEnvironment (packages/config/dist/api.js:83)
  at bootstrap (apps/api/src/main.ts:15)
```

Root cause, confirmed by reading the code: the API reads `process.env` directly with no dotenv step,
and `turbo.json`'s `dev` task doesn't inject env from `.env` — turbo only uses that entry for
cache-hash purposes. Nothing in the documented flow ever gets the values from `.env` into the
process. This is **not an unknown bug** — `AGENTS.md`'s "Non-obvious gotchas" section names it
exactly and gives the fix: `set -a && . ./.env && set +a && TURBO_ENV_MODE=loose pnpm dev`. But that
fix lives only in the agent-facing handbook, not in `README.md`, which is what a human (or an agent
that only reads the public quickstart) would actually follow.

I reproduced the crash exactly per the README, then reproduced a clean start using the documented
workaround:

```
API health: 200  {"service":"api","status":"ok",...}
Web home:   200
Web signin: 200
```

Both bound to loopback (`127.0.0.1:3101` / `127.0.0.1:3100`, chosen to not collide with production's
3000/3001), verified with `curl`, then shut down by explicit PID (per `AGENTS.md`'s own warning:
never `pkill` by process-name pattern on this host — `next-server` also matches production).
Production (`bizos-api`, `bizos-web`, `cloudflared`, `bizos.qloudihub.com`) was re-confirmed active
and responding 200 throughout and after.

**This is not a blocker** — the app runs correctly once you know the one-line env-loading step — but
it is a real, currently-shipping onboarding defect: the public README's quickstart does not work as
written, and the fix is undocumented outside an agent handbook. **Recommendation: fold the
`set -a && . ./.env && set +a` step (or switch the API to load dotenv itself) into `README.md`, not
just `AGENTS.md`.**

**Verified**, including the failure and the fix, both reproduced live.

---

## 4. Tests

Full suite, real command output:

| Package               | Files                      | Tests                         |
| --------------------- | -------------------------- | ----------------------------- |
| `@bizo/api`           | 86 passed, 11 skipped (97) | 979 passed, 74 skipped (1053) |
| `@bizo/database`      | 4 passed                   | 63 passed, 7 skipped          |
| `@bizo/web`           | 10 passed                  | 55 passed                     |
| `@bizo/contracts`     | 21 passed                  | 180 passed                    |
| `@bizo/queue`         | 1 passed, 1 skipped        | 10 passed, 1 skipped          |
| `@bizo/authorization` | 2 passed                   | 13 passed                     |
| `@bizo/storage`       | 1 passed                   | 9 passed                      |
| `@bizo/config`        | 2 passed                   | 15 passed                     |

Root: **18/18 tasks successful.** Zero failures anywhere in the default run.

The 74 skipped API tests are gated behind `RUN_DATABASE_TESTS=true` — they're the suites that hit a
real PostgreSQL client rather than a mock (deliberately: a comment in
`phase1-modules-journey.integration.spec.ts` explains that mocked `DatabaseService` tests can't
catch wrong-field/wrong-relation Prisma bugs that a real round-trip does). These include the
**cross-tenant-isolation and System-Admin-authorization suites that the PRD names as release gates**
(§21), so I re-ran the whole API suite against the real local Postgres:

```
RUN_DATABASE_TESTS=true, env sourced from .env
Test Files  97 passed (97)
     Tests  1053 passed (1053)
```

**Zero skips, zero failures**, including `business-admin-boundary`, `system-admin-authorization`,
`configuration-assignment`, `payments-invariants`, `crm-lifecycle`, and the phase-1 modules journey.
(My first two attempts at this — `pnpm --filter @bizo/api test` and `turbo run test --filter=...`
without sourcing `.env` first — failed with the same env-loading gap as §3. Once `.env` was actually
sourced into the shell, everything passed. Recorded here so the false start isn't mistaken for a
product bug.)

`pnpm audit --audit-level=moderate`: **8 vulnerabilities (5 high, 3 moderate)** — `fast-uri` (SSRF /
host-confusion, 4 advisories, high), `qs` (2 advisories, moderate, reached via
`express`/`body-parser` in the live API dependency chain — this one is a real runtime path, not a
CLI-only dependency), and `mysql2` (2 advisories) which is pulled in transitively by the Prisma CLI
even though the runtime database is PostgreSQL — a previously-documented false-positive-shaped
finding (per the 2026-09-02 journal), but the `qs`/`fast-uri` chain through `express` has not been
similarly triaged and should be, since it sits in the actual request path.

**Not run:** the Playwright e2e suite (`e2e/*.spec.ts`, 5 files). `AGENTS.md` specifies it needs
scratch ports (`E2E_WEB_PORT`/`E2E_API_PORT`) and a **separate, migrated-and-seeded** database
(`bizo_e2e`) — standing up a second seeded database was out of proportion for this assessment pass
given everything else already gives strong confidence, but it's real, undone work, not something I'm
quietly assuming passes. Flagging plainly rather than estimating: **e2e status is unknown from this
session.**

**Verified** except e2e (explicitly not run).

---

## 5. PRD vs. what's actually implemented

PRD is `docs/product-requirements.md`, v4.0, **last reviewed 2026-07-28** — itself now six weeks
stale relative to the Sprint 7/8 work that's since shipped. Its own "Current live baseline" (§15)
undersells what exists today; treat that section as out of date, not as ground truth.

### Working and verified by running the app / tests

- Account/session, tenant isolation, role-based access, cross-tenant denial — all covered by the
  real-Postgres integration suite above, 100% passing.
- Quotation → Customer PO → Approval Evidence → Ready-to-Invoice → Invoice (the "current specialized
  workflow", PRD §7) — the original, still-working vertical slice.
- Sales orders, delivery notes, credit notes, inventory (including the new stock-reservation/ATP
  logic), suppliers, CRM (leads/opportunities/activity journal), projects — real NestJS services
  with passing unit and integration tests, not stubs.
- ZATCA Phase 1 QR/UBL generation — 41 test cases, deterministic, and (per the 2026-09-02
  generalisation audit, re-confirmed here by reading the pricing page copy) **honestly labeled
  `beta`**, not oversold as Phase 2 clearance.

### Implemented but not switched on (PRD §16's "immediate priority")

- **`packages/database/prisma/seeds/module-catalog.ts` still marks `sales-orders`,
  `delivery-service`, `credit-notes`, `inventory`, `projects`, and the supplier-side modules as
  `implemented: false`**, despite all of them having working services and tests underneath. A new
  business created today via "Configure later" / "Use default ERP" still only gets the original
  specialized workflow — the Default bizOS ERP the PRD describes in §5 is built but not exposed.
  This matches the 2026-09-02 generalisation audit exactly; I re-checked the file directly rather
  than taking the audit's word for it, and it's unchanged.

### Real, still-open gaps (re-verified this session, not just carried from old docs)

- **`validUntil` is a required (non-nullable) column used by four services that aren't quotations**
  (`sales-orders`, `credit-notes`, `invoices`, `delivery-notes` all write a synthetic
  `validUntil = issueDate` to satisfy a constraint that conceptually only describes quotations).
  This was flagged in the 2026-08-15 journal entries as a modeling smell; it has since **spread to
  more services**, not shrunk.
- **`as unknown as` casts defeating Prisma's structural typing: 243 occurrences** across
  `apps/api/src`, up from the "phase-1 services" scope originally flagged. This is exactly the class
  of bug the real-Postgres integration suite exists to catch (its own top-of-file comment says so) —
  which is a good mitigation, but the underlying pattern is still spreading, and the mitigation only
  runs when someone remembers `RUN_DATABASE_TESTS=true`.
- **Duplicate ADR numbers**: two ADR-0021s, two ADR-0022s — flagged 2026-08-30, still present.
- **No e2e path reaches a recorded payment** (per 2026-08-15 journal) — status unconfirmed this
  session since e2e wasn't run (see §4).
- Previously-flagged fabricated/mock-data UI surfaces (`mockItem`, `mockProj`, `mockNote`, the CRM
  "Activity Feed Timeline Mock Data" placeholder) — **checked and confirmed gone.** Grepped the
  whole web app; zero matches. This one is actually fixed, not just claimed fixed.

**Mixed**: PRD sections read directly (Verified as text); implementation status checked live against
current code (Verified); a few items (e2e-to-payment coverage) carried from a journal entry and not
re-run (Reported, marked as such above).

---

## 6. Data safety — the actual launch blocker

This is the one finding in this report that belongs in the "loses user data" category, not the
"embarrassing" one.

**Production's live database (`bizo-postgres-1`, local Docker Postgres, holding real quotations,
invoices, customers) has no scheduled backup.** I read the actual backup script
(`/home/wasim/bin/db-backup`, run daily by `db-backup.timer`): it dumps `ai-postgres` (n8n) and
`windmill-db-1` only. There is no `bizo` step in it at all. The `bizo-*.dump` files that exist in
`/home/wasim/bizos-backups/databases/` (dated Sep 2, Sep 3 ×2) are **ad-hoc snapshots the deploy
script takes immediately before a deploy** — not from the daily cron. Since autodeploy has been
paused since 2026-09-04, no new one has been taken since **2026-09-03 12:51**, four days ago as of
this report, and none will be until either autodeploy resumes or someone runs one by hand.

`docs/operations/production-runbook.md`'s "Database restoration" section (dated "verified
2026-07-27") describes a **different, no-longer-accurate setup** — managed Prisma Postgres backups —
that doesn't match the current local-Docker-Postgres reality at all. This exact gap was flagged in
two separate 2026-09-02 journal entries ("needs its own investigation... not fixed here") and is
still open today; I re-confirmed it by reading the actual script rather than re-quoting the journal.

**This is the single highest-priority item in this report.** Everything else here is a quality or
completeness gap; this one is the difference between an incident and a catastrophe if the disk or
container is ever lost. It needs a real `bizo` step added to `db-backup` (or an equivalent scheduled
job) and a **tested restore**, before anything else on this list.

**Verified** (read the actual script and file listing, not inferred).

---

## 7. Known open items collected from the journal

Cross-checked against current code where I had time; marked accordingly.

| Item                                                                               | Status as of this session                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| No scheduled backup of the `bizo` database                                         | **Still open** — see §6, this is the top finding                                                                                                  |
| `mem_guard()` in `deploy-production.sh` calls `exit 1`, skipping the rollback path | **Unknown** — caused the real drift in §2; not checked whether since patched (PR #160 claims to address this, unmerged)                           |
| Production runbook's "Database restoration" section is stale                       | **Still open**, confirmed by reading it                                                                                                           |
| `module-catalog.ts` flags still off for built modules                              | **Still open**, confirmed by reading the file                                                                                                     |
| Two ADR-0021s, two ADR-0022s; ADR-0026/0027 missing from the index                 | **Still open**, confirmed                                                                                                                         |
| `validUntil` NOT NULL misused outside quotations                                   | **Still open, now wider** (4 services, was fewer)                                                                                                 |
| `as unknown as` casts defeating typechecking                                       | **Still open, now wider** (243 occurrences)                                                                                                       |
| Fabricated mock-data UI surfaces (`mockItem`/`mockProj`/`mockNote`/CRM feed)       | **Fixed** — confirmed absent                                                                                                                      |
| Missing BFF write paths for inventory/projects/credit notes                        | **Likely fixed** — those modules now have full services + passing tests; not individually traced end-to-end from a web form click in this session |
| RevenueCat real billing (Stripe/RC Billing) not connected — Test Store only        | **Reported, not re-checked** — no monetization path is live regardless of anything else in this report                                            |
| Circuit-breaker trip path (autodeploy) never observed for real                     | **Reported, not re-checked**                                                                                                                      |
| Prisma Compute Deploy GH check red / not required                                  | **Reported, not re-checked** — cosmetic CI noise, not a runtime risk                                                                              |
| No e2e test reaching a recorded payment                                            | **Reported, not re-checked** (e2e not run this session)                                                                                           |

---

## 8. Launch-readiness verdict, ordered by whether it blocks launch

### Blocks launch (data loss / trust-destroying if it happens)

1. **No backup of the production database.** Fix before anything else ships. (§6)

### Blocks a clean team onboarding, not a blocker for the owner personally (workaround exists and is documented, just in the wrong place)

2. README "Start locally" doesn't work as written; the real steps are in `AGENTS.md`'s gotchas
   section. Fold the env-loading step into `README.md`. (§3)
3. `deploy-production.sh`'s `mem_guard()` bug that caused the real production/main split earlier
   this month — confirm PR #160 actually fixes it before trusting autodeploy again once the
   maintenance window closes. (§2)

### Should be resolved before calling the product "generalized" (PRD's own stated next milestone, §16)

4. Flip `module-catalog.ts` flags for the modules that are already built and tested, and verify each
   newly-exposed module against a real business — this is the PRD's explicitly-named next priority,
   and the code for it already exists. (§5)

### Real, but improve-not-block

5. `validUntil` schema misuse (4 services) — a correctness/clarity smell, not a live bug (tests
   pass).
6. 243 `as unknown as` casts — mitigated by the real-DB integration suite when someone remembers to
   run it; not mitigated by default `pnpm test`, `pnpm check`, or CI unless those are configured to
   set `RUN_DATABASE_TESTS=true` (worth checking `.github/workflows/*.yml`, not done this session).
7. `qs`/`fast-uri` vulnerabilities in the live Express dependency chain — worth a real triage pass,
   distinct from the already-triaged `mysql2` (CLI-only) finding.
8. Duplicate ADR numbers, missing ADR-0026/0027 from the index — pure documentation hygiene.
9. e2e suite not run this session, and its actual current pass/fail state is unknown — worth running
   properly (scratch DB + seed) before treating "tests pass" as covering the full stack.

### Not this session's call (explicitly out of scope)

- Real ZATCA Phase 2 clearance, general ledger, multi-country tax packs, RevenueCat real billing —
  all pre-existing, correctly-labeled-as-beta-or-absent product decisions from the prior audits,
  unchanged by anything checked here.
- Marketing/qloudihub.com — separate workstream per instruction, not touched.

---

## What I did not do

Did not touch any production systemd unit, the Cloudflare tunnel, DNS, Access policies, or the
`bizos-maintenance` service. Did not resume anything paused by the "Systems and Definitions"
maintenance window. Did not run the Playwright e2e suite (needs a second seeded database — flagged,
not assumed passing). Did not query production business data directly (blocked by the harness's own
safety classifier when I tried; I did not attempt to work around it — a read-only row count wasn't
essential to this assessment). Did not open, close, or comment on any GitHub issue or PR. Did not
start fixing anything in this repo — this is the assessment only, per instruction.
