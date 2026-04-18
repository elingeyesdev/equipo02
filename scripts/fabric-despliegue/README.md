# Scripts de despliegue de chaincode (test-network)

Esta carpeta encapsula el flujo repetible de **empaquetado + install + approve + commit** sobre la red de prueba oficial del monorepo (`red-hyperledger/test-network`), reutilizando `network.sh deployCC` y los mismos parámetros que `scripts/deployCC.sh`.

## Requisitos

- Docker en ejecución y red levantada con canal creado (por ejemplo `clientes`), según el [README del monorepo](../../README.md).
- Binarios `peer`, `configtxgen`, etc. en el `PATH` (p. ej. `export PATH=$PWD/red-hyperledger/bin:$PATH` desde la raíz del monorepo).
- Ejecutar los scripts **desde la raíz del monorepo** `proyecto-blockchain/` o exportar `PROYECTO_BLOCKCHAIN_ROOT` apuntando a esa ruta.

## Uso rápido

Variables obligatorias:

| Variable | Descripción |
|----------|-------------|
| `CHAINCODE_DEPLOY_NAME` | Nombre lógico del chaincode (`-ccn`) |
| `CHAINCODE_DEPLOY_SRC` | Ruta del código **relativa a** `red-hyperledger/test-network` (p. ej. `../asset-transfer-basic/chaincode-go`) |

Opcionales:

| Variable | Default |
|----------|---------|
| `CHAINCODE_DEPLOY_CHANNEL` | `clientes` |
| `CHAINCODE_DEPLOY_VERSION` | `1.0` |
| `CHAINCODE_DEPLOY_SEQUENCE` | `1` |
| `CHAINCODE_DEPLOY_LANG` | `go` |
| `CHAINCODE_DEPLOY_INIT_FCN` | `NA` (sin `--init-required`) |

Ejemplo (cliente asset, mismo fuente que usa el README del proyecto):

```bash
export CHAINCODE_DEPLOY_NAME=cliente_cc
export CHAINCODE_DEPLOY_SRC=../asset-transfer-basic/chaincode-go
./scripts/fabric-despliegue/desplegar_chaincode_test_network.sh
```

El script termina con código distinto de cero si falta alguna variable o si `network.sh` falla; revise la salida en consola.

## Relación con el middleware

El despliegue real del chaincode lifecycle se ejecuta con la **CLI de Fabric** dentro del entorno test-network; el middleware solo **invoca** contratos ya definidos en políticas (`internal/chaincodepolicy/politicas_chaincode.json` o `CHAINCODE_POLITICAS_FILE`).
