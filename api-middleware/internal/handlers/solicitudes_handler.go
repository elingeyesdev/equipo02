package handlers

// Handlers del flujo de aprobación. Un integrador propone cambios que quedan
// como solicitudes PENDIENTES (ver dato_handler.go). Un admin del mismo tenant
// las consulta y las aprueba (se escribe en la cadena) o las rechaza.

import (
	"api-middleware/internal/aprobaciones"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/pkg/models"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type entradaResolucion struct {
	Motivo string `json:"motivo"`
}

// ListarSolicitudes devuelve las solicitudes del tenant. Filtro opcional por
// estado con ?estado=pendiente|aprobada|rechazada.
func ListarSolicitudes(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	estado := aprobaciones.Estado(strings.TrimSpace(c.Query("estado")))
	items := aprobaciones.Default.Listar(tenantID, estado)
	c.JSON(http.StatusOK, gin.H{
		"ok":          true,
		"codigo":      "CONSULTA_EXITOSA",
		"mensaje":     "Solicitudes del tenant",
		"solicitudes": items,
	})
}

// ConsultarSolicitud devuelve una solicitud por id.
func ConsultarSolicitud(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	id := strings.TrimSpace(c.Param("solicitudId"))
	sol, ok := aprobaciones.Default.Obtener(tenantID, id)
	if !ok {
		c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": sol})
}

// AprobarSolicitud confirma el cambio propuesto: ejecuta la operación en la
// cadena y marca la solicitud como aprobada. Solo admin (ver routes.go).
func AprobarSolicitud(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	id := strings.TrimSpace(c.Param("solicitudId"))
	sol, ok := aprobaciones.Default.Obtener(tenantID, id)
	if !ok {
		c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada"})
		return
	}
	if sol.Estado != aprobaciones.Pendiente {
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "SOLICITUD_RESUELTA", Mensaje: "La solicitud ya fue resuelta (estado=" + string(sol.Estado) + ")"})
		return
	}

	res, desde, err := ejecutarOperacionSolicitud(tenantID, sol)
	if err != nil {
		// No se resuelve la solicitud si la cadena falla; queda pendiente.
		renderErrorOperacion(c, err)
		return
	}

	aprobador, _ := actorDesdeContexto(c)
	actualizada, errResolver := aprobaciones.Default.Resolver(tenantID, id, aprobaciones.Aprobada, aprobador, "", res.TxID)
	if errResolver != nil {
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "SOLICITUD_RESUELTA", Mensaje: errResolver.Error()})
		return
	}

	publicarNotificacion(c,
		eventoPorOperacion(sol.Operacion),
		sol.DatoID,
		res.TxID,
		fmt.Sprintf("Solicitud %s aprobada por %q (op=%s sobre %q)", sol.ID, aprobador, sol.Operacion, sol.DatoID),
	)
	_ = desde
	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"estado":    "aprobada",
		"txId":      res.TxID,
		"mensaje":   "Solicitud aprobada y confirmada en la Blockchain",
		"solicitud": actualizada,
	})
}

// RechazarSolicitud descarta el cambio propuesto sin tocar la cadena.
func RechazarSolicitud(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	id := strings.TrimSpace(c.Param("solicitudId"))

	var in entradaResolucion
	_ = c.ShouldBindJSON(&in) // motivo opcional

	aprobador, _ := actorDesdeContexto(c)
	actualizada, err := aprobaciones.Default.Resolver(tenantID, id, aprobaciones.Rechazada, aprobador, strings.TrimSpace(in.Motivo), "")
	if err != nil {
		if _, ok := aprobaciones.Default.Obtener(tenantID, id); !ok {
			c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada"})
			return
		}
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "SOLICITUD_RESUELTA", Mensaje: err.Error()})
		return
	}

	publicarNotificacion(c,
		notificador.EventoSolicitudResuelta,
		actualizada.DatoID,
		"",
		fmt.Sprintf("Solicitud %s rechazada por %q", actualizada.ID, aprobador),
	)
	c.JSON(http.StatusOK, gin.H{
		"ok":        true,
		"estado":    "rechazada",
		"mensaje":   "Solicitud rechazada. No se escribió nada en la Blockchain.",
		"solicitud": actualizada,
	})
}

// ejecutarOperacionSolicitud ejecuta en la cadena el cambio de una solicitud.
func ejecutarOperacionSolicitud(tenantID string, sol aprobaciones.Solicitud) (*fabric.SubmitResult, string, error) {
	switch sol.Operacion {
	case aprobaciones.OpCrear:
		res, err := ejecutarCrearDato(tenantID, sol.DatoID, sol.TipoDato, sol.Payload)
		return res, "", err
	case aprobaciones.OpActualizar:
		res, err := ejecutarActualizarDato(tenantID, sol.DatoID, sol.TipoDato, sol.Payload)
		return res, "", err
	case aprobaciones.OpEliminar:
		res, err := ejecutarEliminarDato(tenantID, sol.DatoID)
		return res, "", err
	case aprobaciones.OpRestaurar:
		return ejecutarRestaurarDato(tenantID, sol.DatoID, sol.TxIDOrigen)
	default:
		return nil, "", &opError{HTTP: http.StatusInternalServerError, Codigo: "OPERACION_DESCONOCIDA", Mensaje: "Operación de solicitud no soportada"}
	}
}

func eventoPorOperacion(op aprobaciones.Operacion) string {
	switch op {
	case aprobaciones.OpCrear:
		return notificador.EventoDatoCreado
	case aprobaciones.OpActualizar:
		return notificador.EventoDatoEditado
	case aprobaciones.OpEliminar:
		return notificador.EventoDatoEliminado
	case aprobaciones.OpRestaurar:
		return notificador.EventoDatoRestaurado
	default:
		return notificador.EventoSolicitudResuelta
	}
}
