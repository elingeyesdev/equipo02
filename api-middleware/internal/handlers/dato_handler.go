package handlers

// Handler genérico para el chaincode dato_cc. Está pensado para empresas
// externas (p. ej. Agricultura) que necesitan persistir cualquier estructura
// JSON en su propio canal Fabric de forma inmutable.
//
// El tenant se deduce de la cabecera X-API-Key (ver middleware.XAPIKeyAuth).
// El canal y el chaincode se toman de la configuración del tenant
// (config/tenants.yaml).
//
// Modelo conceptual:
//   {
//     "datoId":   string,       // clave única (obligatoria)
//     "tipo":     string,       // categoría libre (p. ej. "parcela", "cosecha")
//     "payload":  object|array, // JSON libre de negocio
//     "fechaCreacion":      ISO-8601 (rellenado por el chaincode si vacío)
//     "fechaActualizacion": ISO-8601
//   }

import (
	"api-middleware/internal/aprobaciones"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/pkg/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// opError es un error de negocio con código y estado HTTP públicos, usado por
// las funciones de ejecución para que tanto la vía directa (admin) como la vía
// de aprobación devuelvan el mismo mensaje.
type opError struct {
	HTTP    int
	Codigo  string
	Mensaje string
}

func (e *opError) Error() string { return e.Mensaje }

// esIntegrador indica si el actor de la petición tiene rol integrador (debe
// pasar por aprobación). El admin escribe directo; solo_lectura ni llega aquí.
func esIntegrador(c *gin.Context) bool {
	return middleware.RolFromContext(c) == middleware.RoleIntegrador
}

// actorDesdeContexto extrae usuario y nombre del actor desde las cabeceras que
// inyecta el BFF (X-Actor-*).
func actorDesdeContexto(c *gin.Context) (usuario, nombre string) {
	usuario = strings.TrimSpace(c.GetHeader("X-Actor-Username"))
	if usuario == "" {
		usuario = strings.TrimSpace(c.GetHeader("X-Actor-Id"))
	}
	if usuario == "" {
		usuario = "integrador"
	}
	nombre = strings.TrimSpace(c.GetHeader("X-Actor-Name"))
	return usuario, nombre
}

// crearSolicitudPendiente registra una propuesta de cambio y avisa al admin.
func crearSolicitudPendiente(c *gin.Context, op aprobaciones.Operacion, datoID, tipoDato string, payload json.RawMessage, txOrigen string) aprobaciones.Solicitud {
	usuario, nombre := actorDesdeContexto(c)
	sol := aprobaciones.Default.Crear(aprobaciones.Solicitud{
		Tenant:            middleware.TenantFromContext(c),
		Operacion:         op,
		DatoID:            datoID,
		TipoDato:          tipoDato,
		Payload:           payload,
		TxIDOrigen:        txOrigen,
		Solicitante:       usuario,
		SolicitanteNombre: nombre,
	})
	publicarNotificacion(c,
		notificador.EventoSolicitudCreada,
		datoID,
		"",
		fmt.Sprintf("Solicitud %s (op=%s) sobre %q pendiente de aprobación, creada por %q", sol.ID, op, datoID, usuario),
	)
	return sol
}

// responderSolicitudPendiente devuelve 202 indicando que el cambio quedó en cola.
func responderSolicitudPendiente(c *gin.Context, sol aprobaciones.Solicitud, accion string) {
	c.JSON(http.StatusAccepted, gin.H{
		"ok":          true,
		"estado":      "pendiente",
		"solicitudId": sol.ID,
		"operacion":   sol.Operacion,
		"mensaje":     accion + " recibida. Queda PENDIENTE de aprobación por un administrador del tenant.",
	})
}

// ejecutarCrearDato escribe un alta en la cadena (CreateDato).
func ejecutarCrearDato(tenantID, datoID, tipo string, payload json.RawMessage) (*fabric.SubmitResult, error) {
	return fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "CreateDato",
		strings.TrimSpace(datoID), strings.TrimSpace(tipo), string(payload))
}

// ejecutarActualizarDato escribe una edición en la cadena (UpdateDato).
func ejecutarActualizarDato(tenantID, datoID, tipo string, payload json.RawMessage) (*fabric.SubmitResult, error) {
	return fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "UpdateDato",
		strings.TrimSpace(datoID), strings.TrimSpace(tipo), string(payload))
}

