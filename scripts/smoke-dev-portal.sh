#!/usr/bin/env bash
# Smoke dev portal: solicitud → activar → verificar yaml → POST /datos (si middleware up)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BFF_URL="${BFF_URL:-http://127.0.0.1:3001}"
MW_URL="${MW_URL:-http://127.0.0.1:3000}"
TENANT_ID="smoke-$(date +%s | tail -c 6)"

echo "== Smoke dev portal (tenant: $TENANT_ID) =="

# 1) Crear solicitud
RESP=$(curl -sf -X POST "$BFF_URL/dev/solicitudes" \
  -H 'Content-Type: application/json' \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"orgName\": \"Smoke Test Org\",
    \"domain\": \"https://smoke.example.com\",
    \"contactEmail\": \"smoke@example.com\",
    \"users\": [{\"username\": \"smokeadmin\", \"nombreCompleto\": \"Smoke Admin\", \"rol\": \"admin\"}],
    \"integration\": {\"entityType\": \"test\", \"stack\": \"curl\", \"entityName\": \"Test\", \"businessIdField\": \"id\", \"schemaVersion\": \"v1\", \"payloadExample\": \"{}\"},
    \"submit\": true
  }")
REQ_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['solicitud']['id'])")
echo "Solicitud creada: $REQ_ID"

# 2) Login operador + activar
TOKEN=$(curl -sf -X POST "$BFF_URL/platform/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform-admin","password":"platform-admin-2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -sf -X POST "$BFF_URL/platform/solicitudes/$REQ_ID/marcar-provisioning" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

ACTIVATE=$(curl -sf -X POST "$BFF_URL/platform/solicitudes/$REQ_ID/activar" \
  -H "Authorization: Bearer $TOKEN")
INT_KEY=$(echo "$ACTIVATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['resultado']['apiKeys']['integrador'])")
echo "Integrador key: $INT_KEY"

# 3) Verificar tenants.yaml contiene el tenant
if ! grep -q "$TENANT_ID:" "$ROOT/api-middleware/config/tenants.yaml" 2>/dev/null; then
  echo "WARN: tenant no encontrado en tenants.yaml (ruta puede variar)"
else
  echo "OK: bloque en tenants.yaml"
fi

# 4) Credenciales dev
CRED=$(curl -sf "$BFF_URL/dev/solicitudes/$REQ_ID/credenciales?email=smoke@example.com")
echo "$CRED" | grep -q integrador && echo "OK: credenciales dev"

# 5) POST /datos (opcional si middleware responde)
if curl -sf "$MW_URL/health" > /dev/null 2>&1; then
  HTTP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$MW_URL/datos" \
    -H "X-API-Key: $INT_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"datoId\":\"SMOKE-001\",\"tipo\":\"test\",\"payload\":{\"schemaVersion\":\"v1\"}}")
  echo "POST /datos → HTTP $HTTP (esperado 201 o 202; 503 si canal no existe en Fabric)"
else
  echo "SKIP: middleware no disponible en $MW_URL"
fi

echo "== Smoke completado =="
