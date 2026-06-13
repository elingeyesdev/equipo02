package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"api-middleware/internal/bitacora"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/pkg/models"

	"github.com/gin-gonic/gin"
)

var isoDateOnly = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// ListarAuditoriaHTTP (GET /auditoria/http) devuelve la bitácora retenida en memoria (solicitud/resultado HTTP, chaincode, eventos, conexión).
// Correlación: las entradas BITACORA_SOLICITUD y BITACORA_RESULTADO comparten el mismo `operacionId` que la cabecera `X-Operacion-Id`.
func ListarAuditoriaHTTP(c *gin.Context) {
	limite, desde, hasta := parseAuditoriaQuery(c)
	lineas := bitacora.ObtenerLineasAuditoriaMemoria(limite, desde, hasta)
	c.JSON(http.StatusOK, models.RespuestaLectura{
		Ok:      true,
		Codigo:  "CONSULTA_EXITOSA",
		Mensaje: "Bitácora del puente (memoria). Exportación persistente opcional vía CHAINCODE_BITACORA_FILE en el proceso del middleware.",
		Datos: map[string]interface{}{
			"lineas": lineas,
			"total":  len(lineas),
			"nota": "Solo RAM del proceso: reiniciar el servidor vacía el buffer. " +
				"Para eventos de ledger en vivo use GET /eventos/historial o /eventos/stream.",
		},
	})
}

// ListarAuditoriaCombinada (GET /auditoria/combinada) une bitácora HTTP (memoria) y últimos eventos normalizados de chaincode.
func ListarAuditoriaCombinada(c *gin.Context) {
	limite, desde, hasta := parseAuditoriaQuery(c)
	httpLines := bitacora.ObtenerLineasAuditoriaMemoria(limite, desde, hasta)
	eventos := filtrarEventosPorTiempo(
		fabric.GlobalEventBroker.GetHistorialPorTenant(middleware.TenantFromContext(c)),
		desde,
		hasta,
	)
	c.JSON(http.StatusOK, models.RespuestaLectura{
		Ok:      true,
		Codigo:  "CONSULTA_EXITOSA",
		Mensaje: "Vista combinada: bitácora del puente (HTTP/chaincode en memoria) + eventos de chaincode recientes.",
		Datos: map[string]interface{}{
			"httpPuente":      httpLines,
			"eventosCadena":   eventos,
			"totalHttp":       len(httpLines),
			"totalEventos":    len(eventos),
			"correlacionHint": "operacionId enlaza solicitud y resultado HTTP; compare con cabecera X-Operacion-Id en trazas externas.",
		},
	})
}

func parseAuditoriaQuery(c *gin.Context) (limite int, desde, hasta *time.Time) {
	limite = 100
	if v := strings.TrimSpace(c.Query("limite")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limite = n
		}
	}
	if t, ok := parseTimeQuery(c.Query("desde"), false); ok {
		desde = &t
	}
	if t, ok := parseTimeQuery(c.Query("hasta"), true); ok {
		hasta = &t
	}
	return limite, desde, hasta
}

func filtrarEventosPorTiempo(eventos []fabric.EventoNormalizado, desde, hasta *time.Time) []fabric.EventoNormalizado {
	if desde == nil && hasta == nil {
		return eventos
	}
	out := make([]fabric.EventoNormalizado, 0, len(eventos))
	for _, ev := range eventos {
		t := ev.Timestamp.UTC()
		if desde != nil && t.Before(desde.UTC()) {
			continue
		}
		if hasta != nil && t.After(hasta.UTC()) {
			continue
		}
		out = append(out, ev)
	}
	return out
}

func parseTimeQuery(s string, endOfDayIfDateOnly bool) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}
	if endOfDayIfDateOnly && isoDateOnly.MatchString(s) {
		if t, err := time.ParseInLocation("2006-01-02", s, time.UTC); err == nil {
			return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999_999_999, time.UTC), true
		}
	}
	if !endOfDayIfDateOnly && isoDateOnly.MatchString(s) {
		if t, err := time.ParseInLocation("2006-01-02", s, time.UTC); err == nil {
			return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), true
		}
	}
	layouts := []string{time.RFC3339, time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}