// ejecutarEliminarDato borra del world state (DeleteDato). La historia persiste.
func ejecutarEliminarDato(tenantID, datoID string) (*fabric.SubmitResult, error) {
	return fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "DeleteDato", strings.TrimSpace(datoID))
}

type entradaDato struct {
	DatoID  string          `json:"datoId"`
	Tipo    string          `json:"tipo"`
	Payload json.RawMessage `json:"payload"`
}

type entradaRestaurarDato struct {
	TxID string `json:"txId"`
}

type historialDatoEntry struct {
	TxID      string          `json:"txId"`
	Timestamp string          `json:"timestamp"`
	IsDelete  bool            `json:"isDelete"`
	Record    json.RawMessage `json:"record"`
}

func validarEntradaDato(e entradaDato) error {
	if strings.TrimSpace(e.DatoID) == "" {
		return errors.New("datoId es obligatorio")
	}
	if strings.TrimSpace(e.Tipo) == "" {
		return errors.New("tipo es obligatorio")
	}
	if len(e.Payload) == 0 {
		return errors.New("payload es obligatorio (objeto o arreglo JSON)")
	}
	if !json.Valid(e.Payload) {
		return errors.New("payload no es JSON válido")
	}
	return nil
}

func buscarRevisionHistorial(entries []historialDatoEntry, txID string) *historialDatoEntry {
	needle := strings.TrimSpace(txID)
	if needle == "" {
		return nil
	}
	for i := range entries {
		if strings.TrimSpace(entries[i].TxID) == needle {
			return &entries[i]
		}
	}
	return nil
}

func inyectarMetaRestauracion(payload json.RawMessage, desdeTxID string) (json.RawMessage, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(payload, &m); err != nil {
		return nil, err
	}
	meta, ok := m["_baasMeta"].(map[string]interface{})
	if !ok || meta == nil {
		meta = map[string]interface{}{}
	}
	meta["restauradoDesdeTxId"] = strings.TrimSpace(desdeTxID)
	meta["restauradoEn"] = time.Now().UTC().Format(time.RFC3339)
	m["_baasMeta"] = meta
	return json.Marshal(m)
}

// CrearDato registra un nuevo activo genérico (CreateDato) en el canal del tenant.
func CrearDato(c *gin.Context) {
	var in entradaDato
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "JSON inválido: " + err.Error()})
		return
	}
	if err := validarEntradaDato(in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	datoID := strings.TrimSpace(in.DatoID)
	tipo := strings.TrimSpace(in.Tipo)

	tenantID := middleware.TenantFromContext(c)
	res, err := ejecutarCrearDato(tenantID, datoID, tipo, in.Payload)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoCreado,
		datoID,
		res.TxID,
		fmt.Sprintf("Dato %q (tipo=%s) registrado", datoID, tipo),
	)

	c.JSON(http.StatusCreated, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato registrado correctamente en la Blockchain",
	})
}

// ListarDatos devuelve todos los datos del canal del tenant (GetAllDatos).
func ListarDatos(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "GetAllDatos")
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaFabric(c, raw, "Listado de datos del canal del tenant"))
}

// ConsultarDato obtiene un dato por su id (ReadDato).
func ConsultarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "ReadDato", id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaFabric(c, raw, "Dato consultado"))
}

// ActualizarDato modifica un dato existente (UpdateDato).
func ActualizarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	var in entradaDato
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "JSON inválido: " + err.Error()})
		return
	}
	if in.DatoID == "" {
		in.DatoID = id
	}
	if in.DatoID != id {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "el datoId del path y el cuerpo no coinciden"})
		return
	}
	if err := validarEntradaDato(in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	tipo := strings.TrimSpace(in.Tipo)

	if esIntegrador(c) {
		tenantID := middleware.TenantFromContext(c)
		rawActual, errRead := fabric.EvaluateTransactionTenant(tenantID, "", "", "ReadDato", id)
		if errRead != nil {
			st, cod, pub := clasificarErrorFabric(errRead)
			c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
			return
		}
		actual, errPayload := payloadNegocioDesdeReadDato(rawActual)
		if errPayload != nil {
			c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FORMATO", Mensaje: "No se pudo leer el estado actual del dato"})
			return
		}
		nuevo, errNuevo := extraerPayloadNegocio(in.Payload)
		if errNuevo != nil {
			c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "Payload inválido: " + errNuevo.Error()})
			return
		}
		if !esAppendOnly(actual, nuevo) {
			sol := crearSolicitudPendiente(c, aprobaciones.OpActualizar, id, tipo, in.Payload, "")
			responderSolicitudPendiente(c, sol, "Edición")
			return
		}
	}

	tenantID := middleware.TenantFromContext(c)
	res, err := ejecutarActualizarDato(tenantID, id, tipo, in.Payload)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoEditado,
		id,
		res.TxID,
		fmt.Sprintf("Dato %q (tipo=%s) editado", id, tipo),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato actualizado correctamente",
	})
}

