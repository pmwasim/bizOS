#!/usr/bin/env bash
# Promote a reviewed commit to bizOS production on this Ubuntu host.
#
# This is the engine, called both by a human (scripts/ops/autodeploy.sh runs
# it unattended on a timer, on origin/main movement) and directly for a
# manual/emergency deploy. --confirm is an accident guard (no bare invocation
# fires this by tab-completion + enter, a stray shell history repeat, etc.),
# not a permission step -- the decision to ship is made by the gates below,
# not by a person watching. See ADR-0027 for why, and
# scripts/ops/deploy-kill-switch.sh for how to stop all of this immediately.
#
# Usage:
#   deploy-production.sh --sha <40-hex-sha> --confirm
#   deploy-production.sh --rollback <40-hex-sha> --confirm
#   deploy-production.sh --sha <40-hex-sha> --confirm --override-halt   # break glass, see below
#
# Gate: pnpm check (lint/typecheck/test/build) must be green before anything
# production-facing is touched. Reversible: the previous commit is recorded
# before checkout and redeployed automatically if post-restart verification
# fails. Database migrations are additive-only by project convention (see
# docs/operations/production-runbook.md) and are never auto-reversed --
# rollback redeploys old code against the (compatible) new schema.
#
# KILL SWITCH: if /home/wasim/bizos-backups/DEPLOY_HALT exists, this script
# refuses to run at all -- checked here at the top, and again at each
# checkpoint below in case the switch is flipped while a deploy is already
# running, so a mid-flight deploy stops at the next safe boundary rather than
# barrelling through. A human can still push a deliberate manual deploy
# through a halt with --override-halt (the automated timer never passes this
# flag, so the halt is absolute for anything unattended).
set -euo pipefail

PROD_DIR="/home/wasim/bizos-production"
BACKUP_DIR="/home/wasim/bizos-backups/databases"
STATE_DIR="/home/wasim/bizos-backups"
DEPLOY_LOG="$STATE_DIR/deploy-history.log"
HALT_FILE="$STATE_DIR/DEPLOY_HALT"
DEV_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

MODE=""
TARGET_SHA=""
CONFIRM=""
OVERRIDE_HALT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha) MODE="deploy"; TARGET_SHA="${2:-}"; shift 2 ;;
    --rollback) MODE="rollback"; TARGET_SHA="${2:-}"; shift 2 ;;
    --confirm) CONFIRM="1"; shift ;;
    --override-halt) OVERRIDE_HALT="1"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MODE" || ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 (--sha <40-hex-sha> | --rollback <40-hex-sha>) --confirm [--override-halt]" >&2
  exit 1
fi
if [[ -z "$CONFIRM" ]]; then
  echo "Refusing to run without --confirm. This restarts production services." >&2
  exit 1
fi

log() { echo "==> $*"; }

check_halt() {
  if [[ -f "$HALT_FILE" && -z "$OVERRIDE_HALT" ]]; then
    echo "HALTED: $HALT_FILE exists -- refusing to deploy." >&2
    cat "$HALT_FILE" >&2 2>/dev/null || true
    echo "Clear it with: scripts/ops/deploy-kill-switch.sh off   (or pass --override-halt for a deliberate one-off manual deploy)" >&2
    exit 3
  fi
}
check_halt

