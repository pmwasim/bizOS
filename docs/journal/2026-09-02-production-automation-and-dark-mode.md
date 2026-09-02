# Production automation and dark mode

Date: 2026-09-02

Agent: claude-cli

Scope: scripts/ops, apps/web, docs

Status: Complete

Related: [ADR-0022](../decisions/0022-ubuntu-production-hosting.md),
[ADR-0026](../decisions/0026-local-gated-production-deploy-script.md),
[ubuntu-production-cutover.md](../operations/ubuntu-production-cutover.md),
[2026-09-02 maintenance banner](2026-09-02-resume-bizos-from-maintenance-and-add-homepage-maintenance-b.md)

## Context

Two requests, worked sequentially per instruction: (1) production automation — checkout/release
promotion, commit hygiene, deployment, bug scanning, validation; (2) dark mode for the web app,
built on tokens with a persisted user toggle.

Before writing anything, read `AGENTS.md`, `docs/multi-agent-protocol.md`, ADR-0022, the existing
`.github/workflows/*`, `scripts/ops/*`, and the host's own `~/machine-monitor` and
`~/bizos-maintenance/resume.sh`. Production automation already existed for validation
(`production-release-gate.yml`, `production-health.yml`) and post-deploy verification
(`ops:release-readiness`), but ADR-0022 explicitly left the actual Ubuntu checkout/build/restart/
rollback mechanism undiscovered and undocumented — every release since the 2026-08-15 cutover has
been a manual sequence, recorded after the fact. That was the real gap for workstream 1.

`bizos-production` was found frozen at `369b282` (2026-08-23) plus one cherry-picked banner commit
(`2aa44b4`) — roughly 10 days of merged Sprint 7–8 work (CRM lifecycle, multi-warehouse stock,
zero-budget AI, etc.) sitting on `main` unreleased. Per instruction, this backlog is surfaced, not
shipped, as part of this session.

## What changed

### Workstream 1 — production automation

- `scripts/ops/deploy-production.sh` (new) — the one deploy/rollback mechanism for the Ubuntu host.
  Human-triggered (`--sha <sha> --confirm` or `--rollback <sha> --confirm`, never scheduled). Checks
  memory/swap before every build step and aborts rather than risk an OOM; refuses a SHA that isn't
  an ancestor of `origin/main`; `pg_dump`s the production database before any migration; runs
  `pnpm check` as a hard gate before touching anything running; builds web and api sequentially;
  runs `prisma migrate deploy`; restarts `bizos-api` then `bizos-web` in order with health waits;
  verifies with `pnpm ops:release-readiness` against the public web origin + internal API; rolls
  back automatically (rebuild + restart + reverify against the previous commit) if verification
  fails; records every run in `/home/wasim/bizos-backups/deploy-history.log`.
- `~/machine-monitor/monitor.py` (host-local, outside this repo — not version-controlled) — added
  `check_production_logs()` (journalctl error-substring scan for `bizos-api`/`bizos-web`, same
  30-minute-tick heuristic already used for `dev.log`) and `check_dependency_audit()`
  (`pnpm audit --audit-level=high` against `bizos-production`, gated to once/day via a marker file —
  a registry call, too heavy for a 30-minute tick). Wired into `main()`; README updated. **Note:**
  at least one other session was concurrently editing this same file during this work (it gained an
  unrelated `check_agent_lifecycle`-style addition and an `import re` mid-session) — verified my two
  functions stayed intact and the file stayed syntactically valid throughout; did not touch anything
  else in it.
- `docs/operations/production-runbook.md` — rewrote the Architecture/Deployment/Rollback sections
  (previously described retired Render hosting, contradicting ADR-0022 — the exact hazard that ADR
  was written to prevent) to match the actual Ubuntu topology and the new script. Fixed the
  remaining stale Render references in Secret rotation, Cloudflare incident response, Application
  outage response, and Monitoring checklist. **Left as-is and flagged**: the "Database restoration"
  section still describes managed Prisma Postgres backups; production's database is local Docker
  Postgres (`bizo-postgres-1`) now — that staleness predates this session and needs its own
  verification pass, not a guess.
- `docs/decisions/0026-local-gated-production-deploy-script.md` (new ADR) — records the decision,
  rejected alternatives (self-hosted GitHub runner; auto-deploy on green CI), and an explicit note
  on the AGENTS.md / multi-agent-protocol.md authority contradiction (see below). Left `Proposed`,
  not self-accepted.
