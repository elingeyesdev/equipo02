#!/usr/bin/env bash
#
# Da de alta un TENANT del BaaS universal: crea su canal Fabric privado y
# despliega en él el chaincode genérico `dato_cc`. Reutilizable para cualquier
# dominio (agricultura, salud, educacion, logistica, ...).
#
# El aislamiento entre tenants se logra porque cada uno vive en un CANAL
# distinto: un peer/identidad de un tenant no puede leer el ledger de otro.
#
# Uso:
#   ./agregar_tenant.sh <canal> [version] [secuencia]
#
# Ejemplos:
#   ./agregar_tenant.sh agricultura
#   ./agregar_tenant.sh salud
#   ./agregar_tenant.sh educacion 1.0 1
#
# Requisitos:
#   - Red levantada: (desde test-network) ./network.sh up createChannel -ca -s couchdb -c <primerCanal>
#   - Chaincode dato_cc en red-hyperledger/dato-cc/chaincode-go/
#   - Binarios Fabric en red-hyperledger/bin (se añaden al PATH).
#
# Variables opcionales:
#   PROYECTO_BLOCKCHAIN_ROOT   ruta a proyecto-blockchain/ (autodetectada).
#   CC_NAME                    nombre del chaincode (default: dato_cc).
#   CC_SRC                     ruta al chaincode (default: ../dato-cc/chaincode-go).

set -euo pipefail

CANAL="${1:-}"
if [[ -z "$CANAL" ]]; then
  echo "Uso: $0 <canal> [version] [secuencia]" >&2
  echo "Ej:  $0 salud" >&2
  exit 2
fi
CC_VERSION="${2:-1.0}"
CC_SEQUENCE="${3:-1}"

ROOT="${PROYECTO_BLOCKCHAIN_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

TN="$ROOT/red-hyperledger/test-network"
if [[ ! -f "$TN/network.sh" ]]; then
  echo "No se encontró test-network en: $TN" >&2
  exit 1
fi

CC_NAME="${CC_NAME:-dato_cc}"
CC_SRC="${CC_SRC:-../dato-cc/chaincode-go}"

echo "== Alta de tenant (BaaS universal) =="
echo "  ROOT:         $ROOT"
echo "  test-network: $TN"
echo "  canal:        $CANAL"
echo "  chaincode:    $CC_NAME (src=$CC_SRC, ver=$CC_VERSION, seq=$CC_SEQUENCE)"

cd "$TN"
export PATH="${TN}/../bin:${PATH:-}"

echo "--> 1/2 Creando canal privado '$CANAL' (Org1 + Org2)"
./network.sh createChannel -c "$CANAL" -ca -s couchdb || true

echo "--> 2/2 Desplegando chaincode '$CC_NAME' en '$CANAL'"
./network.sh deployCC \
  -c "$CANAL" \
  -ccn "$CC_NAME" \
  -ccp "$CC_SRC" \
  -ccl go \
  -ccv "$CC_VERSION" \
  -ccs "$CC_SEQUENCE" \
  -cci "NA"

echo
echo "Tenant listo:"
echo "   - Canal Fabric: $CANAL"
echo "   - Chaincode:    $CC_NAME (modelo universal datoId+tipo+payload)"
echo
echo "Siguiente paso: añadir el tenant en api-middleware/config/tenants.yaml"
echo "(canal=$CANAL, chaincode=$CC_NAME, msp/cert según la Org elegida) y reiniciar el middleware."
echo
echo "Verificación rápida:"
echo "  peer chaincode query -C $CANAL -n $CC_NAME -c '{\"function\":\"GetAllDatos\",\"Args\":[]}'"
