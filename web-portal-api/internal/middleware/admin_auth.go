package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
)

// ContextAdminClaims es la clave Gin donde guardamos los claims del JWT
// admin tras una validación exitosa.
const (
	ContextAdminClaims = "admin_console_claims"
	scopeAdminConsole  = "admin-console"
)

// Revocador es la interfaz mínima que cumple RevocacionesMemoria. Se usa
// aquí para evitar acoplamiento con el paquete handlers.
type Revocador interface {
	Revocado(jti string) bool
}

// RequireAdminAuth valida el JWT de la Consola BaaS (scope admin-console).
func RequireAdminAuth(cfg config.Config, revoc Revocador) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO",
				Mensaje: "Se requiere iniciar sesión en la consola",
			})
			return
		}
		claims, err := auth.ParseToken(cfg.JWTSecret, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "TOKEN_INVALIDO",
				Mensaje: "Sesión inválida o expirada",
			})
			return
		}
		if !strings.EqualFold(claims.Scope, scopeAdminConsole) {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "SCOPE_INVALIDO",
				Mensaje: "Este token no permite acceder a la consola del puente",
			})
			return
		}
		if strings.TrimSpace(claims.Tenant) == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "TENANT_VACIO",
				Mensaje: "Token sin tenant asociado",
			})
			return
		}
		if revoc != nil && revoc.Revocado(claims.ID) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "SESION_INVALIDA",
				Mensaje: "Sesión cerrada. Inicie sesión nuevamente",
			})
			return
		}
		c.Set(ContextAdminClaims, claims)
		c.Next()
	}
}

// RequireAdminWriteRole bloquea integradores/lectura en endpoints write si
// se quieren restringir desde el BFF (el middleware ya hace la validación
// final, pero esto rechaza temprano para ahorrar viajes).
func RequireAdminWriteRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		v, ok := c.Get(ContextAdminClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Se requiere iniciar sesión",
			})
			return
		}
		cl, _ := v.(*auth.Claims)
		if cl == nil || strings.EqualFold(cl.Rol, "lectura") {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "ACCESO_DENEGADO",
				Mensaje: "Su perfil solo permite consultar información",
			})
			return
		}
		c.Next()
	}
}
