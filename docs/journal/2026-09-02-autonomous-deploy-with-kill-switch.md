# Autonomous deploy with kill switch

Date: 2026-09-02

Agent: claude-cli

Scope: scripts/ops, docs

Status: Complete

Related: [ADR-0026](../decisions/0026-local-gated-production-deploy-script.md) (superseded),
[ADR-0027](../decisions/0027-autonomous-gated-production-deploy.md),
[2026-09-02 production automation and dark mode](2026-09-02-production-automation-and-dark-mode.md)

## Context

Earlier the same day, `scripts/ops/deploy-production.sh` was built around a `--confirm` flag framed
as a human-approval step (ADR-0026): a person decides what ships, the script does the rest. The
product owner explicitly reversed that framing, in their own words: "I'm a solo individual human. I
don't have much knowledge or capabilities on the operations running. The validations and approval
gates are to be automated, with it's own with string tied and kill switch implemented." — with a
self-driving-car analogy: a human-approval gate is only a safety control if the human can
meaningfully evaluate what they're approving, and for a non-expert solo operator it's a rubber
stamp, not judgement.

This session reworks the deploy pipeline to be fully autonomous, with the safety that a human step
was informally providing re-encoded as explicit, independently-verifiable mechanisms instead —
without weakening anything: still gated, still reversible, still bounded, still stoppable, still
observable. Dark mode (previous session) was untouched — confirmed still on `main`, nothing to do
there.

## What changed

- `scripts/ops/deploy-production.sh` — added a kill-switch check
  (`/home/wasim/bizos-backups/DEPLOY_HALT`) at startup and again at the last safe checkpoint before
  touching the database or a live service, so flipping the switch mid-deploy stops the deploy at the
  next boundary rather than letting it finish. Added `--override-halt` for a deliberate manual
  deploy during a halt (never passed by the automated path). On a rollback that itself fails (exit
  2), the script now writes the halt file directly — the strongest response for the worst case, not
  left to a wrapper. Reframed `--confirm` in comments/docs from "human approval" to "accident guard"
  — same flag, different meaning now that the decision lives in the gates.
- `scripts/ops/autodeploy.sh` (new) — the orchestrator run by the timer. Checks (in order, cheapest
  first): kill switch, one-time activation, circuit breaker, a `flock` lock against overlapping
  ticks; then compares `bizos-production`'s HEAD to `origin/main`, does nothing if they match, skips
  (logged) if the gap exceeds `MAX_AUTO_COMMITS=5`, otherwise calls
  `deploy-production.sh --sha <origin/main tip> --confirm`. On failure, increments a fail-count file
  and trips the circuit breaker at `MAX_CONSECUTIVE_FAILURES=2`. On success, clears any prior
  circuit-trip.
- `scripts/ops/deploy-kill-switch.sh` (new) — the human-facing control surface:
  `on`/`off`/`status`/`reset-circuit`/`activate`. `activate` is the one-time gate that turns the
  timer from "always a no-op" into "actually deploys" — and itself refuses if production is still
  more than the cap behind `origin/main`, which is what stops the very first tick of this system
  from silently absorbing the current backlog.
- Host (`/home/wasim/.config/systemd/user/`, not in this repo, same layer as
  `machine-monitor.timer`): `bizos-autodeploy.timer` (every 15 min, `OnBootSec=5min`,
  `Persistent=true`) + `bizos-autodeploy.service` (oneshot, runs `autodeploy.sh`). Enabled and
  started — first real tick observed via `journalctl --user -u bizos-autodeploy.service`, correctly
  logging "not yet activated" and doing nothing.
- `~/machine-monitor/monitor.py` (host-local, not version-controlled) — added
  `check_autodeploy_state()`, read-only: surfaces an active halt, a tripped circuit breaker, and the
  last deploy-history.log entry in `status.md`, same surface as everything else this monitor already
  reports. Does not deploy, restart, or touch git — same boundary the rest of this file already
  documents. README updated.
- `docs/operations/production-runbook.md` — added a "🛑 KILL SWITCH" section as the very first thing
  in the document, before Architecture. Rewrote Deployment procedure to describe the autonomous
  pipeline (gates, cap, breaker, kill switch, one-time activation, manual/emergency path). Added a
  kill-switch-first step to Application outage response and an autodeploy-state bullet to the
  Monitoring checklist.
