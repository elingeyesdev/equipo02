package handlers

import (
	"api-middleware/internal/bitacora"
	"api-middleware/internal/chaincodepolicy"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/pkg/models"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

const headerActor = "X-Actor-Id"

var (
	politicasCC   *chaincodepolicy.PoliticasCargadas
	politicasErr  error
	politicasOnce sync.Once
)

func cargarPoliticasChaincode() (*chaincodepolicy.PoliticasCargadas, error) {
	politicasOnce.Do(func() {
		politicasCC, politicasErr = chaincodepolicy.Cargar()
	})
	return politicasCC, politicasErr
}

// InvocarChaincodeIntegrador ejecuta evaluate|submit permitido para integradores (lista blanca en políticas).
func InvocarChaincodeIntegrador(c *gin.Context) {
	pc, err := cargarPoliticasChaincode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se pudieron cargar las políticas de chaincode: " + err.Error(),
		})
		return
	}
	invocarChaincodeConPoliticas(c, "integrador", pc.Integrador)
}

// InvocarChaincodeAdmin igual que el integrador pero con política ampliada y cabecera X-Admin-Api-Key.
func InvocarChaincodeAdmin(c *gin.Context) {
	pc, err := cargarPoliticasChaincode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se pudieron cargar las políticas de chaincode: " + err.Error(),
		})
		return
	}
	invocarChaincodeConPoliticas(c, "administracion", pc.Administracion)
}

func invocarChaincodeConPoliticas(c *gin.Context, audiencia string, reglas []chaincodepolicy.Regla) {
	var req models.SolicitudInvocacionChaincode
	if err := c.ShouldBindJSON(&req); err != nil {
		registrarBitacoraChaincode(c, audiencia, req, "error", http.StatusBadRequest, "VALIDACION", "", "JSON inválido: "+err.Error())
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: "Cuerpo JSON inválido: " + err.Error(),
		})
		return
	}

	modo := strings.ToLower(strings.TrimSpace(req.Modo))
	if modo != "evaluate" && modo != "submit" {
		registrarBitacoraChaincode(c, audiencia, req, "error", http.StatusBadRequest, "VALIDACION", "", "modo debe ser evaluate o submit")
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: "modo debe ser evaluate o submit",
		})
		return
	}

	if req.Parametros == nil {
		req.Parametros = []string{}
	}

	_, err := chaincodepolicy.BuscarRegla(reglas, req.Canal, req.Contrato, req.Funcion, modo, len(req.Parametros))
	if err != nil {
		registrarBitacoraChaincode(c, audiencia, req, "error", http.StatusForbidden, "POLITICA_NO_PERMITIDA", "", err.Error())
		c.JSON(http.StatusForbidden, models.RespuestaError{
			Ok:      false,
			Codigo:  "POLITICA_NO_PERMITIDA",
			Mensaje: "La combinación canal/contrato/función/modo/número de parámetros no está permitida para este perfil",
		})
		return
	}

	switch modo {
	case "evaluate":
		payload, err := fabric.EvaluateTransactionEnCanal(req.Canal, req.Contrato, req.Funcion, req.Parametros...)
		if err != nil {
			st, cod, pub := clasificarErrorFabric(err)
			registrarBitacoraChaincode(c, audiencia, req, "error", st, cod, "", err.Error())
			c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
			return
		}
		var datos interface{}
		if len(payload) == 0 {
			datos = nil
		} else if json.Unmarshal(payload, &datos) != nil {
			datos = string(payload)
		}
		registrarBitacoraChaincode(c, audiencia, req, "exito", http.StatusOK, "CONSULTA_EXITOSA", "", "")
		c.JSON(http.StatusOK, models.RespuestaLectura{
			Ok:      true,
			Codigo:  "CONSULTA_EXITOSA",
			Mensaje: "Invocación evaluate completada",
			Datos:   datos,
		})
	default: // submit
		res, err := fabric.InvokeTransactionWithTxIDEnCanal(req.Canal, req.Contrato, req.Funcion, req.Parametros...)
		if err != nil {
			st, cod, pub := clasificarErrorFabric(err)
			registrarBitacoraChaincode(c, audiencia, req, "error", st, cod, "", err.Error())
			c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
			return
		}
		registrarBitacoraChaincode(c, audiencia, req, "exito", http.StatusOK, "TRANSACCION_OK", res.TxID, "")
		c.JSON(http.StatusOK, models.RespuestaExitoTx{
			Ok:      true,
			TxId:    res.TxID,
			Mensaje: "Invocación submit confirmada en el ledger",
		})
	}
}

func actorDesdeCabecera(c *gin.Context, audiencia string) string {
	if v := strings.TrimSpace(c.GetHeader(headerActor)); v != "" {
		return v
	}
	if audiencia == "administracion" {
		return "admin-api"
	}
	return "integrador-api"
}

func registrarBitacoraChaincode(c *gin.Context, audiencia string, req models.SolicitudInvocacionChaincode, resultado string, httpCode int, codigoNegocio, txID, detalle string) {
	bitacora.RegistrarChaincode(bitacora.EntradaBitacoraChaincode{
		OperacionID:   middleware.OperacionIDDesdeContexto(c),
		Actor:         actorDesdeCabecera(c, audiencia),
		Audiencia:     audiencia,
		Canal:         req.Canal,
		Contrato:      req.Contrato,
		Funcion:       req.Funcion,
		Modo:          req.Modo,
		Resultado:     resultado,
		CodigoHTTP:    httpCode,
		CodigoNegocio: codigoNegocio,
		TxID:          txID,
		Mensaje:       detalle,
	})
}

func clasificarErrorFabric(err error) (status int, codigo string, mensajePublico string) {
	if err == nil {
		return http.StatusOK, "", ""
	}
	msg := err.Error()
	l := strings.ToLower(msg)
	if strings.Contains(l, "el gateway no está inicializado") {
		return http.StatusServiceUnavailable, "SERVICIO_NO_DISPONIBLE", "El acceso al ledger no está disponible en este momento."
	}
	if esErrorLedgerNoEncontrado(err) {
		return http.StatusNotFound, "NO_ENCONTRADO", "El recurso solicitado no existe en el ledger."
	}
	if strings.Contains(l, "deadline exceeded") || strings.Contains(l, "timeout") || strings.Contains(l, "timed out") {
		return http.StatusServiceUnavailable, "FABRIC_TIMEOUT", "Tiempo de espera agotado al comunicarse con Hyperledger Fabric."
	}
	if strings.Contains(l, "unavailable") || strings.Contains(l, "connection refused") || strings.Contains(l, "connection reset") {
		return http.StatusServiceUnavailable, "FABRIC_RED", "La red Fabric no respondió; reintente más tarde."
	}
	if strings.Contains(l, "endorsement") || strings.Contains(l, "endorse") || strings.Contains(l, "commit") ||
		strings.Contains(l, "no valid proposal") || strings.Contains(l, "mvcc_read_conflict") {
		return http.StatusBadGateway, "FABRIC_TRANSACCION", "Fabric no pudo validar o confirmar la transacción."
	}
	return http.StatusInternalServerError, "ERROR_FABRIC", "Error al ejecutar la operación en Fabric."
}

func esErrorLedgerNoEncontrado(err error) bool {
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "does not exist") ||
		strings.Contains(m, "not found") ||
		strings.Contains(m, "no existe") ||
		strings.Contains(m, "cannot read world state pair with key")
}