// EliminarDato da de baja un dato (DeleteDato). El integrador lo propone; el
// admin lo confirma (directo o aprobando la solicitud).
func EliminarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}

	if esIntegrador(c) {
		sol := crearSolicitudPendiente(c, aprobaciones.OpEliminar, id, "", nil, "")
		responderSolicitudPendiente(c, sol, "Baja")
		return
	}

	tenantID := middleware.TenantFromContext(c)
	res, err := ejecutarEliminarDato(tenantID, id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoEliminado,
		id,
		res.TxID,
		fmt.Sprintf("Dato %q eliminado del ledger", id),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato eliminado del ledger",
	})
}

// RestaurarDato restaura una revisión histórica como un NUEVO bloque (rollback lógico).
//
// Flujo:
//  1. Lee GetDatoHistory(datoId)
//  2. Busca la revisión solicitada por txId
//  3. Toma su record y lo vuelve a escribir con CreateDato/UpdateDato
//
// No modifica ni elimina bloques previos: la cadena permanece inmutable.
func RestaurarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	var in entradaRestaurarDato
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "JSON inválido: " + err.Error()})
		return
	}
	in.TxID = strings.TrimSpace(in.TxID)
	if in.TxID == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "txId es obligatorio para restaurar"})
		return
	}

	if esIntegrador(c) {
		sol := crearSolicitudPendiente(c, aprobaciones.OpRestaurar, id, "", nil, in.TxID)
		responderSolicitudPendiente(c, sol, "Restauración")
		return
	}

	tenantID := middleware.TenantFromContext(c)
	res, desde, err := ejecutarRestaurarDato(tenantID, id, in.TxID)
	if err != nil {
		renderErrorOperacion(c, err)
		return
	}

	publicarNotificacion(c,
		notificador.EventoDatoRestaurado,
		id,
		res.TxID,
		fmt.Sprintf("Dato %q restaurado desde txId=%s", id, desde),
	)

	c.JSON(http.StatusOK, gin.H{
		"ok":                  true,
		"txId":                res.TxID,
		"mensaje":             "Dato restaurado correctamente como una nueva revisión",
		"restauradoDesdeTxId": desde,
	})
}

// renderErrorOperacion traduce un error de ejecución a respuesta HTTP. Si es un
// opError usa su código/estado; en otro caso lo clasifica como error de Fabric.
func renderErrorOperacion(c *gin.Context, err error) {
	var oe *opError
	if errors.As(err, &oe) {
		c.JSON(oe.HTTP, models.RespuestaError{Ok: false, Codigo: oe.Codigo, Mensaje: oe.Mensaje})
		return
	}
	st, cod, pub := clasificarErrorFabric(err)
	c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
}

