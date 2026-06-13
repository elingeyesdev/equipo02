# Especificacion de Servicios BaaS
## Manual de Integracion (Version v2)

**Proyecto:** CampusChain BaaS sobre Hyperledger Fabric  
**Repositorio base:** `proyecto-blockchain`  
**Documento:** Manual tecnico de integracion para tenants externos  
**Fecha:** 2026-06-12  

---

## Control de versiones

| Version | Fecha | Autor | Detalle |
|---|---|---|---|
| v2.0.0 | 2026-06-12 | Equipo Proyecto Hyperledger | Reestructura completa del manual para arquitectura multi-tenant con onboarding guiado |
| v1.x | 2026-04-* | Equipo inicial | Documento inicial de referencia del proyecto |

---

## Tabla de contenido

1. Introduccion  
2. Objetivo general  
3. Objetivos especificos  
4. Alcance  
5. Arquitectura de referencia  
6. Modelo de seguridad y autorizacion  
7. Capas de servicio  
8. Proceso de onboarding de tenant nuevo  
9. Contrato de datos y versionado de payload  
10. Endpoints de integracion (multi-tenant)  
11. Endpoints complementarios de auditoria y eventos  
12. Configuracion tecnica (archivos y variables)  
13. Ejecucion operativa (arranque y reinicio de servicios)  
14. Casos de prueba funcional  
15. Validacion de aislamiento entre tenants  
16. Manejo de errores y codigos comunes  
17. Diccionario de datos  
18. Checklist final de entrega  
19. Troubleshooting  
20. Anexos (curl base y plantillas)

---

## 1. Introduccion

Este documento describe la integracion de aplicaciones externas con una plataforma **Blockchain-as-a-Service (BaaS)** implementada sobre **Hyperledger Fabric**, mediante un middleware REST multi-tenant.

El objetivo de la plataforma es permitir que distintas organizaciones (tenants) registren y consulten informacion de forma inmutable en blockchain, con aislamiento de datos por tenant, control de acceso por rol y trazabilidad completa de operaciones.

La integracion de este manual utiliza un enfoque unico:

- **Modelo generico multi-tenant** sobre rutas `/datos/*` con payload JSON versionado.

Este enfoque se adopta por su adaptabilidad a diferentes dominios de negocio (agro, ERP, academico, etc.) y por su simplicidad para integradores externos.

---

## 2. Objetivo general

Proveer una interfaz de integracion estandar, segura y auditable para que sistemas externos escriban y consulten datos de negocio en blockchain, manteniendo:

- inmutabilidad del historial,
- segregacion por tenant,
- trazabilidad tecnica y funcional,
- simplicidad operativa para el equipo integrador.

---

## 3. Objetivos especificos

1. Estandarizar la incorporacion de nuevos tenants mediante onboarding tecnico.  
2. Definir un contrato de datos versionable (`schemaVersion`) para integraciones heterogeneas.  
3. Asegurar autorizacion por rol (`admin`, `integrador`, `solo_lectura`) y por tenant.  
4. Habilitar auditoria completa (HTTP + eventos on-chain + historial por recurso).  
5. Facilitar pruebas de integracion y validacion de aislamiento multi-tenant.

---

## 4. Alcance

### 4.1 Incluye

- Integracion REST al middleware (`api-middleware`).
- Login de consola administrativa via BFF (`web-portal-api`) para interfaces web.
- Registro, consulta, historial y restauracion logica de datos (`/datos/*`).
- Eventos en tiempo real via SSE (`/eventos/stream`).
- Guia operativa de configuracion y validacion.

### 4.2 No incluye

- Desarrollo funcional interno del sistema integrador externo.
- Despliegue de infraestructura cloud productiva (se entrega guia de referencia).
- Integraciones de pago de terceros ajenos al alcance del BaaS.

---

## 5. Arquitectura de referencia

### 5.1 Componentes

1. **Aplicacion integradora externa**  
   Backend o frontend que consume el BaaS.

2. **api-middleware (Go)**  
   API multi-tenant que enruta operaciones al canal/chaincode correcto segun API key.

