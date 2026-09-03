# Fix autodeploy rollback bug: mem_guard exit skips rollback, checkout can drift silently

Date: 2026-09-03

Agent: claude-code-autodeploy-fix

Scope: scripts/ops/deploy-production.sh, scripts/ops/autodeploy.sh

Status: Done

Related: 2026-09-03-resume-from-maintenance-window-disable-banner-verify-service.md (in the
`bizos-production` checkout's own journal, not this repo's — that session first diagnosed this bug
in its Follow-ups and named the exact fix; this entry implements, tests, and lands it)

## Context

At 06:06 UTC today, an autodeploy tick advanced `bizos-production`'s git checkout to `5ea9507`
(matching `origin/main`), took its pre-deploy DB backup, then `mem_guard()` tripped on swap pressure
(40% available, 8G swap, over the 3G cap) and called `exit 1`. Because `mem_guard` is called from
inside `build_and_restart()`, which is itself the left side of
`if build_and_restart && verify ...; then`, bash exempts errexit for the whole evaluation of that
condition — but `exit` ignores that exemption entirely and kills the interpreter on the spot. The
rollback-to-`$PREV_SHA` branch at the bottom of `deploy-production.sh` never ran. Net effect:
`bizos-api`/`bizos-web` kept serving the `7c2c3cc` build while the git checkout sat one commit ahead
at `5ea9507`, and `autodeploy.sh`'s "is there anything to do" check (`git rev-parse HEAD` vs
`origin/main`) started reading "nothing new" forever, since the checkout already matched
`origin/main` even though nothing had actually redeployed.

Note on where this landed: `bizos-production` (the live deploy checkout, always in detached HEAD at
a specific shipped commit) is **not** the dev repo the pipeline actually runs from — the systemd
timer's `WorkingDirectory`/`ExecStart` point at this repo (`/home/wasim/bizOS`, branch-based,
PR-only main). An earlier pass of this same session mistakenly committed the fix inside
`bizos-production` itself before catching that; that commit was reverted there (never pushed, purely
local, detached HEAD) and redone here, in a dedicated worktree off `origin/main`, to avoid colliding
with another agent's uncommitted work already in this repo's primary checkout.

## What changed

`scripts/ops/deploy-production.sh`:

- `mem_guard()`: `exit 1` → `return 1` on trip, with a comment explaining why `exit` was wrong here
  (it bypasses the if-condition errexit exemption instead of honoring it, unlike every other failure
  path in this script).
- The three `mem_guard` call sites inside `build_and_restart()` are now `mem_guard || return 1`, so
  a trip actually fails the function (and thus the outer `if build_and_restart && verify ...`) the
  normal way, taking the existing rollback-to-`$PREV_SHA` branch.
