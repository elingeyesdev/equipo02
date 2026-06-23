#!/usr/bin/env bash
# Reinicia api-middleware para cargar tenants.yaml tras activar un tenant.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/api-middleware"

echo "Reiniciando api-middleware para recargar config/tenants.yaml…"
if command -v docker >/dev/null 2>&1 && docker compose ps middleware 2>/dev/null | grep -q Up; then
  docker compose restart middleware
  echo "OK: docker compose restart middleware"
elif pgrep -f "api-middleware" >/dev/null 2>&1; then
  pkill -f "api-middleware/cmd/server" || true
  echo "Proceso anterior detenido. Inicia de nuevo: cd api-middleware && go run ./cmd/server"
else
  echo "No se detectó proceso docker ni local. Inicia manualmente:"
  echo "  cd api-middleware && go run ./cmd/server"
fi
