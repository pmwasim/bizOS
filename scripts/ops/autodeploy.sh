#!/usr/bin/env bash
# Autonomous production deploy loop. Run on a timer (bizos-autodeploy.timer,
# every 15 minutes) -- no human types anything for a routine deploy. Safety
# comes from four independent things, not from someone watching:
#
#   1. The quality gate: deploy-production.sh runs `pnpm check` as a hard
#      block, plus a post-deploy health/smoke verification with automatic
#      rollback to the last known-good commit on any failure.
#   2. A blast-radius cap (MAX_AUTO_COMMITS): won't auto-jump further than a
#      handful of commits in one deploy. A bigger gap needs a deliberate
#      manual `deploy-production.sh --sha ... --confirm`.
#   3. A circuit breaker: after MAX_CONSECUTIVE_FAILURES auto-deploy
#      failures in a row, stops retrying entirely until a human clears it
#      (scripts/ops/deploy-kill-switch.sh reset-circuit) or a manual deploy
#      succeeds. Prevents a flapping deploy from looping forever.
#   4. A one-time activation gate: does nothing at all until a human runs
#      `scripts/ops/deploy-kill-switch.sh activate` -- which itself refuses
#      to activate while production is more than the cap behind main. This
#      is what keeps the current ~10-day/11-commit gap between
#      bizos-production and main from being silently swallowed on the first
#      tick this ever runs: it can't activate until that gap is closed by a
#      deliberate manual deploy.
#
# THE KILL SWITCH: touch /home/wasim/bizos-backups/DEPLOY_HALT (or run
# scripts/ops/deploy-kill-switch.sh on) to stop this and every other
# automated deploy immediately. Checked first, every tick, unconditionally.
set -euo pipefail

PROD_DIR="/home/wasim/bizos-production"
DEV_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="/home/wasim/bizos-backups"
HALT_FILE="$STATE_DIR/DEPLOY_HALT"
CIRCUIT_FILE="$STATE_DIR/DEPLOY_CIRCUIT_TRIPPED"
ACTIVATED_FILE="$STATE_DIR/.autodeploy-activated"
FAIL_COUNT_FILE="$STATE_DIR/.autodeploy-fail-count"
LOCK_FILE="$STATE_DIR/autodeploy.lock"
DEPLOY_LOG="$STATE_DIR/deploy-history.log" # written by deploy-production.sh's record()

# ponytail: both numbers are starting heuristics for a solo operator's normal pace, not derived
# from anything. Raise MAX_AUTO_COMMITS once a real usage pattern justifies it; the failure count
# is deliberately small (2) because letting a broken pipeline retry more than twice unattended
# just repeats the same mistake against production.
MAX_AUTO_COMMITS=5
MAX_CONSECUTIVE_FAILURES=2

log() { echo "$(date -u +%FT%TZ) $*"; }

mkdir -p "$STATE_DIR"

if [[ -f "$HALT_FILE" ]]; then
  log "HALTED ($HALT_FILE present) -- doing nothing this tick."
  exit 0
fi
if [[ ! -f "$ACTIVATED_FILE" ]]; then
  log "not yet activated -- doing nothing this tick. Run scripts/ops/deploy-kill-switch.sh activate once production is caught up."
  exit 0
fi
if [[ -f "$CIRCUIT_FILE" ]]; then
  log "circuit breaker tripped -- doing nothing this tick. See $CIRCUIT_FILE / scripts/ops/deploy-kill-switch.sh status"
  exit 0
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deploy is already running (lock held) -- skipping this tick"
  exit 0
fi

if [[ ! -d "$PROD_DIR/.git" ]]; then
  log "ABORT: $PROD_DIR is not a git checkout"
  exit 1
fi
cd "$PROD_DIR"
git fetch origin --quiet
CHECKOUT_SHA="$(git rev-parse HEAD)"
TARGET_SHA="$(git rev-parse origin/main)"

# Trust the last *completed* deploy (success or a clean rollback -- both leave deploy-history.log's
# "to=" sha actually running), not raw checkout HEAD. A deploy that dies mid-flight before touching
# the log can otherwise leave the checkout ahead of what's actually built and running; comparing
# HEAD to origin/main in that state reads "nothing to do" forever and the drift never self-corrects.
# Falls back to HEAD when there's no history yet (first run on this host).
RUNNING_SHA="$(grep -E ' result=(success|rolled-back-from-)' "$DEPLOY_LOG" 2>/dev/null \
  | tail -1 | sed -n 's/.* to=\([0-9a-f]\{40\}\) .*/\1/p')"
RUNNING_SHA="${RUNNING_SHA:-$CHECKOUT_SHA}"

if [[ "$CHECKOUT_SHA" != "$RUNNING_SHA" ]]; then
  log "DRIFT: checkout ($CHECKOUT_SHA) doesn't match the last completed deploy ($RUNNING_SHA) -- a previous attempt likely died mid-flight. Repairing the checkout."
  git checkout --quiet "$RUNNING_SHA"
  CHECKOUT_SHA="$RUNNING_SHA"
fi

CURRENT_SHA="$CHECKOUT_SHA"
if [[ "$CURRENT_SHA" == "$TARGET_SHA" ]]; then
  exit 0 # nothing new -- this is what most ticks look like, deliberately quiet
fi

GAP="$(git rev-list --count "$CURRENT_SHA..$TARGET_SHA")"
if (( GAP > MAX_AUTO_COMMITS )); then
  log "SKIP: origin/main is $GAP commit(s) ahead (cap is $MAX_AUTO_COMMITS) -- too large to auto-deploy. Catch up by hand: scripts/ops/deploy-production.sh --sha $TARGET_SHA --confirm"
  exit 0
fi

log "auto-deploying $TARGET_SHA ($GAP commit(s) ahead of $CURRENT_SHA)"
cd "$DEV_REPO"
if scripts/ops/deploy-production.sh --sha "$TARGET_SHA" --confirm; then
  log "auto-deploy succeeded: $TARGET_SHA is live"
  rm -f "$CIRCUIT_FILE" # a success proves the pipeline works again
  echo 0 > "$FAIL_COUNT_FILE"
  exit 0
fi
DEPLOY_RC=$?

# deploy-production.sh already rolled back to CURRENT_SHA on ordinary failure, or wrote its own
# halt file directly if even the rollback failed (exit 2) -- that halt is already in place by the
# time we get here, so the circuit-breaker bookkeeping below is almost moot in that case, but it
# still records the failure count honestly.
FAILS=$(( $(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$FAILS" > "$FAIL_COUNT_FILE"
log "auto-deploy of $TARGET_SHA failed (exit $DEPLOY_RC, consecutive failures: $FAILS)"

if (( FAILS >= MAX_CONSECUTIVE_FAILURES )); then
  {
    echo "Tripped by autodeploy.sh at $(date -u +%FT%TZ)"
    echo "$FAILS consecutive auto-deploy failures. Most recent target: $TARGET_SHA"
    echo "Last known-good ($CURRENT_SHA) is what's live -- rollback already ran (unless it also"
    echo "failed, in which case DEPLOY_HALT explains that separately)."
    echo "Clear after fixing the underlying issue: scripts/ops/deploy-kill-switch.sh reset-circuit"
  } > "$CIRCUIT_FILE"
  log "CIRCUIT TRIPPED after $FAILS consecutive failures -- will not retry automatically until cleared."
fi
exit 1
