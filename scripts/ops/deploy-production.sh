#!/usr/bin/env bash
# Promote a reviewed commit to bizOS production on this Ubuntu host.
#
# Human-triggered only: requires --confirm, mirrors the convention already
# used by ~/bizos-maintenance/resume.sh, so this can never fire by accident
# (tab-completion + enter, a stray cron entry, sourcing it). There is no
# systemd timer for this script and none should be added -- see AGENTS.md /
# the production runbook for why a human decides what ships.
#
# Usage:
#   deploy-production.sh --sha <40-hex-sha> --confirm
#   deploy-production.sh --rollback <40-hex-sha> --confirm
#
# Gate: pnpm check (lint/typecheck/test/build) must be green before anything
# production-facing is touched. Reversible: the previous commit is recorded
# before checkout and redeployed automatically if post-restart verification
# fails. Database migrations are additive-only by project convention (see
# docs/operations/production-runbook.md) and are never auto-reversed --
# rollback redeploys old code against the (compatible) new schema.
set -euo pipefail

PROD_DIR="/home/wasim/bizos-production"
BACKUP_DIR="/home/wasim/bizos-backups/databases"
DEPLOY_LOG="/home/wasim/bizos-backups/deploy-history.log"
DEV_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

MODE=""
TARGET_SHA=""
CONFIRM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha) MODE="deploy"; TARGET_SHA="${2:-}"; shift 2 ;;
    --rollback) MODE="rollback"; TARGET_SHA="${2:-}"; shift 2 ;;
    --confirm) CONFIRM="1"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MODE" || ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 (--sha <40-hex-sha> | --rollback <40-hex-sha>) --confirm" >&2
  exit 1
fi
if [[ -z "$CONFIRM" ]]; then
  echo "Refusing to run without --confirm. This restarts production services." >&2
  exit 1
fi

log() { echo "==> $*"; }

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
    exit 1
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

  mem_guard
  log "installing dependencies"
  pnpm install --frozen-lockfile

  if [[ "$MODE" == "deploy" ]]; then
    log "running quality gate (pnpm check) -- hard gate, never deploy on red"
    pnpm check
  fi

  mem_guard
  log "building web (production)"
  pnpm --filter @bizo/web build
  mem_guard
  log "building api (production)"
  pnpm --filter @bizo/api build

  if [[ "$MODE" == "deploy" ]]; then
    log "applying database migrations"
    pnpm --filter @bizo/database exec prisma migrate deploy
    pnpm --filter @bizo/database exec prisma migrate status
  fi

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

if build_and_restart && verify "$TARGET_SHA"; then
  log "deploy verified: $TARGET_SHA is live"
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
  record "rolled-back-from-$TARGET_SHA_FAILED"
  exit 1
else
  echo "!! ROLLBACK ALSO FAILED. Production may be down. Needs a human immediately." >&2
  echo "!! Manual recovery: cd $PROD_DIR && git checkout $PREV_SHA && rerun this script, or see docs/operations/production-runbook.md" >&2
  record "ROLLBACK-FAILED"
  exit 2
fi