- `.claude/launch.json` (new) — a `bizos-dev` preview config that runs `@bizo/web` alone on
  `WEB_PORT=3050` (scratch port; production already holds 3000/3001) for future browser-driven
  verification sessions, reusing the `WEB_PORT` override the e2e config already defines.
- `pnpm graph` regenerated (`.agent/graph.json`/`.agent/graph.md`) to pick up the new ADR.

### Workstream 2 — dark mode

- `apps/web/src/app/globals.css` — added a dark palette for both existing token systems: the
  app-shell `:root` tokens (`--background`, `--foreground`, `--surface`, `--primary`, `--muted`,
  `--border`, `--success`, `--danger`, …) and the marketing `.marketing-site` tokens (`--mkt-ink`,
  `--mkt-paper`, `--mkt-teal`, `--mkt-muted`; `--mkt-signal`/`--mkt-signal-ink` deliberately
  unchanged — a fixed-contrast pair that reads fine on either background). Applied via
  `@media (prefers-color-scheme: dark)` scoped to `:not([data-theme="light"])` (system default) and
  mirrored under `:root[data-theme="dark"]` (explicit override survives a light-preferring OS).
  `color-scheme` set to `light dark` at the root so native form controls/scrollbars follow too.
  Because the app's ~120 `.page`/`.button`/`.stats`/etc. classes already funnel through these tokens
  (confirmed by inspection — the app doesn't use raw Tailwind gray/white utility classes or
  Tailwind's `dark:` variant anywhere; both were 0 hits), this repaints essentially the whole app
  from one place — not a component-by-component sweep.
  - Also patched, in the same dark-mode block (not scattered): a small number of pre-existing
    hardcoded-hex spots that would have actually broken (a fixed-white `.sidebar` background behind
    now-light text; `.avatar` and `.status-draft`/`.readiness-*` pairing a token that flips dark
    with a fixed light-mode-only text color; `.side-nav a`/`.signout button`'s fixed medium-gray
    text against the now-dark sidebar). Left alone: self-contained pairs that hardcode both
    background and text together (status pills, the System Admin sidebar's fixed indigo identity) —
    they stay legible in either theme without help.
  - `.mkt-maintenance-banner` pins its background to the original dark ink value explicitly: it uses
    `--mkt-ink` as a background (not the token's foreground-text convention the rest of the
    marketing site follows), so the ink/paper role-swap above would have turned the banner
    white-on-white-ish text without this pin. Verified in-browser (see below).
- `apps/web/src/app/layout.tsx` — reads a `theme` cookie the same way it already reads the `locale`
  cookie, sets `data-theme` on `<html>` when present. No cookie → no attribute → CSS
  `prefers-color-scheme` decides. Same mechanism as locale, so no client script needed for
  first-paint correctness.
- `apps/web/src/components/theme-toggle.tsx` (new) — light/dark toggle button. Uses
  `useSyncExternalStore` (not effect+`setState`, which the repo's lint config specifically forbids —
  `react-hooks/set-state-in-effect`) to read the cookie/`matchMedia` state without a hydration
  mismatch; clicking sets the cookie (1 year, `path=/`), flips `document.documentElement.dataset`
  immediately, and fires a custom event so the hook re-syncs.
- `apps/web/src/components/app-shell.tsx` — mounted `<ThemeToggle />` in a new `.sidebar-footer`
  wrapper above the sign-out button (authenticated app).
- `apps/web/src/components/marketing-shell.tsx` — mounted `<ThemeToggle />` in the marketing nav,
  next to the sign-in/session link. **Correction mid-session**: first added it to
  `marketing-nav.tsx`/`MarketingNav`, which turned out to be dead code — not imported by any page.
  The real, actively-used marketing wrapper (home, pricing, product, contact, subscribe, privacy,
  terms) is `MarketingShell`/`marketing-shell.tsx`. Reverted the dead-code edit, moved the toggle to
  the real component.
- Auth pages (`/signin`, `/signup` via `(auth)/layout.tsx`) have no nav to mount a toggle in, but
  already render entirely off the app-shell `:root` tokens (`.auth-page`/`.auth-panel` use
  `var(--surface-subtle)`/`var(--surface)`/`var(--border)`), so they inherit the correct theme
  automatically without a toggle of their own.

## Decisions and trade-offs

- **Local script, human-triggered, not GitHub-to-Ubuntu automation.** See ADR-0026. No self-hosted
  runner, no inbound webhook — zero new standing infrastructure, matches the zero-cost constraint,
  and keeps a human as the one who decides what ships.
- **Extended `~/machine-monitor` instead of building a second monitoring system.** It already does
  exactly this shape of work (zero-cost, rule-based, scheduled, durable output) for the machine and
  the repos on it; a parallel system would be pure duplication.
- **Did not touch the "Database restoration" section of the runbook.** It's stale (describes managed
  Prisma Postgres backups the box no longer uses) but that staleness predates this session and
  fixing it correctly needs its own investigation of the actual Docker Postgres backup posture —
  flagged in the runbook and here, not guessed at.
- **Did not attempt a real production deploy in this session**, even to exercise
  `deploy-production.sh` end-to-end. The script's guard paths were exercised directly (missing
  `--confirm`, malformed SHA, non-ancestor SHA, the memory-guard arithmetic against real
  `/proc/meminfo`) but a live `--confirm` run against production was deliberately not triggered —
  consistent with "don't ship the backlog as a side effect of this task" and with leaving ADR-0026
  `Proposed` rather than self-accepted (see next point). This is the one piece of workstream 1 that
  still needs a real run to fully validate (rollback-on-failure in particular has only been reasoned
  about, not observed).
