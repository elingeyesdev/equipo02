#!/usr/bin/env bash
# Siembra datos de DOMINIOS DISTINTOS en dos tenants para la demo del jurado.
# Demuestra que el MISMO modelo /datos (dato_cc) sirve para cualquier negocio.
#
# Requiere el api-middleware corriendo y ambos tenants activos (agricultura, salud).

set -uo pipefail
MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://localhost:3000}"
AGRI_ADMIN="${AGRI_ADMIN:-agri-admin-2026}"
SALUD_ADMIN="${SALUD_ADMIN:-salud-admin-2026}"

crear() { # <key> <json>
  curl -s -X POST "$MIDDLEWARE_URL/datos" -H "X-API-Key: $1" \
    -H "Content-Type: application/json" -d "$2" -w "\n  -> HTTP %{http_code}\n"
}

echo "== Seed tenant AGRICULTURA (dominio: parcelas) =="
crear "$AGRI_ADMIN" '{"datoId":"PARCELA-001","tipo":"parcela","payload":{"cultivo":"maiz","hectareas":12,"ubicacion":"Sector Norte"}}'
crear "$AGRI_ADMIN" '{"datoId":"PARCELA-002","tipo":"parcela","payload":{"cultivo":"quinua","hectareas":7,"ubicacion":"Sector Sur"}}'

echo
echo "== Seed tenant SALUD (dominio: historias clinicas) =="
crear "$SALUD_ADMIN" '{"datoId":"HC-1001","tipo":"historia-clinica","payload":{"paciente":"anon-001","diagnostico":"control rutinario","alergias":["penicilina"]}}'
crear "$SALUD_ADMIN" '{"datoId":"HC-1002","tipo":"historia-clinica","payload":{"paciente":"anon-002","diagnostico":"chequeo anual"}}'

echo
echo "Listo. Verifica universalidad + aislamiento:"
echo "  curl -s \$MIDDLEWARE_URL/datos -H 'X-API-Key: $AGRI_ADMIN' | jq '.datos[].datoId'   # PARCELA-*"
echo "  curl -s \$MIDDLEWARE_URL/datos -H 'X-API-Key: $SALUD_ADMIN' | jq '.datos[].datoId'  # HC-*"