// ejecutarRestaurarDato implementa el rollback inmutable: lee el historial,
// localiza la revisión por txId y la re-escribe como un NUEVO bloque
// (Update si el dato existe, Create si fue eliminado). No altera la cadena.
// Devuelve el resultado de la tx, el txId de origen y, en errores de negocio,
// un *opError con código/estado público.
func ejecutarRestaurarDato(tenantID, id, txOrigen string) (*fabric.SubmitResult, string, error) {
	rawHist, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "GetDatoHistory", id)
	if err != nil {
		return nil, "", err
	}

	var historial []historialDatoEntry
	if err := json.Unmarshal(rawHist, &historial); err != nil {
		return nil, "", &opError{HTTP: http.StatusInternalServerError, Codigo: "ERROR_FORMATO", Mensaje: "No se pudo interpretar el historial del dato"}
	}

	rev := buscarRevisionHistorial(historial, txOrigen)
	if rev == nil {
		return nil, "", &opError{HTTP: http.StatusNotFound, Codigo: "REVISION_NO_ENCONTRADA", Mensaje: "No existe una revisión con ese txId para este dato"}
	}
	if rev.IsDelete || len(rev.Record) == 0 {
		return nil, "", &opError{HTTP: http.StatusBadRequest, Codigo: "REVISION_NO_RESTAURABLE", Mensaje: "La revisión seleccionada corresponde a una eliminación y no puede restaurarse"}
	}

	var dato entradaDato
	if err := json.Unmarshal(rev.Record, &dato); err != nil {
		return nil, "", &opError{HTTP: http.StatusInternalServerError, Codigo: "ERROR_FORMATO", Mensaje: "El bloque histórico no contiene un dato válido para restaurar"}
	}
	if strings.TrimSpace(dato.DatoID) == "" {
		dato.DatoID = id
	}
	if strings.TrimSpace(dato.DatoID) != id {
		return nil, "", &opError{HTTP: http.StatusBadRequest, Codigo: "VALIDACION", Mensaje: "La revisión seleccionada no pertenece al dato indicado en la ruta"}
	}
	if err := validarEntradaDato(dato); err != nil {
		return nil, "", &opError{HTTP: http.StatusBadRequest, Codigo: "VALIDACION", Mensaje: "Revisión no restaurable: " + err.Error()}
	}

	payloadConMeta, err := inyectarMetaRestauracion(dato.Payload, txOrigen)
	if err != nil {
		return nil, "", &opError{HTTP: http.StatusInternalServerError, Codigo: "ERROR_FORMATO", Mensaje: "No se pudo marcar la restauración en el payload"}
	}
	dato.Payload = payloadConMeta

	// Si el registro existe en world-state: Update. Si no existe: Create.
	_, err = fabric.EvaluateTransactionTenant(tenantID, "", "", "ReadDato", id)
	existeActual := err == nil
	if err != nil && !esErrorLedgerNoEncontrado(err) {
		return nil, "", err
	}

	var res *fabric.SubmitResult
	if existeActual {
		res, err = ejecutarActualizarDato(tenantID, id, dato.Tipo, dato.Payload)
	} else {
		res, err = ejecutarCrearDato(tenantID, id, dato.Tipo, dato.Payload)
	}
	if err != nil {
		return nil, "", err
	}
	return res, txOrigen, nil
}

func metaRestauracionDesdeRecord(record interface{}) string {
	if record == nil {
		return ""
	}
	var rec map[string]interface{}
	switch v := record.(type) {
	case map[string]interface{}:
		rec = v
	case string:
		if err := json.Unmarshal([]byte(strings.TrimSpace(v)), &rec); err != nil {
			return ""
		}
	default:
		b, err := json.Marshal(record)
		if err != nil {
			return ""
		}
		if err := json.Unmarshal(b, &rec); err != nil {
			return ""
		}
	}
	payloadRaw, ok := rec["payload"]
	if !ok {
		payloadRaw = rec["payloadDecodificado"]
	}
	var payload map[string]interface{}
	switch p := payloadRaw.(type) {
	case map[string]interface{}:
		payload = p
	case string:
		if err := json.Unmarshal([]byte(strings.TrimSpace(p)), &payload); err != nil {
			return ""
		}
	default:
		return ""
	}
	meta, ok := payload["_baasMeta"].(map[string]interface{})
	if !ok || meta == nil {
		return ""
	}
	tx, _ := meta["restauradoDesdeTxId"].(string)
	return strings.TrimSpace(tx)
}

func enriquecerHistorialDatosConRestauracion(datos interface{}) interface{} {
	slice, ok := datos.([]interface{})
	if !ok {
		return datos
	}
	for _, el := range slice {
		entry, ok := el.(map[string]interface{})
		if !ok {
			continue
		}
		if tx := metaRestauracionDesdeRecord(entry["record"]); tx != "" {
			entry["restauradoDesdeTxId"] = tx
		}
	}
	return slice
}

// ConsultarHistorialDato devuelve el historial inmutable (GetDatoHistory → GetHistoryForKey).
func ConsultarHistorialDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "GetDatoHistory", id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	resp := respuestaLecturaFabric(c, raw, "Historial inmutable del dato")
	if resp.Datos != nil {
		resp.Datos = enriquecerHistorialDatosConRestauracion(resp.Datos)
	}
	c.JSON(http.StatusOK, resp)
}