- `docs/decisions/0026-local-gated-production-deploy-script.md` — Status changed to "Superseded by
  ADR-0027", with a short note explaining what's superseded (the human-approval framing) versus
  what's still in use (the gate engine and `--confirm` mechanism itself).
- `docs/decisions/0027-autonomous-gated-production-deploy.md` (new ADR) — records the reversal, the
  reasoning, the four safety mechanisms mapped against what a human-approval step was informally
  covering, and what stays out of automation entirely (destructive DB ops, credential rotation,
  migration reversal, and — structurally, via the cap — shipping past the blast-radius limit). Left
  `Proposed`, not self-accepted, consistent with the still-unresolved AGENTS.md /
  multi-agent-protocol.md contradiction on agent ADR-accept authority (see ADR-0026's own note on
  that; this ADR doesn't resolve it, only notes the product owner's direct instruction settles the
  narrower question of deploy autonomy specifically).
- `AGENTS.md` — added a "Learned User Preferences" line recording the autonomy-over-approval
  instruction and its explicit boundary (irreversible/destructive/credential actions stay out of
  automation, not gated behind a person).
- Local Claude memory (`~/.claude/projects/-home-wasim-bizOS/memory/`) — new
  `autonomous-deploy-not-human-gated.md`, so a future session without this journal entry in context
  still knows the preference.

## Decisions and trade-offs

- **Kept `deploy-production.sh` as the single engine**, called by both the timer and a human,
  instead of writing a separate autonomous-path implementation. One gate, one rollback path, one set
  of tests, whether triggered by a person or a schedule.
- **The kill switch is a plain file, not a database row or a feature flag service.** Works even if
  everything else about this box is broken; `touch`/`rm` are the fallback if the friendly script is
  ever unreachable. Documented both, prominently.
- **Circuit breaker counts only automated failures, not manual ones.** A human retrying manually
  after diagnosing something shouldn't be blocked by the auto-breaker's counter, and a deliberate
  manual attempt is already a considered action, not a candidate for "stop this from looping."
- **Activation gate over trusting the blast-radius cap alone.** The cap (5) happens to be smaller
  than today's 11-commit gap, but relying on that coincidence would be fragile — a different gap
  size on a different day could slip through a purely numeric cap. The one-time `activate` step,
  which itself re-checks the cap, makes "the current gap needs a deliberate human decision"
  structural rather than accidental.
- **Extended `machine-monitor.py` for read-only visibility, not for triggering deploys.** That
  file's own documented boundary is "never touches git" — mixing deploy-triggering into it would
  break an invariant a different part of this box already depends on. Kept the systems separate;
  monitor.py only reads state files written by the deploy system.