- **AGENTS.md vs. `docs/multi-agent-protocol.md` contradiction — flagged, not resolved.** AGENTS.md
  says an agent may deploy to production and mark an ADR `Accepted` without asking, and declares
  itself the single source of truth. `docs/multi-agent-protocol.md` lists both as things an agent
  does _not_ do. Given the direct instruction this session that a human decides what ships, ADR-0026
  was left `Proposed` and no real deploy was run — the more conservative reading, not a resolution
  of which document actually governs. **This needs the product owner's decision**, not another
  agent's guess.
- **Two-state (light/dark) toggle, not a three-state light/system/dark control.** "Respects
  `prefers-color-scheme` by default" is satisfied by _absence_ of the cookie; the toggle only needs
  to cover the explicit-override half of the requirement. A reset-to-system control was not asked
  for; add one (clear the cookie) if wanted.
- **One toggle instance per surface (app shell, marketing), not per-page.** The cookie is site-wide,
  so a single toggle click anywhere covers every page on the next navigation; auth pages don't need
  their own.

## Verification

```text
pnpm --filter @bizo/web lint                    # passed, 0 issues (after fixing a react-hooks/
                                                  #   set-state-in-effect violation in the first
                                                  #   theme-toggle.tsx draft)
pnpm --filter @bizo/web typecheck                # passed, 0 issues
pnpm --filter @bizo/web test                     # passed, 10 files / 55 tests
pnpm exec turbo run lint typecheck --force       # passed, 27/27 tasks, 0 cached (real run, not
                                                  #   trusted from cache, per AGENTS.md)
pnpm exec turbo run test --force                 # passed, 18/18 tasks, 0 cached (API: 977 passed,
                                                  #   73 skipped — integration tests gated on
                                                  #   RUN_DATABASE_TESTS/RUN_REDIS_TESTS, not set for
                                                  #   this ad hoc run, same as outside CI)
pnpm build --force                               # passed, 9/9 tasks, 0 cached, 18.7s
pnpm check                                       # passed end-to-end (format:check, docs:check,
                                                  #   repo:artifacts, security:local-services, lint,
                                                  #   typecheck, test, db:validate, build)
bash -n scripts/ops/deploy-production.sh          # syntax OK
./scripts/ops/deploy-production.sh (no args)      # refused correctly, exit 1
./scripts/ops/deploy-production.sh --sha abc --confirm            # refused (bad SHA format), exit 1
./scripts/ops/deploy-production.sh --sha 000...0 --confirm        # refused (not an ancestor of
                                                                    #   origin/main), exit 1, no
                                                                    #   mutation attempted
python3 ~/machine-monitor/test_monitor.py         # passed — well-formed output, both new checks
                                                    #   fired for real (found a genuine pre-existing
                                                    #   high-severity pnpm audit finding in
                                                    #   bizos-production's mysql2 transitive dep, and
                                                    #   8 real "error" lines from an earlier restart
                                                    #   race — not false positives, checked by hand)
```

Browser verification (dev server, `apps/web` alone on `WEB_PORT=3050`, via `.claude/launch.json`):

