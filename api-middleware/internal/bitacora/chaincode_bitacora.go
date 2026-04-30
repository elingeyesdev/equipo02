package bitacora

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	bitacoraMu sync.Mutex
	bitacoraFH *os.File
)

// EntradaBitacoraChaincode es un registro estructurado para auditoría (stdout + archivo opcional).
type EntradaBitacoraChaincode struct {
	Timestamp     time.Time `json:"timestamp"`
	OperacionID   string    `json:"operacionId,omitempty"`
	Actor         string    `json:"actor"`
	Audiencia     string    `json:"audiencia"` // integrador | administracion
	Canal         string    `json:"canal"`
	Contrato      string    `json:"contrato"`
	Funcion       string    `json:"funcion"`
	Modo          string    `json:"modo"`
	Resultado     string    `json:"resultado"` // exito | error
	CodigoHTTP    int       `json:"codigoHttp,omitempty"`
	CodigoNegocio string    `json:"codigoNegocio,omitempty"`
	TxID          string    `json:"txId,omitempty"`
	Mensaje       string    `json:"mensaje,omitempty"`
}

// ConfigurarBitacora inicializa el archivo de salida para la auditoría.
// Debe llamarse después de cargar las variables de entorno.
func ConfigurarBitacora() {
	p := strings.TrimSpace(os.Getenv("CHAINCODE_BITACORA_FILE"))
	if p == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		log.Printf("[BITACORA] no se pudo crear directorio: %v", err)
		return
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		log.Printf("[BITACORA] no se pudo abrir archivo: %v", err)
		return
	}
	bitacoraMu.Lock()
	bitacoraFH = f
	bitacoraMu.Unlock()
	log.Printf("[BITACORA] Archivo de bitácora abierto correctamente en: %s", p)
}

// EntradaBitacoraEvento representa un registro de error o evento administrativo del módulo de monitoreo.
type EntradaBitacoraEvento struct {
	Timestamp time.Time `json:"timestamp"`
	Categoria string    `json:"categoria"` // EVENT_ERROR | EVENT_CRITICAL | EVENT_DELIVERY_SKIPPED
	Contrato  string    `json:"contrato"`
	Mensaje   string    `json:"mensaje"`
	Error     string    `json:"error,omitempty"`
}

// RegistrarChaincode escribe JSON en una línea a stdout y opcionalmente a CHAINCODE_BITACORA_FILE.
func RegistrarChaincode(e EntradaBitacoraChaincode) {
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	escribirEnBitacora(e, "[BITACORA_CHAINCODE]")
}

// RegistrarFalloEvento escribe un registro de error del módulo de eventos en la bitácora.
func RegistrarFalloEvento(e EntradaBitacoraEvento) {
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	escribirEnBitacora(e, "[BITACORA_EVENTO]")
}

func escribirEnBitacora(v interface{}, prefijo string) {
	line, err := json.Marshal(v)
	if err != nil {
		log.Printf("%s error al serializar: %v", prefijo, err)
		return
	}
	log.Printf("%s %s", prefijo, string(line))
	
	bitacoraMu.Lock()
	defer bitacoraMu.Unlock()
	if bitacoraFH != nil {
		_, _ = bitacoraFH.Write(append(line, '\n'))
		_ = bitacoraFH.Sync() // Forzar escritura física en disco
	}
}
