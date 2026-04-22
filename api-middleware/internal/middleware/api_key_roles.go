package middleware

import (
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

	RoleAdmin        = "admin"
	RoleIntegrador   = "integrador"
	RoleSoloLectura  = "solo_lectura"
	envAPIKeyAdmin   = "API_KEY_ADMIN"
	envAPIKeyIntegr  = "API_KEY_INTEGRADOR"
	envAPIKeyLectura = "API_KEY_SOLO_LECTURA"
)

// XAPIKeyAuth valida la cabecera X-API-Key frente a variables de entorno y fija el rol en el contexto Gin.
// Orden de resolución si hubiera colisión de valor: admin, integrador, solo_lectura.
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

		role := resolveRoleFromAPIKey(recibida)
		if role == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, models.RespuestaError{
				Ok:      false,
				Codigo:  "CREDENCIAL_INVALIDA",
				Mensaje: "credencial inválida: la API key no es reconocida",
			})
			return
		}

		c.Set(ContextAPIRole, role)
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
