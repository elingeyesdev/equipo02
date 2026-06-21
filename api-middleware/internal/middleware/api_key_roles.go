package middleware

import (
	"api-middleware/internal/fabric"
	"api-middleware/internal/tenants"
	"api-middleware/pkg/models"
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	// HeaderXAPIKey es la cabecera de credencial para la API pública (hito 2.6).
	HeaderXAPIKey = "X-API-Key"

	// ContextAPIRole guarda el rol resuelto tras XAPIKeyAuth (admin | integrador | solo_lectura).
	ContextAPIRole = "api_role"

	// ContextAPITenant guarda el tenant resuelto a partir de la API key (multi-tenant).
	ContextAPITenant = "api_tenant"

	RoleAdmin        = tenants.RoleAdmin
	RoleIntegrador   = tenants.RoleIntegrador
	RoleSoloLectura  = tenants.RoleSoloLectura
	envAPIKeyAdmin   = "API_KEY_ADMIN"
	envAPIKeyIntegr  = "API_KEY_INTEGRADOR"
	envAPIKeyLectura = "API_KEY_SOLO_LECTURA"
)

// XAPIKeyAuth valida la cabecera X-API-Key. Resuelve el tenant y el rol:
//  1. Si hay un registro multi-tenant cargado, se busca la key allí.
//  2. Si no, se cae al comportamiento legacy (comparación contra env vars),
//     asignando el tenant por defecto (clientes).
func XAPIKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		recibida := strings.TrimSpace(c.GetHeader(HeaderXAPIKey))
		if recibida == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.RespuestaError{
				Ok:      false,
				Codigo:  "CREDENCIAL_AUSENTE",
				Mensaje: "credencial ausente: se requiere la cabecera " + HeaderXAPIKey,
			})
			return
		}

		tenantID, role := resolveTenantAndRole(recibida)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, models.RespuestaError{
				Ok:      false,
				Codigo:  "CREDENCIAL_INVALIDA",
				Mensaje: "credencial inválida: la API key no es reconocida",
			})
			return
		}

		c.Set(ContextAPIRole, role)
		c.Set(ContextAPITenant, tenantID)
		c.Next()
	}
}

// RequireTenants impide que la petición continúe si el tenant en contexto no
// está en la lista permitida. Si la lista está vacía no restringe nada.
// Pensado para rutas que solo aplican a un tenant concreto (p. ej. /clientes/*
// es del tenant base "clientes"; un cliente externo no debe poder usar esas
// rutas porque su modelo de datos puede ser distinto).
func RequireTenants(allowed ...string) gin.HandlerFunc {
	allow := make(map[string]struct{}, len(allowed))
	for _, t := range allowed {
		allow[strings.TrimSpace(t)] = struct{}{}
	}
	return func(c *gin.Context) {
		if len(allow) == 0 {
			c.Next()
			return
		}
		v, ok := c.Get(ContextAPITenant)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.RespuestaError{
				Ok:      false,
				Codigo:  "CREDENCIAL_AUSENTE",
				Mensaje: "credencial ausente: se requiere la cabecera " + HeaderXAPIKey,
			})
			return
		}
		tenant, _ := v.(string)
		if _, ok := allow[tenant]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, models.RespuestaError{
				Ok:      false,
				Codigo:  "TENANT_NO_AUTORIZADO",
				Mensaje: "esta ruta no está disponible para el tenant asociado a esta credencial",
			})
			return
		}
		c.Next()
	}
}

// RequireAPIRoles exige que el rol en contexto (tras XAPIKeyAuth) esté en la lista permitida.
func RequireAPIRoles(allowed ...string) gin.HandlerFunc {
	allow := make(map[string]struct{}, len(allowed))
	for _, r := range allowed {
		allow[r] = struct{}{}
	}
	return func(c *gin.Context) {
		v, ok := c.Get(ContextAPIRole)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.RespuestaError{
				Ok:      false,
				Codigo:  "CREDENCIAL_AUSENTE",
				Mensaje: "credencial ausente: se requiere la cabecera " + HeaderXAPIKey,
			})
			return
		}
		role, _ := v.(string)
		if _, ok := allow[role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, models.RespuestaError{
				Ok:      false,
				Codigo:  "ACCESO_DENEGADO",
				Mensaje: "acceso denegado: el rol no tiene permiso para esta operación",
			})
			return
		}
		c.Next()
	}
}

// RolFromContext devuelve el rol resuelto por XAPIKeyAuth (admin | integrador |
// solo_lectura). Cadena vacía si no se resolvió.
func RolFromContext(c *gin.Context) string {
	if v, ok := c.Get(ContextAPIRole); ok {
		if s, ok2 := v.(string); ok2 {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// TenantFromContext devuelve el tenant resuelto por XAPIKeyAuth. Si no se
// encuentra, devuelve el tenant por defecto del registro o "clientes" como
// último recurso.
func TenantFromContext(c *gin.Context) string {
	if v, ok := c.Get(ContextAPITenant); ok {
		if s, ok2 := v.(string); ok2 && strings.TrimSpace(s) != "" {
			return s
		}
	}
	if reg := fabric.Registry(); reg != nil {
		return reg.Default
	}
	return tenants.DefaultTenantID
}

// resolveTenantAndRole prioriza el registro multi-tenant; si no resuelve,
// cae al comportamiento legacy basado en env vars.
func resolveTenantAndRole(apiKey string) (string, string) {
	if reg := fabric.Registry(); reg != nil {
		if match, ok := reg.Lookup(apiKey); ok {
			return match.TenantID, match.Rol
		}
	}
	if role := resolveRoleFromAPIKey(apiKey); role != "" {
		return defaultTenantID(), role
	}
	return "", ""
}

func defaultTenantID() string {
	if reg := fabric.Registry(); reg != nil && strings.TrimSpace(reg.Default) != "" {
		return reg.Default
	}
	return tenants.DefaultTenantID
}

func resolveRoleFromAPIKey(recibida string) string {
	type pair struct {
		env  string
		role string
	}
	pairs := []pair{
		{envAPIKeyAdmin, RoleAdmin},
		{envAPIKeyIntegr, RoleIntegrador},
		{envAPIKeyLectura, RoleSoloLectura},
	}
	for _, p := range pairs {
		esperada := strings.TrimSpace(os.Getenv(p.env))
		if esperada == "" {
			continue
		}
		if constantTimeEqual(recibida, esperada) {
			return p.role
		}
	}
	return ""
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
