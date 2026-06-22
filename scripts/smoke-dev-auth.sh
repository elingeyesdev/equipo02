#!/usr/bin/env bash
# Smoke: cuenta dev → solicitud → activar → credenciales con JWT
set -euo pipefail

BFF_URL="${BFF_URL:-http://127.0.0.1:3001}"
EMAIL="dev-smoke-$(date +%s)@example.com"
PASS="dev-smoke-pass"
TENANT_ID="devuser-$(date +%s | tail -c 6)"

echo "== Smoke dev auth ($EMAIL) =="

REG=$(curl -sf -X POST "$BFF_URL/dev/auth/registro" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"nombre\":\"Smoke Dev\"}")
TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Registro OK"

RESP=$(curl -sf -X POST "$BFF_URL/dev/solicitudes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"orgName\": \"Smoke Dev Org\",
    \"domain\": \"https://smoke.example.com\",
    \"users\": [{\"username\": \"adm\", \"nombreCompleto\": \"Admin\", \"rol\": \"admin\"}],
    \"integration\": {\"entityType\": \"test\", \"stack\": \"curl\", \"entityName\": \"T\", \"businessIdField\": \"id\", \"schemaVersion\": \"v1\", \"payloadExample\": \"{}\"},
    \"submit\": true
  }")
REQ_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['solicitud']['id'])")
echo "Solicitud: $REQ_ID"

PLAT=$(curl -sf -X POST "$BFF_URL/platform/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform-admin","password":"platform-admin-2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -sf -X POST "$BFF_URL/platform/solicitudes/$REQ_ID/marcar-provisioning" -H "Authorization: Bearer $PLAT" > /dev/null
curl -sf -X POST "$BFF_URL/platform/solicitudes/$REQ_ID/activar" -H "Authorization: Bearer $PLAT" > /dev/null
echo "Activado"

CRED=$(curl -sf "$BFF_URL/dev/solicitudes/$REQ_ID/credenciales" -H "Authorization: Bearer $TOKEN")
echo "$CRED" | grep -q integrador && echo "OK: credenciales con JWT dev"

LIST=$(curl -sf "$BFF_URL/dev/mis-solicitudes" -H "Authorization: Bearer $TOKEN")
echo "$LIST" | grep -q "$REQ_ID" && echo "OK: mis-solicitudes"

echo "== Smoke dev auth completado =="
