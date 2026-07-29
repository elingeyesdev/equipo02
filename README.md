# Proyecto Blockchain — BaaS Universal

API de **Blockchain como Servicio (BaaS) universal** sobre Hyperledger Fabric: permite a
cualquier sistema externo registrar, consultar, versionar, auditar y restaurar datos/activos
arbitrarios de forma inmutable, sin conocer Fabric. Multi-tenant, con RBAC, flujo de
aprobación y restauración inmutable detrás de una sola API REST.

> Documento canónico (qué es y qué debe hacer): [docs/00-especificacion-deber-ser.md](docs/00-especificacion-deber-ser.md).

## Componentes

| Componente | Carpeta | Rol |
|------------|---------|-----|
| **api-middleware** | `api-middleware/` | Núcleo BaaS (Go, :3000): RBAC por API key, modelo genérico `/datos`, cola de aprobación, restauración, auditoría, conexión Fabric por tenant. |
| **web-portal-api** (BFF) | `web-portal-api/` | Backend For Frontend (Go, :3001): login + JWT y proxy seguro que inyecta la `X-API-Key` real (nunca llega al navegador). |
| **Consola BaaS** | `web-cliente-demo/` | Frontend único (React/TS): CRUD de `/datos`, bandeja de aprobaciones, auditoría, historial, trazabilidad, onboarding. |
| **Red Fabric** | `red-hyperledger/` | Red de prueba; un canal por tenant con el chaincode genérico `dato_cc`. |

## Modelo de datos universal

Todo activo se representa como `{ datoId, tipo, payload JSON libre }` sobre el chaincode
`dato_cc`. Sirve para cualquier dominio (parcelas, expedientes, historias clínicas,
inventarios, etc.). No hay modelos rígidos por dominio.

## Roles y flujo de aprobación

- `admin`: todo + aprueba/rechaza solicitudes. Escribe directo en la cadena.
- `integrador`: **propone** cambios (crear/editar/eliminar/restaurar); quedan **pendientes**
  hasta que un admin los aprueba (recién entonces se confirman en la cadena).
- `solo_lectura`: solo `GET`.

## Requisitos previos

- Docker Desktop en ejecución.
- Binarios e imágenes de Fabric (ver `install-fabric.sh` en la raíz). Añadir binarios al PATH:

  `export PATH=$PWD/red-hyperledger/bin:$PATH`

## Puesta en marcha (demo de dos tenants)

Desde `red-hyperledger/test-network`:

```bash
cd red-hyperledger/test-network
# 1) Levantar la red (sin canal todavía)
./network.sh up -ca -s couchdb
```

Desde la raíz del proyecto, dar de alta cada tenant (crea su canal privado y despliega `dato_cc`):

```bash
# 2) Tenant agricultura (su propio canal aislado)
./scripts/fabric-despliegue/agregar_tenant.sh agricultura
# 3) Tenant salud (otro dominio, otro canal aislado)
./scripts/fabric-despliegue/agregar_tenant.sh salud
```

Configurar y arrancar el middleware y el BFF:

```bash
# api-middleware: copiar config y arrancar
cp api-middleware/config/tenants.example.yaml api-middleware/config/tenants.yaml   # ajustar rutas de certs
cd api-middleware && TENANTS_FILE=./config/tenants.yaml go run ./cmd/server         # :3000

# web-portal-api (BFF) en otra terminal
cd web-portal-api && go run ./cmd/server                                            # :3001

# Consola BaaS en otra terminal
cd web-cliente-demo && npm install && npm run dev                                   # :5173 (proxy /api -> :3001)
```

Usuarios de demo de la consola (ver `web-portal-api/config/usuarios-admin.yaml`):

- Agricultura: `olga`/`olga-agri-2026` (admin), `tomas`/`tomas-agri-2026` (integrador), `rosa`/`rosa-agri-2026` (lectura)
- Salud: `sara`/`sara-salud-2026` (admin), `hugo`/`hugo-salud-2026` (integrador), `elsa`/`elsa-salud-2026` (lectura)

## Verificación rápida (sin UI)

```bash
# Poblar ambos tenants con dominios distintos
./scripts/demo_seed_tenants.sh
# Probar aislamiento + RBAC + flujo de aprobación
./scripts/qa_aislamiento_tenants.sh
```

## Apagar la red

```bash
cd red-hyperledger/test-network && ./network.sh down
```

(Borra el estado local de la red de prueba; no toca tu código.)

## Documentación

- [docs/00-especificacion-deber-ser.md](docs/00-especificacion-deber-ser.md) — qué es y qué debe hacer (fuente de verdad).
- [docs/arquitectura-multi-tenant.md](docs/arquitectura-multi-tenant.md) — diseño multi-tenant.
- [docs/onboarding-cliente-nuevo.md](docs/onboarding-cliente-nuevo.md) — alta de un tenant nuevo.
- [docs/guion-demo-jurado.md](docs/guion-demo-jurado.md) — guion de la demo en vivo y defensa.
- [docs/prompts-ia-externa.md](docs/prompts-ia-externa.md) — prompts para NotebookLM/GLM.
- `api-middleware/openapi.yaml` — contrato de la API.