3. **Red Hyperledger Fabric**  
   Canales por tenant y chaincodes de dominio.

4. **web-portal-api (BFF)**  
   Gestiona login JWT para consolas web y reenvia al middleware inyectando `X-API-Key`.

5. **web-cliente-demo (Onboarding + Explorer)**  
   UI de referencia para onboarding y auditoria.

### 5.2 Principio de aislamiento

Cada API key resuelve:

- tenant objetivo,
- rol del actor,
- permisos efectivos sobre endpoints.

El consumidor **no envia tenant explicito**: el middleware lo deduce por credencial.

---

## 6. Modelo de seguridad y autorizacion

### 6.1 Esquema de acceso

- **Integracion directa API:** `X-API-Key` en cada request.
- **Consola web:** JWT en frontend + BFF inyecta `X-API-Key` real.

### 6.2 Roles

| Rol | Permisos esperados |
|---|---|
| admin | Lectura, escritura, eliminacion, restauracion logica, auditoria |
| integrador | Lectura y escritura de negocio, sin privilegios administrativos |
| solo_lectura | Solo consultas, historial y auditoria de lectura |

### 6.3 Buenas practicas

- Rotar API keys periodicamente.
- No exponer API keys en frontend publico.
- Usar TLS en ambientes productivos.
- Registrar actor tecnico (`X-Actor-*`) cuando aplique.

---

## 7. Capas de servicio

La plataforma organiza operaciones en capas funcionales:

1. **Authorization (BFF / consola):** login, me, logout.  
2. **Transactions (middleware):** alta, edicion, eliminacion, restauracion.  
3. **Operations (middleware):** consulta individual/listado/historial.  
4. **Callback / Eventos:** stream de eventos y auditoria HTTP.

---

## 8. Proceso de onboarding de tenant nuevo

El onboarding recomendado sigue 5 pasos:

1. **Configurar tenant**  
   ID tenant, canal, chaincode, MSP, peer endpoint y rutas de certificados.

2. **Definir API keys por rol**  
   Claves separadas para admin, integrador y lectura.

3. **Crear usuarios de consola**  
   Usuarios del BFF para panel de auditoria y administracion.

4. **Definir contrato de datos**  
   Estructura `payload` con `schemaVersion`.

5. **Probar y entregar**  
   curl, checklist final, validacion de aislamiento y guia exportable.

> Referencia UI: `web-cliente-demo` ruta publica `/onboarding`.

---

## 9. Contrato de datos y versionado de payload

### 9.1 Envoltura base obligatoria

```json
{
  "datoId": "ID_UNICO_NEGOCIO",
  "tipo": "tipo_entidad",
  "payload": {
    "schemaVersion": "v1"
  }
}
```

> **Importante:** la envoltura (`datoId`, `tipo`, `payload`) es la unica parte
> fija del contrato. Todo lo que va dentro de `payload` lo define cada cliente
> segun los atributos de su propio sistema. Los valores mostrados en este
> manual son **ejemplos ilustrativos**, no campos obligatorios.

### 9.2 Reglas recomendadas

- `datoId`: identificador inmutable de negocio.
- `tipo`: categoria funcional (ej. `lote_snapshot`, `registro_erp`).
- `payload.schemaVersion`: version del contrato (`v1`, `v2`, ...).
- Evitar enviar "toda la BD". Enviar snapshot de negocio necesario.
- Usar fechas en ISO-8601 (`YYYY-MM-DDTHH:mm:ssZ`).

### 9.3 Constructor de atributos (onboarding)

El portal de onboarding (paso 4) incluye un constructor visual: el integrador
lista los atributos de su registro (nombre, tipo y valor de ejemplo) y el JSON
del `payload` se genera automaticamente. El resultado es el contrato de datos
que su backend debera enviar en cada alta o edicion.

Tipos soportados por el constructor:

