#!/usr/bin/env bash
# QA del BaaS universal: aislamiento entre tenants + RBAC + flujo de aprobación.
#
# Demuestra, contra el api-middleware en vivo:
#   - Universalidad: dos tenants de dominios distintos (agricultura, salud)
#     usan la MISMA API /datos.
#   - Aislamiento: un tenant no ve el ledger del otro (canales Fabric distintos).
#   - RBAC: solo_lectura no muta; credencial inválida se rechaza.
#   - Aprobación: un integrador NO escribe directo (202 pendiente); el admin
#     aprueba y recién entonces el dato queda en la cadena.
#
# Requisitos:
#   - api-middleware corriendo en MIDDLEWARE_URL (default :3000)
#   - tenant "agricultura" (canal agricultura, dato_cc) y "salud" (canal salud)
#   - API keys por rol (ver config/tenants.yaml)
#
# Variables (con defaults):
#   MIDDLEWARE_URL, AGRI_ADMIN, AGRI_INT, AGRI_LECT, SALUD_ADMIN, DATO_ID

set -uo pipefail

MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://localhost:3000}"
AGRI_ADMIN="${AGRI_ADMIN:-agri-admin-2026}"
AGRI_INT="${AGRI_INT:-agri-int-2026}"
AGRI_LECT="${AGRI_LECT:-agri-lect-2026}"
SALUD_ADMIN="${SALUD_ADMIN:-salud-admin-2026}"
DATO_ID="${DATO_ID:-PARCELA-QA-001}"

PASS=0
FAIL=0
ok() { echo "  [OK] $1"; PASS=$((PASS+1)); }
ko() { echo "  [XX] $1"; FAIL=$((FAIL+1)); }

# status <label> <esperado> <url> <key> [method] [body]
status() {
  local label="$1" expected="$2" url="$3" key="$4" method="${5:-GET}" body="${6:-}"
  local actual
  if [[ -n "$body" ]]; then
    actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "X-API-Key: $key" -H "Content-Type: application/json" -d "$body")
  else
    actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "X-API-Key: $key")
  fi
  if [[ "$actual" == "$expected" ]]; then ok "$label -> $actual"; else ko "$label -> esperado $expected, obtenido $actual"; fi
}

echo "== QA BaaS universal: aislamiento + RBAC + aprobacion =="
echo "  middleware: $MIDDLEWARE_URL"
echo "  datoId:     $DATO_ID"
echo

# 1. Admin de agricultura crea un dato directamente (201)
echo "[1] Agricultura (admin) crea $DATO_ID en /datos (escritura directa)"
status "POST /datos con agri-admin" "201" "$MIDDLEWARE_URL/datos" "$AGRI_ADMIN" "POST" \
  "{\"datoId\":\"$DATO_ID\",\"tipo\":\"parcela\",\"payload\":{\"qa\":true,\"hectareas\":5}}"

# 2. Lectura del tenant lo ve
echo "[2] Agricultura (lectura) lee el dato"
status "GET /datos/$DATO_ID con agri-lect" "200" "$MIDDLEWARE_URL/datos/$DATO_ID" "$AGRI_LECT"

# 3. AISLAMIENTO: el tenant salud NO ve ese dato en su canal
echo "[3] Salud (admin) intenta leer el mismo id en su canal (no debe verlo)"
status "GET /datos/$DATO_ID con salud-admin" "404" "$MIDDLEWARE_URL/datos/$DATO_ID" "$SALUD_ADMIN"

# 4. APROBACION: el integrador NO escribe directo -> 202 pendiente
echo "[4] Agricultura (integrador) propone un cambio -> debe quedar PENDIENTE (202)"
status "PUT /datos/$DATO_ID con agri-int" "202" "$MIDDLEWARE_URL/datos/$DATO_ID" "$AGRI_INT" "PUT" \
  "{\"datoId\":\"$DATO_ID\",\"tipo\":\"parcela\",\"payload\":{\"qa\":true,\"hectareas\":9}}"

# 5. El admin ve la solicitud pendiente
echo "[5] Agricultura (admin) lista solicitudes pendientes"
status "GET /solicitudes?estado=pendiente con agri-admin" "200" \
  "$MIDDLEWARE_URL/solicitudes?estado=pendiente" "$AGRI_ADMIN"

# 6. RBAC: lectura no puede crear
echo "[6] Agricultura (lectura) intenta crear -> 403"
status "POST /datos con agri-lect" "403" "$MIDDLEWARE_URL/datos" "$AGRI_LECT" "POST" \
  "{\"datoId\":\"PARCELA-QA-002\",\"tipo\":\"parcela\",\"payload\":{\"x\":1}}"

# 7. Credencial inválida
echo "[7] Credencial inexistente -> 403"
status "POST /datos con clave fantasma" "403" "$MIDDLEWARE_URL/datos" "no-existe" "POST" \
  "{\"datoId\":\"x\",\"tipo\":\"x\",\"payload\":{}}"

# 8. Historial inmutable
echo "[8] Historial inmutable del dato"
status "GET /datos/$DATO_ID/historial con agri-lect" "200" \
  "$MIDDLEWARE_URL/datos/$DATO_ID/historial" "$AGRI_LECT"

echo
echo "== Resultado =="
echo "  pass: $PASS"
echo "  fail: $FAIL"
echo
echo "NOTA: para cerrar el ciclo de aprobacion en vivo, tome el solicitudId de [5] y:"
echo "  curl -X POST \$MIDDLEWARE_URL/solicitudes/<id>/aprobar -H 'X-API-Key: $AGRI_ADMIN'"
echo "  # luego GET /datos/$DATO_ID mostrará hectareas=9 (cambio ya confirmado en cadena)"
[[ "$FAIL" -gt 0 ]] && exit 1
exit 0
