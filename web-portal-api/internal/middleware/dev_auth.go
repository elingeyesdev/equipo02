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
	ContextDevClaims = "dev_portal_claims"
	scopeDevPortal   = "dev-portal"
)

// RequireDevAuth valida JWT con scope dev-portal.
func RequireDevAuth(cfg config.Config, revoc Revocador) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO",
				Mensaje: "Inicia sesión en el dev portal",
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
		if !strings.EqualFold(claims.Scope, scopeDevPortal) {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "SCOPE_INVALIDO",
				Mensaje: "Token no válido para el dev portal",
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
		c.Set(ContextDevClaims, claims)
		c.Next()
	}
}

// OptionalDevAuth adjunta claims si hay token válido; no aborta si falta.
func OptionalDevAuth(cfg config.Config, revoc Revocador) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			c.Next()
			return
		}
		claims, err := auth.ParseToken(cfg.JWTSecret, token)
		if err != nil || !strings.EqualFold(claims.Scope, scopeDevPortal) {
			c.Next()
			return
		}
		if revoc != nil && revoc.Revocado(claims.ID) {
			c.Next()
			return
		}
		c.Set(ContextDevClaims, claims)
		c.Next()
	}
}

func DevClaimsFromContext(c *gin.Context) (*auth.Claims, bool) {
	v, ok := c.Get(ContextDevClaims)
	if !ok {
		return nil, false
	}
	cl, ok := v.(*auth.Claims)
	return cl, ok
}