- **Did not run a real automatic deploy in this session.** Activating requires closing the 11-commit
  gap first (a deliberate decision the product owner should make after actually looking at what's in
  it, per the runbook's own wording), which wasn't done here — see Follow-ups.

## Verification

```text
bash -n scripts/ops/deploy-production.sh          # syntax OK
bash -n scripts/ops/autodeploy.sh                  # syntax OK
bash -n scripts/ops/deploy-kill-switch.sh          # syntax OK
scripts/ops/deploy-kill-switch.sh status            # correct output on a clean state
scripts/ops/deploy-kill-switch.sh activate          # correctly REFUSED: "production is 11
                                                      #   commit(s) behind origin/main (cap is 5)"
scripts/ops/autodeploy.sh                           # correctly no-op: "not yet activated"
scripts/ops/deploy-kill-switch.sh on                # halt file written
scripts/ops/deploy-production.sh --sha <bad-sha>
  --confirm                                         # correctly refused at the halt check (exit 3),
                                                      #   before reaching the SHA-validity check
scripts/ops/autodeploy.sh                           # correctly no-op while halted
scripts/ops/deploy-production.sh --sha <bad-sha>
  --confirm --override-halt                         # correctly bypassed the halt, proceeded to
                                                      #   (and failed on) SHA validation as expected
scripts/ops/deploy-kill-switch.sh off               # halt file removed, confirmed via status
scripts/ops/deploy-kill-switch.sh reset-circuit     # cleared a manually-seeded circuit-trip file,
                                                      #   confirmed via status
systemctl --user enable --now
  bizos-autodeploy.timer                            # enabled, active; `list-timers` confirms
systemctl --user start bizos-autodeploy.service     # ran for real via systemd (not just my own
                                                      #   bash invocation); journalctl confirms the
                                                      #   correct "not yet activated" no-op
python3 ~/machine-monitor/test_monitor.py           # passed, well-formed output; new
                                                      #   check_autodeploy_state() produced zero
                                                      #   findings on the current clean state (no
                                                      #   halt, no trip, no deploy history yet) --
                                                      #   correct, not a false negative
pnpm graph                                           # regenerated, 29 decision records
pnpm docs:check                                      # passed (after fixing a markdown-link-inside-
                                                      #   Status-line issue that broke .agent/graph.md's
                                                      #   generated link -- moved the link out of the
                                                      #   Status line to match the existing
                                                      #   "Superseded by ADR-NNNN" convention used by
                                                      #   ADR-0019)
pnpm check                                           # passed end-to-end (format:check, docs:check,
                                                      #   repo:artifacts, security:local-services,
                                                      #   lint, typecheck, test, db:validate, build --
                                                      #   build fully cached, expected: no app code
                                                      #   changed this session, docs/scripts only)
pnpm agent:verify                                    # passed (graph fresh, journal valid, no stale
                                                      #   claims)
```

Not run: an actual automatic deploy (the circuit-breaker trip path and a real end-to-end auto-deploy
success were reasoned through and code-reviewed, not exercised against production — see Follow-ups).
Not run: deliberately killing the process mid-build to test the checkpoint (the checkpoint logic was
verified by code inspection and by confirming `check_halt` is reachable and correctly ordered
relative to the migrate/restart steps, not by an actual kill).

Production, before and after:

```text
curl -i https://bizos.qloudihub.com/                          # 200, unaffected
systemctl is-active bizos-api bizos-web cloudflared            # active, active, active
```

Memory watched, builds serial (only `pnpm build`/`pnpm check` touch real memory this session; no
production build/deploy was run):

```text
Before pnpm check: available 17Gi
```

## Follow-ups

- **Activation is still pending** — deliberately not done in this session. To go live:
  1. Look at what's actually in the 11-commit gap (Sprint 7–8: CRM lifecycle, multi-warehouse stock,
     zero-budget AI, etc.) before deciding to ship it.
  2. `scripts/ops/deploy-production.sh --sha $(git -C /home/wasim/bizos-production rev-parse origin/main) --confirm`
     — one deliberate manual catch-up.
  3. `scripts/ops/deploy-kill-switch.sh activate` — turns the timer on for real from that point.
- **The circuit-breaker trip path has not been observed for real.** Worth deliberately causing one
  failed auto-deploy at some point (e.g. a commit that fails `pnpm check` on purpose, reverted
  immediately after) to confirm the trip fires and blocks a second attempt, rather than trusting the
  code review alone indefinitely.
- **`docs/operations/production-runbook.md`'s "Database restoration" section is still stale**
  (managed Prisma Postgres backups; the box now runs local Docker Postgres) — flagged again, not
  fixed, same as the prior journal entry. Still needs its own investigation.
- **AGENTS.md vs. `docs/multi-agent-protocol.md` contradiction on agent deploy/ADR-accept
  authority** — unchanged, still flagged. This session's instruction settles deploy autonomy
  specifically; it doesn't resolve the general document-level question.

## Handoff notes

- Claim `clm_6c8216f3` (scopes `scripts/ops`, `docs`) held for this session — released at the end.
- **The kill switch**: `scripts/ops/deploy-kill-switch.sh on` (or
  `touch /home/wasim/bizos-backups/DEPLOY_HALT`). `status` shows everything at a glance.
- To bring the autonomous pipeline live: see Follow-ups above, in order — don't skip the "look at
  the gap" step.
- `~/machine-monitor/monitor.py` was touched by other concurrent sessions again during this work
  (same note as the prior journal entry) — re-read before editing rather than assuming it still
  matches this description.
