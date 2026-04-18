#!/usr/bin/env bash
# Despliegue de chaincode sobre test-network (install / approve / commit vía network.sh deployCC).
set -euo pipefail

ROOT="${PROYECTO_BLOCKCHAIN_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

TN="$ROOT/red-hyperledger/test-network"
if [[ ! -f "$TN/network.sh" ]]; then
  echo "No se encontró test-network en: $TN" >&2
  echo "Defina PROYECTO_BLOCKCHAIN_ROOT con la ruta a proyecto-blockchain/ si el script no está en el árbol esperado." >&2
  exit 1
fi

: "${CHAINCODE_DEPLOY_NAME:?Defina CHAINCODE_DEPLOY_NAME (nombre del chaincode)}"
: "${CHAINCODE_DEPLOY_SRC:?Defina CHAINCODE_DEPLOY_SRC (ruta relativa al directorio test-network, p. ej. ../asset-transfer-basic/chaincode-go)}"

CHANNEL="${CHAINCODE_DEPLOY_CHANNEL:-clientes}"
VERSION="${CHAINCODE_DEPLOY_VERSION:-1.0}"
SEQUENCE="${CHAINCODE_DEPLOY_SEQUENCE:-1}"
LANG="${CHAINCODE_DEPLOY_LANG:-go}"
INIT_FCN="${CHAINCODE_DEPLOY_INIT_FCN:-NA}"

echo "== Despliegue chaincode =="
echo "  ROOT=$ROOT"
echo "  test-network=$TN"
echo "  canal=$CHANNEL cc=$CHAINCODE_DEPLOY_NAME src=$CHAINCODE_DEPLOY_SRC version=$VERSION sequence=$SEQUENCE lang=$LANG"

cd "$TN"
export PATH="${TN}/../bin:${PATH:-}"
./network.sh deployCC \
  -c "$CHANNEL" \
  -ccn "$CHAINCODE_DEPLOY_NAME" \
  -ccp "$CHAINCODE_DEPLOY_SRC" \
  -ccl "$LANG" \
  -ccv "$VERSION" \
  -ccs "$SEQUENCE" \
  -cci "$INIT_FCN"

echo "Despliegue solicitado a network.sh finalizado (revise salida anterior por errores de peer)."