| Tipo | Representacion JSON | Ejemplo |
|---|---|---|
| Texto | string | `"FAC-001"` |
| Numero | number | `1500.75` |
| Si / No | boolean | `true` |
| Fecha (ISO) | string ISO-8601 | `"2026-06-12T00:00:00Z"` |
| Lista (JSON) | array | `[{"id":"ACT-1"}]` |

### 9.4 Plantillas sugeridas (solo ejemplos)

Las plantillas son puntos de partida editables, no esquemas obligatorios:

- Agro (lotes y actividades)
- ERP generico (operaciones comerciales)
- Academico (estado de registros educativos)

---

## 10. Endpoints de integracion (multi-tenant)

Base URL referencial:

- Desarrollo: `http://localhost:3000`
- Produccion: `https://<dominio-middleware>`

### 10.1 Registrar dato

- **Metodo:** `POST`
- **Ruta:** `/datos`
- **Rol minimo:** `integrador`

Request:

```json
{
  "datoId": "REG-001",
  "tipo": "registro_externo",
  "payload": {
    "schemaVersion": "v1",
    "estado": "activo",
    "descripcion": "primer alta"
  }
}
```

Response esperada:

```json
{
  "ok": true,
  "txId": "....",
  "mensaje": "Dato registrado correctamente en la Blockchain"
}
```

### 10.2 Listar datos

- **Metodo:** `GET`
- **Ruta:** `/datos`
- **Rol minimo:** `solo_lectura`

### 10.3 Consultar dato por id

- **Metodo:** `GET`
- **Ruta:** `/datos/{datoId}`
- **Rol minimo:** `solo_lectura`

### 10.4 Actualizar dato

- **Metodo:** `PUT`
- **Ruta:** `/datos/{datoId}`
- **Rol minimo:** `integrador`

### 10.5 Eliminar dato (world state)

- **Metodo:** `DELETE`
- **Ruta:** `/datos/{datoId}`
- **Rol minimo:** `admin`

### 10.6 Historial inmutable

- **Metodo:** `GET`
- **Ruta:** `/datos/{datoId}/historial`
- **Rol minimo:** `solo_lectura`

### 10.7 Restauracion logica

- **Metodo:** `POST`
- **Ruta:** `/datos/{datoId}/restaurar`
- **Rol minimo:** `admin`

Request:

```json
{
  "txId": "TXID_A_RESTAURAR"
}
```

Comportamiento:

- No borra bloques pasados.
- Reescribe el estado objetivo como nueva transaccion.
- Preserva inmutabilidad del ledger.

### 10.8 Modelo de conexion: como integra su backend

La integracion es **unidireccional**: el backend del cliente llama a los
endpoints del middleware descritos arriba. El BaaS **nunca** llama al sistema
del cliente, por lo que **no es necesario exponer ni crear endpoints nuevos**
en el sistema integrado (no hay callbacks ni webhooks obligatorios).

```
Backend del cliente  --HTTP + X-API-Key-->  api-middleware  -->  Hyperledger Fabric
(cualquier lenguaje)                        (puerto 3000)        (canal del tenant)
```

Pasos tipicos de integracion en el codigo del cliente:

1. Guardar el registro en la base de datos propia (flujo normal del sistema).
2. Inmediatamente despues, enviar el snapshot del registro al BaaS:
   `POST /datos` en el alta, `PUT /datos/{datoId}` en cada edicion.
3. Guardar (opcional) el `txId` devuelto, como comprobante de la transaccion.

Ejemplo ilustrativo en JavaScript/Node.js (aplicable a PHP, Python, Java, C#,
Go o cualquier lenguaje con cliente HTTP):

```javascript
const BAAS_URL = 'http://localhost:3000';
const BAAS_API_KEY = 'API_KEY_ROL_INTEGRADOR';

async function registrarEnBlockchain(registro) {
  const res = await fetch(`${BAAS_URL}/datos/${registro.id}`, {
    method: 'PUT', // usar POST /datos para el alta inicial
    headers: {
      'X-API-Key': BAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      datoId: registro.id,
      tipo: 'tipo_entidad_del_cliente',
      payload: {
        schemaVersion: 'v1',
        // mapear aqui los atributos definidos en el contrato de datos
        ...registro,
      },
    }),
  });
  if (!res.ok) throw new Error(`BaaS error ${res.status}`);
  return res.json(); // incluye txId
}
```

