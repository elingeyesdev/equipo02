package middleware

import (
	"api-middleware/pkg/models"
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const headerAdminAPIKey = "X-Admin-Api-Key"

// AdminAPIKey exige coincidencia con la variable de entorno ADMIN_API_KEY (rutas /admin/...).
func AdminAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		esperada := strings.TrimSpace(os.Getenv("ADMIN_API_KEY"))
		if esperada == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, models.RespuestaError{
				Ok:      false,
				Codigo:  "CONFIGURACION",
				Mensaje: "La API administrativa requiere ADMIN_API_KEY configurada en el servidor",
			})
			return
		}
		recibida := strings.TrimSpace(c.GetHeader(headerAdminAPIKey))
		if len(recibida) != len(esperada) || subtle.ConstantTimeCompare([]byte(recibida), []byte(esperada)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, models.RespuestaError{
				Ok:      false,
				Codigo:  "PROHIBIDO",
				Mensaje: "Credencial administrativa inválida o ausente (cabecera " + headerAdminAPIKey + ")",
			})
			return
		}
		c.Next()
	}
}
