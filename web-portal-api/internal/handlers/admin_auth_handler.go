// Handlers de autenticación para la Consola BaaS (web-cliente-demo).
// Valida contra el registro YAML usuariosadmin (multi-tenant).
//
// Los tokens emitidos llevan scope="admin-console" + tenant.
package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
	"web-portal-api/internal/usuariosadmin"
)

// ScopeAdminConsole es el valor del claim "scope" de los tokens emitidos
// para la consola del puente.
const ScopeAdminConsole = "admin-console"

// AdminAuthHandler agrupa los endpoints /admin/auth/*.
type AdminAuthHandler struct {
	Cfg      config.Config
	Registro *usuariosadmin.Registry
	Revocador AdminRevocador
}

// AdminRevocador abstrae la persistencia de sesiones de la consola admin.
type AdminRevocador interface {
	RegistrarSesion(userID, jti string, exp time.Time) error
	Revocar(jti string) error
	Revocado(jti string) bool
}

// RevocacionesPersistentes guarda JTI en SQLite usando la tabla sessions
// existente del BFF. Esto evita que un reinicio del proceso reactive tokens.
type RevocacionesPersistentes struct {
	DB *sql.DB
}

func NuevaRevocacionesPersistentes(db *sql.DB) *RevocacionesPersistentes {
	return &RevocacionesPersistentes{DB: db}
}

func (r *RevocacionesPersistentes) RegistrarSesion(userID, jti string, exp time.Time) error {
	_, err := r.DB.Exec(
		`INSERT INTO admin_sessions (id, username, jti, expires_at) VALUES (?, ?, ?, ?)`,
		uuid.NewString(), userID, jti, exp.UTC().Format(time.RFC3339),
	)
	return err
}

func (r *RevocacionesPersistentes) Revocar(jti string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.Exec(`UPDATE admin_sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL`, now, jti)
	return err
}

func (r *RevocacionesPersistentes) Revocado(jti string) bool {
	var revoked sql.NullString
	var expires string
	err := r.DB.QueryRow(`SELECT revoked_at, expires_at FROM admin_sessions WHERE jti = ?`, jti).Scan(&revoked, &expires)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true
		}
		log.Printf("admin auth: error verificando sesión %s: %v", jti, err)
		return true
	}
	if revoked.Valid && strings.TrimSpace(revoked.String) != "" {
		return true
	}
	exp, err := time.Parse(time.RFC3339, expires)
	if err != nil {
		log.Printf("admin auth: error verificando sesión %s: %v", jti, err)
		// Fail closed: ante error de sesión tratamos el token como inválido.
		return true
	}
	return !time.Now().UTC().Before(exp)
}

// UsuarioAdminPublico es el shape devuelto al frontend (sin hash).
type UsuarioAdminPublico struct {
	Usuario        string `json:"usuario"`
	NombreCompleto string `json:"nombreCompleto"`
	Rol            string `json:"rol"`
	Tenant         string `json:"tenant"`
}

type LoginAdminResponse struct {
	Ok      bool                 `json:"ok"`
	Token   string               `json:"token"`
	Usuario UsuarioAdminPublico  `json:"usuario"`
}

type MeAdminResponse struct {
	Ok      bool                `json:"ok"`
	Usuario UsuarioAdminPublico `json:"usuario"`
}

// AdminClaimsFromContext recupera el JWT decodificado del contexto Gin.
func AdminClaimsFromContext(c *gin.Context) (*auth.Claims, bool) {
	v, ok := c.Get("admin_console_claims")
	if !ok {
		return nil, false
	}
	cl, ok := v.(*auth.Claims)
	return cl, ok
}

// Login valida usuario+contraseña contra el YAML y emite un JWT.
func (h *AdminAuthHandler) Login(c *gin.Context) {
	if h.Registro == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Ok: false, Codigo: "ADMIN_NO_CONFIGURADO",
			Mensaje: "El BFF no tiene configurado el módulo de consola admin",
		})
		return
	}
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION",
			Mensaje: "Usuario y contraseña son obligatorios",
		})
		return
	}
	u, err := h.Registro.Autenticar(req.Username, req.Password)
	if err != nil {
		switch err {
		case usuariosadmin.ErrUsuarioInactivo:
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "USUARIO_INACTIVO",
				Mensaje: "Cuenta deshabilitada",
			})
		case usuariosadmin.ErrConfiguracionAusente:
			c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
				Ok: false, Codigo: "ADMIN_NO_CONFIGURADO",
				Mensaje: "Sin configuración de usuarios admin",
			})
		default:
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "CREDENCIALES_INVALIDAS",
				Mensaje: "Usuario o contraseña incorrectos",
			})
		}
		return
	}
	jti := uuid.NewString()
	exp := h.Cfg.JWTExpiry
	if exp == 0 {
		exp = 8 * time.Hour
	}
	expiresAt := time.Now().Add(exp)
	token, err := auth.IssueTokenExt(
		h.Cfg.JWTSecret,
		u.Usuario, u.Usuario, u.NombreCompleto, u.Rol,
		u.Tenant, ScopeAdminConsole, jti, exp,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO",
			Mensaje: "No se pudo emitir el token",
		})
		return
	}
	if h.Revocador != nil {
		if err := h.Revocador.RegistrarSesion(u.Usuario, jti, expiresAt); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Ok: false, Codigo: "ERROR_INTERNO",
				Mensaje: "No se pudo registrar la sesión",
			})
			return
		}
	}
	c.JSON(http.StatusOK, LoginAdminResponse{
		Ok:    true,
		Token: token,
		Usuario: UsuarioAdminPublico{
			Usuario:        u.Usuario,
			NombreCompleto: u.NombreCompleto,
			Rol:            u.Rol,
			Tenant:         u.Tenant,
		},
	})
}

// Me devuelve la identidad asociada al JWT actual.
func (h *AdminAuthHandler) Me(c *gin.Context) {
	cl, ok := AdminClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO",
			Mensaje: "Sesión no válida",
		})
		return
	}
	c.JSON(http.StatusOK, MeAdminResponse{
		Ok: true,
		Usuario: UsuarioAdminPublico{
			Usuario:        cl.Username,
			NombreCompleto: cl.NombreCompleto,
			Rol:            cl.Rol,
			Tenant:         cl.Tenant,
		},
	})
}

// Logout marca el JTI como revocado en almacenamiento persistente.
func (h *AdminAuthHandler) Logout(c *gin.Context) {
	cl, ok := AdminClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
		return
	}
	if h.Revocador != nil && cl.ID != "" {
		if err := h.Revocador.Revocar(cl.ID); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Ok: false, Codigo: "ERROR_INTERNO",
				Mensaje: "No se pudo cerrar la sesión",
			})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
}
