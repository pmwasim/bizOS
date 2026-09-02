# Resume bizOS from maintenance and add homepage maintenance banner

Date: 2026-09-02

Agent: claude-cli

Scope: apps/web, docs

Status: Complete

Related:
[2026-08-30 maintenance-parking journal](2026-08-30-resolve-outstanding-open-items-branch-triage-main-sync-hosti.md),
`/home/wasim/bizos-maintenance/RESUME.md`

## Context

`bizos.qloudihub.com` was serving a static 503 "offline for maintenance" page from
`bizos-maintenance.service` on port 3000 (parked 2026-08-30, see the linked journal and
`RESUME.md`), with `bizos-api`/`bizos-web` stopped and disabled. The user asked for this reversed:
bring the real app back live, and add a non-blocking maintenance notice to its home page instead of
a standalone blocking page.

## What changed

- `apps/web/src/components/maintenance-banner.tsx` (new) — `MaintenanceBanner` server component.
  Renders a fixed notice, hidden only when `MAINTENANCE_BANNER=false` is set in the environment
  (read at request time — a service restart is enough to toggle it, no rebuild).
- `apps/web/src/app/page.tsx` — renders `<MaintenanceBanner />` above `<LandingPage />`, home page
  only, per the request.
- `apps/web/src/app/globals.css` — `.mkt-maintenance-banner` rule, built entirely from the marketing
  site's existing tokens (`--mkt-ink`, `--mkt-signal`, `--mkt-line`); no new palette introduced.
- Committed to `main` as `59d2f8b`, pushed.
- `/home/wasim/bizos-production` (separate deploy checkout, currently well behind `main` — see
  Decisions below): `git cherry-pick 59d2f8b` → `2aa44b4` (clean, no conflicts), then
  `NODE_ENV=production pnpm --filter @bizo/web build` (no `pnpm install` needed — the commit touches
  no dependencies).
- Ran `/home/wasim/bizos-maintenance/resume.sh --confirm`: enabled+started `bizos-api` and
  `bizos-web`, waited for `:3000` to answer, then disabled+stopped `bizos-maintenance` (unit file,
  `serve_maintenance.py`, and `maintenance.html` left in place for a quick re-park), restored
  `~/machine-monitor/monitor.py` from `monitor.py.pre-maintenance-bak`.
- `~/machine-monitor/monitor.py` — on top of that restore, added `bizos-api.service` and
  `bizos-web.service` back to `MANAGED_SERVICES` (auto-restart if enabled-but-down) and replaced the
  stale "deliberately stopped for maintenance" comment; `cloudflared` deliberately left out of
  auto-restart (restarting the tunnel mid-incident would drop the connectivity needed to see the
  incident).
- `~/machine-monitor/README.md` — updated the "what it checks" bullet to match: `bizos-api`/`web`
  watched normally again, `bizos-maintenance` noted as disabled-but-kept for a quick re-park.

## Decisions and trade-offs

- **Did not fast-forward `bizos-production` to `main` tip.** Production was frozen at `369b282`
  (2026-08-23) while `main` moved through roughly ten more days of unreleased work (Sprints 7–8: CRM
  lifecycle, multi-warehouse stock, zero-budget AI, etc.) that this task never asked to ship.
  Bulk-deploying all of that now would be a large, unrelated Tier 2 change with its own migration
  and risk surface. Instead: cherry-picked just the banner commit onto production's existing HEAD,
  kept the blast radius to exactly what was requested. **Flagging for a decision**:
  `bizos-production` is ~10 days behind `main` and someone should decide when to do a real deploy of
  that backlog — that's a separate, larger piece of work, not something I started here.
- **`MAINTENANCE_BANNER` toggle is a plain env var, not a DB/config-service flag.** Read at request
  time in a server component, so flipping it is a one-line `.env` edit +
  `sudo systemctl restart bizos-web` — no rebuild, no new config layer for a value that (per the
  request) just needs to be off-able without a code change. Cheap enough to not hardcode.
- **No dedicated unit test for `MaintenanceBanner`.** Its only logic is one `=== "false"` check; the
  `apps/web` workspace has zero existing component/render tests and no `@testing-library/*`
  dependency, so adding one now would mean introducing test infra for a workspace that doesn't have
  it, for a trivial branch. Covered instead by `tsc --noEmit`, `eslint`, and the public verification
  below.
- **Kept the maintenance page's files/unit in place** (`serve_maintenance.py`, `maintenance.html`,
  `bizos-maintenance.service`) — disabled and stopped only, per the request, so a re-park is a
  single `systemctl` command away.

## Verification

```text
pnpm --filter @bizo/web lint        # passed, 0 issues
pnpm --filter @bizo/web typecheck   # passed, 0 issues
pnpm --filter @bizo/web test        # passed, 10 files / 55 tests
prettier --check <changed files>    # passed
pnpm --filter @bizo/web build       # passed (dev repo, validation build)
```

Memory (build is the heaviest thing to run since the 07:39 memory-pressure incident this box hit
today, so watched closely and built serially — never in parallel):

```text
Before any build:                total 30Gi, available 20Gi
During dev-repo web build:       available stayed ~19-20Gi throughout
Before production web build:     available 20Gi
During production web build:     available stayed ~19.6-20.6Gi throughout (polled every 5s)
After both builds:                available 20Gi
```

No swap used at any point (`Swap: 23Gi total, 11Mi used` — unchanged before/after). Would have
aborted either build if available memory had approached the 28/30Gi pressure point from earlier
today; it never got close.

Service state:

```text
systemctl is-enabled/is-active bizos-api bizos-web cloudflared bizos-maintenance
  → bizos-api: enabled/active · bizos-web: enabled/active · cloudflared: enabled/active
  → bizos-maintenance: disabled/inactive (files kept)
```

Public verification (external, not localhost):

```text
curl -i https://bizos.qloudihub.com/         → 200, <title>bizOS — The Business Operating System
                                                for service companies</title>, contains
                                                "Run the business in plain language" (the real
                                                landing page) AND "bizOS is currently undergoing
                                                maintenance.</strong> Some features may be
                                                unavailable." (the banner)
curl -i https://bizos.qloudihub.com/product  → 200
```

`python3 ~/machine-monitor/monitor.py` dry-run after the change: `Overall: WARN`, but the only
findings are two pre-existing unrelated failed units (`ai-health-check.service`,
`snap.openshell.gateway.service`) — nothing new, and `bizos-api`/`bizos-web` produced no findings
(both active).

## Follow-ups

- `bizos-production` is ~10 days behind `main` (`2aa44b4` on top of `369b282`, vs. `main` at
  `59d2f8b`). A real deploy of that backlog is a separate decision — flagged for the user, not
  started here.
- `ai-health-check.service` and `snap.openshell.gateway.service` are pre-existing failed units,
  unrelated to this task — left alone, noted for whoever owns them.

## Handoff notes

- To hide the banner without a rebuild: set `MAINTENANCE_BANNER=false` in
  `/home/wasim/bizos-production/.env` and `sudo systemctl restart bizos-web`. To remove it for good,
  delete the `<MaintenanceBanner />` line in `apps/web/src/app/page.tsx` (and the now-unused
  component/CSS rule) in a follow-up change.
- To re-park behind the maintenance page again:
  `sudo systemctl stop bizos-api bizos-web && sudo systemctl enable --now bizos-maintenance.service`
  — all three units and the maintenance page's files are still present.
- Claim `clm_b2d002e6` (scopes `apps/web`, `docs`) released at the end of this session.
