package bitacora

import (
	"time"
)

// EntradaBitacoraSolicitud registra una petición HTTP recibida (hito 2.8).
type EntradaBitacoraSolicitud struct {
	Timestamp   time.Time `json:"timestamp"`
	OperacionID string    `json:"operacionId"`
	Metodo      string    `json:"metodo"`
	Ruta        string    `json:"ruta"`
	Remoto      string    `json:"remoto"`
	UserAgent string `json:"userAgent,omitempty"`
	Actor     string `json:"actor,omitempty"`
}

// EntradaBitacoraResultado registra el cierre de una operación HTTP (hito 2.8).
type EntradaBitacoraResultado struct {
	Timestamp   time.Time `json:"timestamp"`
	OperacionID string    `json:"operacionId"`
	Metodo      string    `json:"metodo"`
	Ruta        string    `json:"ruta"`
	CodigoHTTP  int       `json:"codigoHttp"`
	DuracionMs  int64     `json:"duracionMs"`
	Resultado   string    `json:"resultado"` // exito | error_validacion | error_cliente | error_servidor | error_conexion_upstream
	Detalle     string    `json:"detalle,omitempty"`
}

// EntradaBitacoraConexionFabric fallo al inicializar el cliente Fabric al arranque.
type EntradaBitacoraConexionFabric struct {
	Timestamp time.Time `json:"timestamp"`
	Fase      string    `json:"fase"` // fabric_connect
	Resultado string    `json:"resultado"`
	Error     string    `json:"error"`
}

// RegistrarSolicitudRecibida escribe la línea de auditoría de entrada.
func RegistrarSolicitudRecibida(e EntradaBitacoraSolicitud) {
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	escribirEnBitacora(e, "[BITACORA_SOLICITUD]")
}

// RegistrarResultadoOperacion escribe el resultado final de la petición.
func RegistrarResultadoOperacion(e EntradaBitacoraResultado) {
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	escribirEnBitacora(e, "[BITACORA_RESULTADO]")
}

// RegistrarFalloConexionFabric registra un error de conexión al arrancar el gateway.
func RegistrarFalloConexionFabric(err error) {
	e := EntradaBitacoraConexionFabric{
		Timestamp: time.Now().UTC(),
		Fase:      "fabric_connect",
		Resultado: "error",
	}
	if err != nil {
		e.Error = err.Error()
	}
	escribirEnBitacora(e, "[BITACORA_CONEXION]")
}
