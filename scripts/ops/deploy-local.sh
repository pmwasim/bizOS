#!/usr/bin/env bash
set -euo pipefail

# local CI/CD deployment script for bizOS on Ubuntu
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/5] Loading environment variables ==="
set -a
. "$ROOT_DIR/.env"
set +a

echo "=== [2/5] Running database migrations ==="
pnpm --filter @bizo/database prisma:migrate:deploy
pnpm db:seed

echo "=== [3/5] Building backend API ==="
pnpm --filter @bizo/api build

echo "=== [4/5] Reloading and restarting systemd services ==="
sudo systemctl daemon-reload
sudo systemctl restart bizos-api bizos-web cloudflared

echo "=== [5/5] Performing post-deployment health check ==="
sleep 3

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/v1/health || echo "000")
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 || echo "000")
LIVE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://bizos.qloudihub.com/ || echo "000")

echo "API Health Endpoint (3001): HTTP $API_STATUS"
echo "Web Local Endpoint (3000): HTTP $WEB_STATUS"
echo "Cloudflare Live Domain: HTTP $LIVE_STATUS"

if [ "$API_STATUS" -eq 200 ] && [ "$WEB_STATUS" -eq 200 ] && [ "$LIVE_STATUS" -eq 200 ]; then
  echo "✅ CI/CD Deployment succeeded! bizOS is live at https://bizos.qloudihub.com/"
else
  echo "⚠️ Warning: One or more health checks returned non-200 status."
  exit 1
fi