# ---- memory guard: abort rather than risk an OOM on a shared box ----------
mem_guard() {
  local avail_kb total_kb avail_pct swap_total_kb swap_free_kb swap_used_gb
  eval "$(awk '
    /^MemAvailable:/ { print "avail_kb="$2 }
    /^MemTotal:/     { print "total_kb="$2 }
    /^SwapTotal:/    { print "swap_total_kb="$2 }
    /^SwapFree:/     { print "swap_free_kb="$2 }
  ' /proc/meminfo)"
  avail_pct=$(( avail_kb * 100 / total_kb ))
  swap_used_gb=$(( (swap_total_kb - swap_free_kb) / 1024 / 1024 ))
  log "memory: ${avail_pct}% available, ${swap_used_gb}G swap used"
  if (( avail_pct < 15 || swap_used_gb > 3 )); then
    echo "ABORT: memory pressure too high to build safely (${avail_pct}% available, ${swap_used_gb}G swap). Another session may be building. Retry later." >&2
    # `return`, not `exit`: this runs inside build_and_restart(), which is itself the left side of
    # an `if build_and_restart && verify ...; then` test. bash exempts errexit for the whole
    # evaluation of that condition, but `exit` ignores that exemption completely and kills the
    # process outright -- it doesn't matter that this is "just" a plain return-code failure, `exit`
    # unwinds nothing, it terminates the interpreter right here. That skipped the rollback branch at
    # the bottom of this script entirely (see docs/journal 2026-09-03 resume entry for the incident
    # this caused). `return 1` lets the caller's `mem_guard || return 1` propagate the failure
    # normally so the existing rollback-to-$PREV_SHA logic actually runs.
    return 1
  fi
}

# ---- pre-migration backup --------------------------------------------------
backup_db() {
  mkdir -p "$BACKUP_DIR"
  local dest="$BACKUP_DIR/bizo-$(date -u +%Y%m%dT%H%M%SZ)-pre-deploy.dump"
  local db_url
  db_url="$(grep -E '^DATABASE_URL=' "$PROD_DIR/.env" | cut -d= -f2-)"
  log "backing up production database to $dest"
  pg_dump "$db_url" -Fc -f "$dest"
  log "backup ok ($(du -h "$dest" | cut -f1))"
}

wait_for() {
  local url="$1" label="$2"
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null --max-time 5 "$url" && { log "$label is up"; return 0; }
    sleep 1
  done
  echo "$label did not come up in time" >&2
  return 1
}

build_and_restart() {
  cd "$PROD_DIR"
  set -a; . ./.env; set +a
  export NODE_ENV=production  # .env carries development-friendly defaults for local dayto-day use;
                               # this MUST be production for the build (see docs/operations/ubuntu-production-cutover.md)

  mem_guard || return 1
  log "installing dependencies"
  pnpm install --frozen-lockfile

  if [[ "$MODE" == "deploy" ]]; then
    log "running quality gate (pnpm check) -- hard gate, never deploy on red"
    pnpm check
  fi

  mem_guard || return 1
  log "building web (production)"
  pnpm --filter @bizo/web build
  mem_guard || return 1
  log "building api (production)"
  pnpm --filter @bizo/api build

  if [[ "$MODE" == "deploy" ]]; then
    check_halt  # last safe exit before touching the database or live services
    log "applying database migrations"
    pnpm --filter @bizo/database exec prisma migrate deploy
    pnpm --filter @bizo/database exec prisma migrate status
  fi

  # Past this point the migration (if any) may already be applied, so finishing the restart and
  # verifying (with rollback on failure, as normal) leaves a known-consistent state; aborting here
  # would leave old code running against a schema it wasn't necessarily tested against. A halt
  # flipped from this point on is honoured on the *next* invocation, not this one.
  log "restarting bizos-api"
  sudo systemctl restart bizos-api
  wait_for "http://127.0.0.1:3001/api/v1/health" "api"

  log "restarting bizos-web"
  sudo systemctl restart bizos-web
  wait_for "http://127.0.0.1:3000/" "web"
}

verify() {
  cd "$DEV_REPO"
  RELEASE_WEB_BASE="https://bizos.qloudihub.com" \
  RELEASE_API_BASE="http://127.0.0.1:3001" \
  RELEASE_EXPECT_SHA="$1" \
    pnpm ops:release-readiness
}

record() {
  mkdir -p "$(dirname "$DEPLOY_LOG")"
  echo "$(date -u +%FT%TZ) mode=$MODE from=$PREV_SHA to=$TARGET_SHA result=$1" >> "$DEPLOY_LOG"
}