- Added a `trap ... EXIT` (`cleanup_on_unexpected_exit`) as a second, independent line of defense:
  if the script ever exits before reaching one of its three known-good end states (shipped, cleanly
  rolled back, or rollback-failed-with-its-own-halt-file — each now sets `DEPLOY_COMPLETED=1`)
  _after_ the checkout has actually moved (`CHECKOUT_MOVED=1`, set right after the
  `git checkout --quiet "$TARGET_SHA"` line, so ordinary pre-flight aborts like "uncommitted
  changes" or "not on origin/main" don't false-positive), it forces the checkout back to `$PREV_SHA`
  and writes `DEPLOY_HALT` explaining that the trap caught an unexpected death and the services were
  NOT rebuilt/restarted by the trap itself. This is what still saves us if some other future code
  path reintroduces a bare `exit` — not just this specific mem_guard bug.

`scripts/ops/autodeploy.sh`:

- The "is there anything to do" check no longer trusts raw `git rev-parse HEAD`. It now reads the
  `to=` sha from the last `deploy-history.log` line with `result=success` or
  `result=rolled-back-from-*` (both mean that sha is what's actually running) and treats _that_ as
  the real current-state baseline, falling back to HEAD only when there's no history yet. If the
  checkout doesn't match that sha, it logs a `DRIFT:` line and repairs the checkout before deciding
  whether `origin/main` is actually ahead. This is what makes the "silently stuck forever" failure
  mode self-correct instead of requiring a human to notice.

## Decisions and trade-offs

- Fixed the specific bug (`return` not `exit`) **and** added the trap, rather than just one or the
  other. The owner's ask (relayed via chat, not in this repo) explicitly named both options ("a
  trap-based cleanup or restructuring the guard"); they solve different halves of the problem — the
  `return` fix is the actual root cause and the correct fix for _this_ bug, the trap is what keeps
  the guarantee ("an aborted deploy restores the previous checkout") true against bugs nobody's
  found yet. Not overbuilt: the trap is ~15 lines reusing state the script already tracks
  (`PREV_SHA`), not a new subsystem.
- Drift detection reuses `deploy-history.log`, which `deploy-production.sh` already writes on every
  attempt, instead of inventing a new state file. One less thing to keep in sync.
- Did not add a rollback-database-migration step, and did not touch anything about the DB backup or
  Prisma migration flow — out of scope for this bug, which is purely about checkout/service drift
  around a failed _pre-migration_ abort (mem_guard runs before `pnpm check` and well before
  migrations).
- No ADR: this is a bugfix within the design ADR-0027 already accepted (autonomous gated production
  deploy) — it makes the existing gates behave as that ADR already describes, not a new
  architectural decision.
- Landed on a dedicated branch (`fix/autodeploy-mem-guard-rollback`) off `origin/main` via a
  worktree, rather than on top of the existing `cursor/autodeploy-activated-catchup` draft PR or in
  the primary checkout — the primary checkout has another agent's uncommitted work in flight
  (delivery-notes/inventory/sales-orders, per the "Implement core apps-api backend logic" journal
  entry) that must not be touched or forced through a branch switch, and this bugfix is unrelated in
  content to the catchup/activation PR.

## Verification

No application code changed (bash only), so `pnpm lint`/`typecheck`/`test` are not applicable to
this diff; `pnpm check` was not run for that reason (not "skipped", genuinely nothing for it to
check here).

`bash -n` on both scripts: passed.

Built a fully isolated sandbox (scratch git remote + checkout standing in for `bizos-production`,
shim `pnpm`/`sudo`/`curl`/`pg_dump` executables on `PATH`, a controllable one-shot
`.test-trip-mem-guard` marker patched only into scratch copies of the scripts, never into any real
file) and ran five scenarios against it — no real deploy, checkout, or service on the host was
touched at any point:

```text
Scenario B (original/unfixed deploy-production.sh, forced mem_guard trip):
  reproduces the actual incident exactly -- process dies immediately inside build_and_restart,
  HEAD left at TARGET_SHA, no deploy-history.log entry, no DEPLOY_HALT. Confirms the root cause.

Scenario A (fixed deploy-production.sh, same forced trip):
  mem_guard returns 1 -> build_and_restart returns 1 -> outer if/else takes the rollback branch ->
  checks out PREV_SHA, rebuilds (shimmed), restarts (shimmed), verifies (shimmed), records
  "rolled-back-from-<target>". Final HEAD == PREV_SHA. No DEPLOY_HALT (clean rollback). PASSED.

Scenario C (fixed script but with the mem_guard test-hook itself reverted to `exit 1`, simulating
a hypothetical future regression that reintroduces a bare exit elsewhere):
  the cleanup trap fires, forces checkout back to PREV_SHA, writes DEPLOY_HALT explaining a human
  needs to verify services match PREV_SHA. Confirms the trap is a real, working second line of
  defense, not just documentation. PASSED.

Scenario D (fixed script, no trip -- happy path):
  deploy proceeds and succeeds normally, HEAD == TARGET_SHA, no DEPLOY_HALT, no trap false-positive.
  PASSED.

Scenario E (fixed script, pre-flight abort via uncommitted changes in the sandbox checkout):
  script exits 1 before ever touching the checkout; CHECKOUT_MOVED was never set, so the trap
  correctly does nothing -- no DEPLOY_HALT written for an ordinary pre-flight refusal. PASSED
  (confirms no false-positive halting).

autodeploy.sh drift check: reproduced the "silently stuck" state (checkout stuck at TARGET_SHA,
origin/main == TARGET_SHA too -- nothing to fetch -- but deploy-history.log's last completed entry
says PREV_SHA is what's actually running). Fixed autodeploy.sh logged
"DRIFT: checkout (...) doesn't match the last completed deploy (...)", repaired the checkout back
to PREV_SHA, and then correctly proceeded to treat origin/main as 1 commit ahead and attempt a
redeploy -- unlike the old HEAD-vs-origin/main check, which would have compared TARGET_SHA to
TARGET_SHA and stayed silent forever. PASSED.
```

## Follow-ups

- **Real production is still one commit behind its checkout** (`bizos-production` HEAD is `5ea9507`
  from the 06:06 UTC incident; running build is `7c2c3cc`). This fix does not itself correct that —
  per the owner's standing instruction, no real deploy or pipeline trigger happened this session,
  and this branch was not merged to `main` (nor was `bizos-production` touched again after the
  revert described above) so the real timer keeps running the old scripts until this is reviewed and
  merged. Once merged and memory pressure is confirmed clear, either let the timer's next tick pick
  it up (it now will, thanks to the drift fix above) or run a deliberate manual
  `deploy-production.sh --sha 5ea9507144e953650ca225932755a28205bdaeab --confirm`.
- `.autodeploy-fail-count` is still `1` from the incident (of `MAX_CONSECUTIVE_FAILURES=2`). Not
  touched by this session.
- Consider extending `verify()`'s release-readiness check to assert the API's `gitSha` (already
  exposed by `/api/v1/health`, see `apps/api/src/health/health.controller.ts`) matches
  `RELEASE_EXPECT_SHA` for every deploy, not only when explicitly wired up — would give an
  independent, running-process confirmation on top of the git-history-based drift check added here.
  Not done now: out of scope for this bug and would need checking how `release-readiness.mjs`
  currently uses `RELEASE_EXPECT_SHA` in more detail first.
- This PR is unreviewed and unmerged as of this entry — flagged to the owner in the session's final
  report rather than merged autonomously, given it touches the production deploy safety path while
  the owner is away and the only verification was a sandbox, not a live run.

## Handoff notes

- `mem_guard`'s `exit`-vs-`return` distinction is the sharp edge here: inside a function called as
  part of an `if`/`&&` condition, bash exempts errexit for ordinary command failures, but `exit` is
  not a "command failure" in that sense — it always terminates the interpreter outright, regardless
  of calling context. Any new abort path added inside `build_and_restart()` (or any function called
  the same way) must use `return`, not `exit`, or it will silently reproduce this exact bug. The new
  `cleanup_on_unexpected_exit` trap is a backstop for that, not a substitute for getting it right.
- Claim `clm_df9ae07e` (scopes `scripts/ops/deploy-production.sh`, `scripts/ops/autodeploy.sh`) was
  taken in the repo's primary checkout before this worktree existed; release it there
  (`pnpm agent:release -- --agent claude-code-autodeploy-fix`) once this lands, since claims are
  tracked in `.agent/registry.json` in the primary checkout, not per-worktree.
- Work happened in a separate worktree
  (`git worktree add ... fix/autodeploy-mem-guard-rollback origin/main`) specifically to avoid
  disturbing another agent's uncommitted work in the primary checkout
  (delivery-notes/inventory/sales-orders changes, per the "Implement core apps-api backend logic"
  journal entry) — remove the worktree once this branch is merged or abandoned
  (`git worktree remove` from the primary checkout).
