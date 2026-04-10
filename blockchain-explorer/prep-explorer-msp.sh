#!/usr/bin/env bash
# Crea el enlace simbólico priv_sk en el keystore de User1 (Fabric CA genera un nombre aleatorio *_sk).
# El connection profile de Explorer apunta a priv_sk. Ejecutar después de levantar la red con -ca.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
TN_ROOT="${FABRIC_TEST_NETWORK_ROOT:-$SCRIPT_DIR/../red-hyperledger/test-network}"
KEYSTORE="$TN_ROOT/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore"

if [[ ! -d "$KEYSTORE" ]]; then
	echo "No existe el keystore de User1: $KEYSTORE" >&2
	echo "Levanta antes la red: cd red-hyperledger/test-network && ./network.sh up createChannel -ca -s couchdb -c clientes" >&2
	exit 1
fi

shopt -s nullglob
keys=( "$KEYSTORE"/*_sk )
if [[ ${#keys[@]} -eq 0 ]]; then
	echo "No hay archivo *_sk en $KEYSTORE" >&2
	exit 1
fi

if [[ ${#keys[@]} -gt 1 ]]; then
	echo "Aviso: hay varias claves *_sk; se usa la primera: ${keys[0]}" >&2
fi

TARGET=$(basename "${keys[0]}")
cd "$KEYSTORE"
ln -sf "$TARGET" priv_sk
echo "Listo: $KEYSTORE/priv_sk -> $TARGET"
