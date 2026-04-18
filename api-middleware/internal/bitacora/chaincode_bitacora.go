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

func init() {
	p := strings.TrimSpace(os.Getenv("CHAINCODE_BITACORA_FILE"))
	if p == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		log.Printf("[BITACORA_CHAINCODE] no se pudo crear directorio de bitácora: %v", err)
		return
	}
	f, err := os.OpenFile(p, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		log.Printf("[BITACORA_CHAINCODE] no se pudo abrir archivo de bitácora: %v", err)
		return
	}
	bitacoraFH = f
}

// RegistrarChaincode escribe JSON en una línea a stdout y opcionalmente a CHAINCODE_BITACORA_FILE.
func RegistrarChaincode(e EntradaBitacoraChaincode) {
	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	line, err := json.Marshal(e)
	if err != nil {
		log.Printf("[BITACORA_CHAINCODE] error al serializar: %v", err)
		return
	}
	log.Printf("[BITACORA_CHAINCODE] %s", string(line))
	bitacoraMu.Lock()
	defer bitacoraMu.Unlock()
	if bitacoraFH != nil {
		_, _ = bitacoraFH.Write(append(line, '\n'))
	}
}