# ---- belt-and-suspenders: catch ANY unexpected exit, not just the ones we anticipated -----
# The mem_guard bug above (exit instead of return) is fixed, but this trap is what makes the
# guarantee ("an aborted deploy always restores the previous checkout") hold even against a future
# stray `exit`, a killed process, or a signal -- not just the one failure mode we found this time.
# DEPLOY_COMPLETED is set once we reach a state the rest of the pipeline already understands
# (shipped, cleanly rolled back, or rollback-failed-with-its-own-halt-file); anything else means we
# died mid-flight with the checkout possibly ahead of what's actually built and running.
DEPLOY_COMPLETED=""
CHECKOUT_MOVED=""
cleanup_on_unexpected_exit() {
  local exit_code=$?
  trap - EXIT
  # Gated on CHECKOUT_MOVED, not just PREV_SHA being set: an ordinary pre-flight abort (uncommitted
  # changes, $TARGET_SHA not on origin/main, halt file) also runs after PREV_SHA is known but never
  # touched the working tree -- that's a clean exit, not a mid-deploy death, and must not halt future
  # automated deploys over nothing.
  if [[ -z "$DEPLOY_COMPLETED" && -n "$CHECKOUT_MOVED" && -n "${PREV_SHA:-}" ]]; then
    echo "!! deploy-production.sh exiting unexpectedly (code $exit_code) before reaching a known-good end state -- forcing the checkout back to $PREV_SHA so it can't be mistaken for a real deploy" >&2
    git -C "$PROD_DIR" checkout --quiet "$PREV_SHA" 2>/dev/null || echo "!! could not even force the checkout back -- production may be in a split state, needs a human" >&2
    {
      echo "Auto-halted by deploy-production.sh's cleanup trap at $(date -u +%FT%TZ): unexpected exit (code $exit_code) mid-deploy."
      echo "Checkout forced back to $PREV_SHA. bizos-api/bizos-web were NOT rebuilt or restarted by this trap -- verify they already match $PREV_SHA before clearing this halt."
    } > "$HALT_FILE"
  fi
  exit "$exit_code"
}
trap cleanup_on_unexpected_exit EXIT

# ---------------------------------------------------------------------------
cd "$PROD_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ABORT: $PROD_DIR has uncommitted changes -- refusing to check out over them." >&2
  exit 1
fi
git fetch origin
PREV_SHA="$(git rev-parse HEAD)"

if [[ "$MODE" == "deploy" ]]; then
  if ! git merge-base --is-ancestor "$TARGET_SHA" origin/main; then
    echo "ABORT: $TARGET_SHA is not on origin/main -- only ship reviewed, merged commits." >&2
    exit 1
  fi
  backup_db
fi

log "checking out $TARGET_SHA (was $PREV_SHA)"
git checkout --quiet "$TARGET_SHA"
CHECKOUT_MOVED=1

if build_and_restart && verify "$TARGET_SHA"; then
  log "deploy verified: $TARGET_SHA is live"
  DEPLOY_COMPLETED=1
  record "success"
  exit 0
fi

echo "!! verification failed after deploying $TARGET_SHA -- rolling back to $PREV_SHA" >&2
MODE="rollback"
TARGET_SHA_FAILED="$TARGET_SHA"
TARGET_SHA="$PREV_SHA"
git checkout --quiet "$PREV_SHA"
if build_and_restart && verify "$PREV_SHA"; then
  echo "Rolled back to $PREV_SHA successfully. $TARGET_SHA_FAILED did NOT ship -- needs investigation." >&2
  DEPLOY_COMPLETED=1
  record "rolled-back-from-$TARGET_SHA_FAILED"
  exit 1
else
  echo "!! ROLLBACK ALSO FAILED. Production may be down. Needs a human immediately." >&2
  echo "!! Manual recovery: cd $PROD_DIR && git checkout $PREV_SHA && rerun this script, or see docs/operations/production-runbook.md" >&2
  {
    echo "Auto-halted by deploy-production.sh at $(date -u +%FT%TZ): rollback failed."
    echo "Attempted deploy: $TARGET_SHA_FAILED -> rollback target: $PREV_SHA (rollback itself failed)."
    echo "Production may be down. Diagnose by hand, then: scripts/ops/deploy-kill-switch.sh off"
  } > "$HALT_FILE"
  DEPLOY_COMPLETED=1 # the halt file above already documents this end state -- don't let the trap overwrite it
  record "ROLLBACK-FAILED"
  exit 2
fi
