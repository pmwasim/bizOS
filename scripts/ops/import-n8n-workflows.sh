#!/usr/bin/env bash
# Import all bizOS n8n workflow templates into the local n8n container (inactive).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/docs/operations/n8n-workflows"

usage() {
  echo "Usage: $(basename "$0") [--dry-run] [--activate]"
  echo "Imports every docs/operations/n8n-workflows/*.json into n8n (active: false)."
  echo "Pass --activate to enable them after import (requires credentials/env)."
}

dry_run=false
activate=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --activate) activate=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

resolve_container() {
  if [ -n "${N8N_CONTAINER:-}" ]; then
    echo "$N8N_CONTAINER"
    return
  fi
  for name in bizos-n8n qh-n8n; do
    if docker inspect "$name" >/dev/null 2>&1; then
      echo "$name"
      return
    fi
  done
  return 1
}

if $dry_run; then
  shopt -s nullglob
  files=("${WORKFLOW_DIR}"/*.json)
  if [ ${#files[@]} -eq 0 ]; then
    echo "No workflow JSON files in ${WORKFLOW_DIR}" >&2
    exit 1
  fi
  for f in "${files[@]}"; do
    echo "would import: $(basename "$f")"
  done
  exit 0
fi

if ! container="$(resolve_container)"; then
  echo "No n8n container found (bizos-n8n or qh-n8n). Start it with:" >&2
  echo "  docker compose --env-file .env --profile ops up -d n8n" >&2
  exit 1
fi

node "${SCRIPT_DIR}/n8n-activate.mjs" --container "$container" ${activate:+--activate}
