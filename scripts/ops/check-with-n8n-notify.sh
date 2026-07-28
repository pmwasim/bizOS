#!/usr/bin/env bash
# Run pnpm check and notify local n8n on failure (optional).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "$REPO_ROOT"

if pnpm check; then
  exit 0
fi

status=$?

if [ -n "${N8N_CI_WEBHOOK_URL:-}" ]; then
  node scripts/ops/n8n-notify.mjs ci-failure \
    --branch "$(git branch --show-current 2>/dev/null || echo local)" \
    --sha "$(git rev-parse HEAD 2>/dev/null || echo unknown)" \
    --job "pnpm check" \
    --conclusion failure || true
fi

exit "$status"
