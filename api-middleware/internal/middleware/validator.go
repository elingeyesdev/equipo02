package middleware

import (
	"api-middleware/pkg/models"
	"context"
	"log"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-gonic/gin"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

func logOpenAPILoaded(doc *openapi3.T, absSpec string) {
	type opLine struct {
		method, path string
	}
	var lines []opLine
	for urlPath, item := range doc.Paths.Map() {
		if item == nil {
			continue
		}
		for method := range item.Operations() {
			u := strings.ToUpper(strings.TrimSpace(method))
			if u == "" {
				continue
			}
			lines = append(lines, opLine{method: u, path: urlPath})
		}
	}
	sort.Slice(lines, func(i, j int) bool {
		if lines[i].path != lines[j].path {
			return lines[i].path < lines[j].path
		}
		return lines[i].method < lines[j].method
	})
	log.Printf("[OpenAPI] especificación cargada (absoluto): %s", absSpec)
	log.Printf("[OpenAPI] operaciones (%d):", len(lines))
	for _, l := range lines {
		log.Printf("[OpenAPI]   %s %s", l.method, l.path)
	}
}

// OapiValidator configura el middleware que valida las peticiones contra el openapi.yaml.
func OapiValidator(specPath string) gin.HandlerFunc {
	absSpec, err := filepath.Abs(specPath)
	if err != nil {
		panic("OpenAPI: no se pudo resolver la ruta del spec: " + err.Error())
	}
	// 1. Cargar el esquema OpenAPI
	swagger, err := openapi3.NewLoader().LoadFromFile(absSpec)
	if err != nil {
		panic("Error al cargar openapi.yaml (" + absSpec + "): " + err.Error())
	}
	if err := swagger.Validate(context.Background()); err != nil {
		panic("OpenAPI: validación del documento falló (" + absSpec + "): " + err.Error())
	}
	logOpenAPILoaded(swagger, absSpec)

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
	// /auditoria y /api/auditoria se omiten: kin-openapi + gorilla/mux pueden fallar si el spec o el path visto por el servidor no coinciden (p. ej. prefijo /api sin rewrite).
	return func(c *gin.Context) {
		if omitirValidacionOpenAPI(c.Request.URL.Path) {
			c.Next()
			return
		}
		inner(c)
	}
}

// omitirValidacionOpenAPI evita kin-openapi en rutas operativas que no deben bloquearse por el contrato cargado.
// Incluye /api/auditoria/… por si el backend recibe el prefijo /api sin rewrite (p. ej. proxy distinto al de Vite).
func omitirValidacionOpenAPI(raw string) bool {
	p := path.Clean("/" + strings.TrimPrefix(strings.TrimSpace(raw), "/"))
	low := strings.ToLower(p)
	if strings.HasPrefix(low, "/admin") {
		return true
	}
	if strings.HasPrefix(low, "/auditoria/") || strings.HasPrefix(low, "/api/auditoria/") {
		return true
	}
	// /datos/* es la API genérica multi-tenant (dato_cc). El payload es JSON
	// libre por diseño, por lo que se valida en el handler en vez de en el
	// contrato OpenAPI.
	if low == "/datos" || strings.HasPrefix(low, "/datos/") {
		return true
	}
	// /solicitudes/* es el flujo de aprobación (modelo genérico). Se valida en
	// el handler, igual que /datos.
	if low == "/solicitudes" || strings.HasPrefix(low, "/solicitudes/") {
		return true
	}
	return false
}
