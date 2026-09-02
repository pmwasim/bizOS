#!/usr/bin/env bash
# THE KILL SWITCH for automated production deploys, plus the couple of other
# controls the autonomous pipeline needs. One command, no ambiguity:
#
#   scripts/ops/deploy-kill-switch.sh on              # stop ALL automated deploys, right now
#   scripts/ops/deploy-kill-switch.sh off              # allow them again
#   scripts/ops/deploy-kill-switch.sh status           # what's the current state, in plain terms
#   scripts/ops/deploy-kill-switch.sh reset-circuit     # clear a tripped failure breaker
#   scripts/ops/deploy-kill-switch.sh activate          # one-time: turn on the autonomous timer
#
# `on` works even if a deploy is already running -- deploy-production.sh
# checks for the halt file at startup and again at its last safe checkpoint
# before touching the database or restarting services, so a mid-flight
# deploy stops rather than finishing. Production is left exactly as it is;
# nothing is torn down by hitting the switch.
#
# These are just files. If this script is ever unavailable for some reason,
# the raw equivalent always works:
#   touch /home/wasim/bizos-backups/DEPLOY_HALT   # same as `on`
#   rm -f /home/wasim/bizos-backups/DEPLOY_HALT    # same as `off`
set -euo pipefail

STATE_DIR="/home/wasim/bizos-backups"
HALT_FILE="$STATE_DIR/DEPLOY_HALT"
CIRCUIT_FILE="$STATE_DIR/DEPLOY_CIRCUIT_TRIPPED"
ACTIVATED_FILE="$STATE_DIR/.autodeploy-activated"
FAIL_COUNT_FILE="$STATE_DIR/.autodeploy-fail-count"
PROD_DIR="/home/wasim/bizos-production"
MAX_AUTO_COMMITS=5 # must match scripts/ops/autodeploy.sh

mkdir -p "$STATE_DIR"

case "${1:-status}" in
  on)
    { echo "Halted by $(whoami) at $(date -u +%FT%TZ)"; } > "$HALT_FILE"
    echo "Kill switch ON. No automated deploy will start; a mid-flight one will stop at its next checkpoint."
    echo "Production is untouched. Turn back on with: $0 off"
    ;;
  off)
    rm -f "$HALT_FILE"
    echo "Kill switch OFF. Automated deploys can run again on the next scheduled check."
    ;;
  reset-circuit)
    rm -f "$CIRCUIT_FILE"
    echo 0 > "$FAIL_COUNT_FILE"
    echo "Circuit breaker cleared. Auto-deploy will try again on the next scheduled check."
    echo "(If you didn't fix the underlying failure yet, it'll likely trip again after $MAX_AUTO_COMMITS... see status for the last failure.)"
    ;;
  activate)
    if [[ ! -d "$PROD_DIR/.git" ]]; then
      echo "Can't find $PROD_DIR -- is this the right host?" >&2
      exit 1
    fi
    cd "$PROD_DIR"
    git fetch origin --quiet
    gap="$(git rev-list --count HEAD..origin/main)"
    if (( gap > MAX_AUTO_COMMITS )); then
      echo "Not activating: production is $gap commit(s) behind origin/main (cap is $MAX_AUTO_COMMITS)." >&2
      echo "That gap needs a deliberate manual catch-up first, so autonomy doesn't start by silently" >&2
      echo "shipping a backlog nobody chose to release in one go:" >&2
      echo "  scripts/ops/deploy-production.sh --sha \$(git -C $PROD_DIR rev-parse origin/main) --confirm" >&2
      echo "Then run '$0 activate' again." >&2
      exit 1
    fi
    touch "$ACTIVATED_FILE"
    echo "Autonomous deploy activated. Production is $gap commit(s) behind origin/main (within the" \
      "$MAX_AUTO_COMMITS-commit cap) -- the next scheduled check will deploy automatically if so."
    ;;
  status)
    if [[ -f "$HALT_FILE" ]]; then
      echo "Kill switch: ON (halted) -- $(cat "$HALT_FILE" 2>/dev/null)"
    else
      echo "Kill switch: off (automation allowed)"
    fi
    if [[ -f "$CIRCUIT_FILE" ]]; then
      echo "Circuit breaker: TRIPPED"
      sed 's/^/  /' "$CIRCUIT_FILE"
    else
      echo "Circuit breaker: clear"
    fi
    if [[ -f "$ACTIVATED_FILE" ]]; then
      echo "Autonomous timer: activated"
    else
      echo "Autonomous timer: NOT YET ACTIVATED (every tick is a no-op until '$0 activate')"
    fi
    echo
    echo "Recent deploys:"
    tail -n 5 "$STATE_DIR/deploy-history.log" 2>/dev/null || echo "  (none recorded yet)"
    ;;
  *)
    echo "Usage: $0 {on|off|status|reset-circuit|activate}" >&2
    exit 1
    ;;
esac
