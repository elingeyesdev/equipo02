# Hyperledger Blockchain Explorer — canal `clientes`

Interfaz web para ver **bloques y transacciones** del test-network en el canal **`clientes`**, sin usar el middleware ni el front del proyecto.

## Red Docker del test-network

Los contenedores Fabric se unen a la red bridge con nombre fijo **`fabric_test`**, definida en `red-hyperledger/test-network/compose/compose-test-net.yaml` (y variantes CA/CouchDB). Comprueba con la red levantada:

```bash
docker network ls | grep fabric_test
```

Explorer debe usar **esa misma red** (`external: true` en `docker-compose.yaml`) para resolver `peer0.org1.example.com` y demás hostnames internos.

## Prerrequisitos

- Docker Desktop.
- Red arriba con CA, CouchDB y canal **clientes**:

```bash
cd red-hyperledger/test-network
./network.sh up createChannel -ca -s couchdb -c clientes
```

- Con **Fabric CA**, la clave privada de `User1` está en `keystore/` con un nombre `*_sk`, no `priv_sk`. Antes de arrancar Explorer, ejecuta:

```bash
cd blockchain-explorer
chmod +x prep-explorer-msp.sh
./prep-explorer-msp.sh
```

(O define `FABRIC_TEST_NETWORK_ROOT` si tu `test-network` no está en `../red-hyperledger/test-network` respecto a esta carpeta.)

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto en el host (por defecto **8081** para no chocar con servicios en 8080). |
| `EXPLORER_CONFIG_FILE_PATH` | Ruta al `config.json` montado en el contenedor. |
| `EXPLORER_PROFILE_DIR_PATH` | Directorio del connection profile. |
| `FABRIC_CRYPTO_PATH` | Carpeta `organizations/` del test-network (montada como `/tmp/crypto` en el contenedor). |

Copia `.env.example` a `.env` y revisa `FABRIC_CRYPTO_PATH` si tu árbol de carpetas difiere.

## Levantar Explorer

Desde **esta carpeta** (`proyecto-blockchain/blockchain-explorer/`):

```bash
cp -n .env.example .env   # o crea .env a mano
./prep-explorer-msp.sh
docker compose --env-file .env up -d
```

Ver logs si la UI no carga el canal:

```bash
docker logs explorer.clientes 2>&1 | tail -80
```

## Acceso web y credenciales

- URL: **http://localhost:8081** (o el `PORT` que hayas puesto en `.env`).
- En el login de Explorer, el campo de red debe coincidir con el id del perfil: **`clientes-network`**.
- Usuario / contraseña (definidos en `connection-profile/clientes-network.json` → `client.adminCredential`):
  - **Usuario:** `exploreradmin`
  - **Contraseña:** `exploreradminpw`

## Validar evidencia visual (entregable 1.5)

1. Con la red y Explorer en marcha, ejecuta en CLI una transacción en el canal `clientes` (por ejemplo `CreateAsset`, `Mint`, `Transfer`, según tus chaincodes desplegados).
2. En Explorer, abre el canal **clientes** y revisa que aparezcan **nuevos bloques/transacciones** tras la invocación.

Ejemplo mínimo (ajusta `-ccn` / `-c` si tus nombres difieren):

```bash
cd red-hyperledger/test-network
./network.sh cc invoke -c clientes -ccn cliente_cc -ccic '{"Args":["CreateAsset","exp1","azul","30","owner1","100"]}'
```

## Apagar

```bash
docker compose --env-file .env down
```

Para borrar también los volúmenes de Postgres/wallet de Explorer:

```bash
docker compose --env-file .env down -v
```

**No** ejecutes esto pensando que apaga Fabric; solo afecta a los contenedores definidos en este compose.

## Nota para el docente

**El entregable 1.5 incluye evidencia visual mediante Hyperledger Blockchain Explorer** (además de la trazabilidad por CLI): capturas o video de la UI mostrando el canal **clientes** y transacciones tras operaciones por consola.
