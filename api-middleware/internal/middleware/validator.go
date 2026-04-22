package middleware

import (
	"api-middleware/pkg/models"
	"context"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

// OapiValidator configura el middleware que valida las peticiones contra el openapi.yaml.
func OapiValidator(specPath string) gin.HandlerFunc {
	// 1. Cargar el esquema OpenAPI
	swagger, err := openapi3.NewLoader().LoadFromFile(specPath)
	if err != nil {
		panic("Error al cargar openapi.yaml: " + err.Error())
	}

	// 2. Definir opciones personalizadas para el validador
	options := &ginmiddleware.Options{
		SilenceServersWarning: true,
		ErrorHandler: func(c *gin.Context, message string, statusCode int) {
			// Personalizamos la respuesta para que use nuestro modelo RespuestaError
			c.JSON(statusCode, models.RespuestaError{
				Ok:      false,
				Codigo:  "ERROR_VALIDACION_OPENAPI",
				Mensaje: "La petición no cumple con el contrato: " + message,
			})
			c.Abort()
		},
		// Las operaciones declaran security ApiKeyAuth; kin-openapi exige AuthenticationFunc.
		// La comprobación real de API key y roles la aplican XAPIKeyAuth / RequireAPIRoles en routes.
		Options: openapi3filter.Options{
			AuthenticationFunc: func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
				return nil
			},
		},
	}

	inner := ginmiddleware.OapiRequestValidatorWithOptions(swagger, options)

	// Las rutas bajo /admin/ no forman parte del contrato OpenAPI público; se omiten aquí de forma explícita.
	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/admin/") {
			c.Next()
			return
		}
		inner(c)
	}
}
