package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
)

const (
	ContextPlatformClaims = "platform_admin_claims"
	scopePlatformAdmin    = "platform-admin"
)

// RequirePlatformAuth valida JWT con scope platform-admin.
func RequirePlatformAuth(cfg config.Config, revoc Revocador) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO",
				Mensaje: "Se requiere sesión de operador de plataforma",
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
		if !strings.EqualFold(claims.Scope, scopePlatformAdmin) {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "SCOPE_INVALIDO",
				Mensaje: "Este token no permite operar la plataforma BaaS",
			})
			return
		}
		if revoc != nil && revoc.Revocado(claims.ID) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "SESION_INVALIDA",
				Mensaje: "Sesión cerrada",
			})
			return
		}
		c.Set(ContextPlatformClaims, claims)
		c.Next()
	}
}
