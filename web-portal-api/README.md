# web-portal-api

Backend For Frontend (BFF) de la **Consola BaaS** (`web-cliente-demo`).

- Autenticación JWT contra cuentas en `config/usuarios-admin.yaml` (multi-tenant).
- SQLite solo para sesiones admin (`admin_sessions`); no almacena datos de negocio.
- Proxy genérico `/admin/api/*` hacia `api-middleware`: el navegador nunca ve la `X-API-Key`.
  Desde la consola se accede a `/datos`, `/solicitudes`, `/auditoria/*`, etc.

## Variables

Copiar `.env.example` a `.env` en esta carpeta.

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del BFF (default `3001`) |
| `JWT_SECRET` | Secreto para firmar JWT |
| `API_MIDDLEWARE_URL` | URL del api-middleware (default `http://127.0.0.1:3000`) |
| `USUARIOS_ADMIN_FILE` | Ruta al YAML de cuentas y API keys por tenant/rol |

Las `X-API-Key` por tenant/rol se declaran en `config/usuarios-admin.yaml` y deben coincidir con `tenants.yaml` del middleware.

## Levantar

```bash
cd web-portal-api
go mod tidy
go run ./cmd/server
```

Puerto por defecto: **3001**.

El frontend (Vite) reenvía `/api/*` al BFF; las peticiones de datos van a `/api/admin/api/datos`, etc.

## Usuarios demo

Ver comentarios en `config/usuarios-admin.yaml` (tenants **agricultura** y **salud**).

Generar hash de contraseña:

```bash
go run ./cmd/bcrypt-gen "mi-contrasena"
```

## Endpoints públicos del BFF

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/admin/auth/login` | Login consola |
| GET | `/admin/auth/me` | Perfil JWT |
| POST | `/admin/auth/logout` | Cerrar sesión |
| ANY | `/admin/api/*` | Proxy al middleware (datos, solicitudes, auditoría…) |