Si el cliente desea reaccionar a cambios hechos desde la consola de auditoria
(por ejemplo una restauracion logica ejecutada por un admin), puede consultar
periodicamente `GET /datos/{datoId}/historial` o suscribirse al stream de
eventos descrito en la seccion 11.1. Ambos mecanismos son opcionales.

---

## 11. Endpoints complementarios de auditoria y eventos

### 11.1 Stream de eventos

- **Metodo:** `GET`
- **Ruta:** `/eventos/stream`
- **Formato:** `text/event-stream`

### 11.2 Auditoria HTTP

- **Metodo:** `GET`
- **Ruta:** `/auditoria/http`

### 11.3 Auditoria combinada (si aplica en tu despliegue)

- **Metodo:** `GET`
- **Ruta:** `/auditoria/combinada`

---

## 12. Configuracion tecnica (archivos y variables)

### 12.1 api-middleware

Archivo `.env` recomendado:

```env
TENANTS_FILE=./config/tenants.yaml
CORS_ORIGINS=http://localhost:5173
PORT=3000
```

Archivo `config/tenants.yaml` (fragmento):

```yaml
default: tenant_base
tenants:
  tenant_externo:
    nombre: "Tenant Externo"
    descripcion: "Integracion sobre dato_cc"
    msp_id: "Org2MSP"
    cert_path: "/ruta/a/cert.pem"
    key_path_dir: "/ruta/a/keystore"
    tls_cert_path: "/ruta/a/tls/ca.crt"
    peer_endpoint: "localhost:9051"
    peer_host_alias: "peer0.org2.example.com"
    canal: "canal-tenant"
    chaincode: "dato_cc"
    api_keys:
      "tenant-admin-2026": admin
      "tenant-int-2026": integrador
      "tenant-lect-2026": solo_lectura
```

### 12.2 web-portal-api (BFF)

Archivo `.env` recomendado:

```env
PORT=3001
JWT_SECRET=cambiar-esto-en-local
DATABASE_PATH=./data/portal.db
API_MIDDLEWARE_URL=http://localhost:3000
USUARIOS_ADMIN_FILE=./config/usuarios-admin.yaml
```

Archivo `config/usuarios-admin.yaml` (conceptual):

- define usuarios de consola,
- asocia tenant,
- asocia rol,
- define hash bcrypt de contraseña.

---

## 13. Ejecucion operativa (arranque y reinicio de servicios)

```bash
# 1) middleware
cd api-middleware
go mod tidy
go run ./cmd/server

# 2) BFF
cd ../web-portal-api
go mod tidy
go run ./cmd/server
```

Generar hash bcrypt para usuarios:

```bash
cd web-portal-api
go run ./cmd/bcrypt-gen "mi-password-segura"
```

---

## 14. Casos de prueba funcional

### Caso A - Alta

- Crear recurso en `/datos`.
- Verificar `ok=true` y presencia de `txId`.

### Caso B - Actualizacion

- Modificar payload en `/datos/{datoId}`.
- Validar reflejo en consulta individual y listado.

### Caso C - Historial

- Consultar `/datos/{datoId}/historial`.
- Verificar orden, `txId`, `timestamp`, versiones.

### Caso D - Restauracion logica

- Ejecutar restauracion con `txId` historico.
- Confirmar que se crea nueva transaccion.

### Caso E - Eventos

- Mantener SSE abierto.
- Verificar recepcion en mutaciones.

---

## 15. Validacion de aislamiento entre tenants

Objetivo: demostrar que una credencial de tenant A no puede operar en contexto de tenant B.

### Pruebas minimas

1. Crear dato con key de tenant A.
2. Intentar leerlo desde tenant B.
3. Intentar endpoint incompatible con credencial actual.
4. Validar error esperado (`TENANT_NO_AUTORIZADO` o equivalente).

