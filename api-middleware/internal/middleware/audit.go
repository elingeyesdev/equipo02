package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode"

	"api-middleware/internal/bitacora"

	"github.com/gin-gonic/gin"
)

const (
	// ContextOperacionIDKey identificador único de la petición en el contexto Gin.
	ContextOperacionIDKey = "operacion_id"

	headerCorrelation = "X-Correlation-Id"
	headerActorAudit  = "X-Actor-Id"
)

// OperacionIDDesdeContexto devuelve el id de operación asignado por AuditOperaciones, o cadena vacía.
func OperacionIDDesdeContexto(c *gin.Context) string {
	if v, ok := c.Get(ContextOperacionIDKey); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// AuditOperaciones asigna operacionId, cabecera X-Operacion-Id, bitácora de solicitud y de resultado final.
// Debe registrarse de forma global (p. ej. en main) para envolver toda la API.
func AuditOperaciones() gin.HandlerFunc {
	return func(c *gin.Context) {
		opID := nuevoOperacionID(c)
		c.Set(ContextOperacionIDKey, opID)
		c.Writer.Header().Set("X-Operacion-Id", opID)

		rutaEntrada := c.Request.URL.Path
		actor := truncar(strings.TrimSpace(c.GetHeader(headerActorAudit)), 256)

		bitacora.RegistrarSolicitudRecibida(bitacora.EntradaBitacoraSolicitud{
			OperacionID: opID,
			Metodo:      c.Request.Method,
			Ruta:        rutaEntrada,
			Remoto:      c.ClientIP(),
			UserAgent:   truncar(c.Request.UserAgent(), 512),
			Actor:       actor,
		})

		t0 := time.Now()
		c.Next()
		dur := time.Since(t0).Milliseconds()

		rol := ""
		if v, ok := c.Get(ContextAPIRole); ok {
			if s, ok := v.(string); ok {
				rol = s
			}
		}

		st := c.Writer.Status()
		if st == 0 {
			st = http.StatusOK
		}
		rutaSalida := c.FullPath()
		if rutaSalida == "" {
			rutaSalida = c.Request.URL.Path
		}

		res, det := clasificarResultadoHTTP(st)
		if rol != "" {
			det = strings.TrimSpace(det + " rol=" + rol)
		}

		bitacora.RegistrarResultadoOperacion(bitacora.EntradaBitacoraResultado{
			OperacionID: opID,
			Metodo:      c.Request.Method,
			Ruta:        rutaSalida,
			CodigoHTTP:  st,
			DuracionMs:  dur,
			Resultado:   res,
			Detalle:     det,
		})
	}
}

func nuevoOperacionID(c *gin.Context) string {
	if corr := strings.TrimSpace(c.GetHeader(headerCorrelation)); corr != "" && len(corr) <= 128 && correlationSegura(corr) {
		return corr
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("op-%d", time.Now().UnixNano())
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}

func correlationSegura(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || (!unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_' && r != '.') {
			return false
		}
	}
	return true
}

func truncar(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func clasificarResultadoHTTP(status int) (resultado string, detalle string) {
	switch {
	case status >= 200 && status < 300:
		return "exito", ""
	case status == http.StatusBadRequest || status == http.StatusUnprocessableEntity:
		return "error_validacion", "respuesta 4xx de validación de entrada o contrato"
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return "error_credencial", "401/403 autenticación o autorización"
	case status >= 400 && status < 500:
		return "error_cliente", fmt.Sprintf("código HTTP %d", status)
	case status == http.StatusBadGateway || status == http.StatusServiceUnavailable || status == http.StatusGatewayTimeout:
		return "error_conexion_upstream", "502/503/504 red Fabric o dependencia"
	case status >= 500:
		return "error_servidor", fmt.Sprintf("código HTTP %d", status)
	default:
		return "desconocido", fmt.Sprintf("código HTTP %d", status)
	}
}