```text
No cookie, system prefers dark  -> SSR html has no data-theme, computed --background = #0f1420 (dark)
No cookie, system prefers light -> SSR html has no data-theme, computed --background = #fff (light)
Click toggle (dark -> light)    -> cookie set "theme=light", <html data-theme="light"> updated
                                    instantly client-side, --background flips to #fff
Reload after explicit choice    -> fetched the raw server response directly (before any client JS):
                                    <html data-theme="light"> already present -- zero flash, proven
                                    from the actual first byte, not inferred from a screenshot
Clear cookie, reload            -> falls back to system preference again (confirmed both directions:
                                    emulated colorScheme light and dark)
Dark-mode compat overrides      -> probed via injected elements bearing the real class names
(.sidebar, .avatar, .status-        (no live login available without the API running): .sidebar bg
draft, .side-nav a)                #1c2334 (was stuck white), nav-link text #9aa4bb on that bg (was
                                    #475467, near-invisible), .avatar and .status-draft both resolved
                                    to token-driven dark-safe colors
.mkt-maintenance-banner         -> background stayed pinned #0c1a1d in dark mode (not swapped light
                                    by the --mkt-ink role change), text unaffected
ThemeToggle mount points        -> present with correct aria-label in the accessibility tree on the
                                    home page nav (MarketingShell) and reachable from the app sidebar
                                    (AppShell) via source inspection
```

Screenshot capture itself failed repeatedly (`Screenshot timed out after 5s`) against the animated
marketing hero — not investigated further since the computed-style/SSR-HTML verification above is
more precise than eyeballing a screenshot for exact color values, but a plain visual look is still
worth doing before calling this pixel-perfect.

Production, before and after all of the above:

```text
curl -i https://bizos.qloudihub.com/    # 200, before and after -- untouched by this session
systemctl is-active bizos-api bizos-web cloudflared   # active, active, active
```

Memory watched throughout, build steps run serially, never in parallel:

```text
Before deploy-production.sh guard tests:  available 18Gi
Before pnpm build --force:                available 18Gi
Before turbo lint+typecheck --force:      available 17Gi
Before final pnpm check:                  available 17Gi
```

Never dropped near the 15%-available / 3G-swap thresholds the new memory guard itself uses; would
have aborted rather than proceed if it had.

## Follow-ups

- **`docs/operations/production-runbook.md` "Database restoration" section is stale** (describes
  managed Prisma Postgres backups; the box now runs local Docker Postgres). Needs its own
  investigation of the actual backup posture for `bizo-postgres-1` — not fixed here, flagged.
- **`deploy-production.sh` has not been run end-to-end against production.** Recommend a real
  `--sha <sha> --confirm` run (ideally against a deliberately small, low-risk commit first) before
  trusting it for a real release, specifically to observe the rollback path fire for real.
- **`bizos-production` is ~10 days behind `main`** (Sprint 7–8: CRM lifecycle, multi-warehouse
  stock, zero-budget AI, etc.) — unchanged by this session, surfaced per instruction, not shipped.
  Deploying it is now possible with `deploy-production.sh --sha <main-tip-sha> --confirm`, but
  that's the product owner's call, including reviewing what's in that backlog first.
- **AGENTS.md vs. `docs/multi-agent-protocol.md` contradiction on deploy/ADR-accept authority** —
  needs the product owner to say which document governs; ADR-0026 was deliberately left `Proposed`
  pending that.
- **Dark mode has not had a full pixel-level visual pass** (e.g. a real screenshot walkthrough of
  every marketing page and a logged-in app view) — verified via computed styles, SSR HTML, and
  targeted class-name probes instead, because live screenshots weren't rendering in this session's
  browser tooling. Worth a quick human look before calling it done.
- **No "reset to system" control on the theme toggle** — clearing the `theme` cookie by hand
  currently requires devtools. Add one if wanted; not requested this session.

## Handoff notes

- Claim `clm_c5458693` (scopes `scripts/ops`, `apps/web`, `docs`) held for this session — released
  at the end.
- To try a real deploy: `scripts/ops/deploy-production.sh --sha <40-hex-sha> --confirm`, run on the
  Ubuntu host from `/home/wasim/bizOS`. Read
  `docs/operations/production-runbook.md#deployment-procedure` first.
- To hand-verify dark mode in a browser: `.claude/launch.json`'s `bizos-dev` config runs `@bizo/web`
  alone on port 3050 (scratch — 3000/3001 are live production on this box, do not point a dev server
  at them).
- `~/machine-monitor/monitor.py` is being edited by more than one thing right now (this session and
  at least one other, concurrently, outside git version control) — re-read it before editing again
  rather than assuming it still matches what's described here.