---

## 16. Manejo de errores y codigos comunes

| Codigo / Mensaje | Causa probable | Accion recomendada |
|---|---|---|
| CREDENCIAL_INVALIDA | API key inexistente o mal escrita | Revisar `tenants.yaml` y header |
| TENANT_NO_AUTORIZADO | Credencial usada en ruta no aplicable al tenant | Usar endpoint del tenant correcto |
| SERVICIO_NO_DISPONIBLE | Gateway Fabric no inicializado | Revisar rutas cert/key/tls y conectividad peer |
| CONSULTA_EXITOSA | Operacion de lectura correcta | Flujo esperado |

---

## 17. Diccionario de datos

### 17.1 Campos de envoltura

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| datoId | string | Si | Identificador unico de negocio |
| tipo | string | Si | Tipo de entidad o documento |
| payload | object | Si | Contenedor de datos de negocio |
| payload.schemaVersion | string | Si | Version del contrato de payload |

### 17.2 Campos recomendados en payload

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| codigo | string | Recomendado | `LOTE-001` |
| nombre | string | Recomendado | `Lote Norte` |
| estado | string | Recomendado | `activo` |
| updatedAt | string (ISO) | Recomendado | `2026-06-12T00:00:00Z` |
| actividades | array | Segun dominio | `[]` |
| producciones | array | Segun dominio | `[]` |

---

## 18. Checklist final de entrega

- [ ] Tenant configurado en `config/tenants.yaml`.
- [ ] Variables `.env` actualizadas en middleware y BFF.
- [ ] Usuarios y bcrypt cargados en `usuarios-admin.yaml`.
- [ ] Pruebas CRUD + historial + restauracion ejecutadas.
- [ ] Prueba de aislamiento multi-tenant aprobada.
- [ ] Guia de integracion entregada al equipo integrador.
- [ ] Evidencias de pruebas archivadas (capturas/logs).

---

## 19. Troubleshooting

### 19.1 Error al levantar middleware

- Verificar `TENANTS_FILE`.
- Verificar que rutas `cert_path`, `key_path_dir`, `tls_cert_path` existan.
- Revisar logs de conexion a peer.

### 19.2 No llegan eventos SSE

- Confirmar mutaciones reales en ledger.
- Confirmar endpoint `/eventos/stream`.
- Revisar si el tenant tiene gateway activo.

### 19.3 La consola web no autentica

- Revisar `JWT_SECRET` y base de datos del BFF.
- Confirmar `USUARIOS_ADMIN_FILE`.
- Verificar hash bcrypt correcto.

### 19.4 Error de permisos con API key valida

- Confirmar rol asociado a la key.
- Confirmar que endpoint corresponda al tenant.

---

## 20. Anexos (curl base y plantillas)

> Los siguientes comandos son **ejemplos ilustrativos** para validar la
> conexion durante el onboarding. Las API keys, URLs e identificadores deben
> reemplazarse por los valores reales del tenant. En produccion estas mismas
> llamadas se realizan desde el codigo del backend (ver seccion 10.8).

### 20.1 curl base de alta

```bash
curl -X POST "http://localhost:3000/datos" \
  -H "X-API-Key: tenant-int-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "datoId":"REG-001",
    "tipo":"registro_externo",
    "payload":{
      "schemaVersion":"v1",
      "estado":"activo"
    }
  }'
```

### 20.2 curl base de historial

```bash
curl -H "X-API-Key: tenant-lect-2026" \
  "http://localhost:3000/datos/REG-001/historial"
```

### 20.3 curl base de restauracion

```bash
curl -X POST "http://localhost:3000/datos/REG-001/restaurar" \
  -H "X-API-Key: tenant-admin-2026" \
  -H "Content-Type: application/json" \
  -d '{"txId":"TXID_A_RESTAURAR"}'
```

---

## Nota final

Este manual establece como estandar de integracion para nuevos tenants el modelo multi-tenant generico sobre `/datos/*`, enfocado en integradores externos que conectan su propio sistema al BaaS.
