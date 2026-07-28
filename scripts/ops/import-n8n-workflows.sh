#!/usr/bin/env bash
# Import all bizOS n8n workflow templates into the local qh-n8n container (inactive).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WORKFLOW_DIR="${REPO_ROOT}/docs/operations/n8n-workflows"
N8N_CONTAINER="${N8N_CONTAINER:-qh-n8n}"

usage() {
  echo "Usage: $(basename "$0") [--dry-run] [--activate NAME]"
  echo "Imports every docs/operations/n8n-workflows/*.json into n8n (active: false by default)."
}

dry_run=false
activate_name=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=true; shift ;;
    --activate) activate_name="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

if ! docker inspect "$N8N_CONTAINER" >/dev/null 2>&1; then
  echo "Container ${N8N_CONTAINER} not found. Start qloudihub n8n stack first." >&2
  exit 1
fi

shopt -s nullglob
files=("${WORKFLOW_DIR}"/*.json)
if [ ${#files[@]} -eq 0 ]; then
  echo "No workflow JSON files in ${WORKFLOW_DIR}" >&2
  exit 1
fi

if $dry_run; then
  for f in "${files[@]}"; do
    echo "would import: $(basename "$f")"
  done
  exit 0
fi

imported=0
for f in "${files[@]}"; do
  base=$(basename "$f" .json)
  echo "Importing ${base}..."
  docker cp "$f" "${N8N_CONTAINER}:/tmp/bizos-${base}.json"
  docker exec "$N8N_CONTAINER" sh -c \
    "jq -s 'map(. + {active: false})' /tmp/bizos-${base}.json > /tmp/import.json && \
     n8n import:workflow --input=/tmp/import.json" 2>&1 | grep -v '^User settings' | grep -v '^Permissions' || true
  imported=$((imported + 1))
done

echo "Imported ${imported} bizOS workflows (all inactive)."

if [ -n "$activate_name" ]; then
  echo "Note: activate workflows manually in n8n UI or via API after configuring credentials."
  echo "Search for workflow name containing: ${activate_name}"
fi

docker exec "$N8N_CONTAINER" n8n list:workflow 2>/dev/null | grep -i bizos || true
