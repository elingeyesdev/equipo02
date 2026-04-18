package chaincodepolicy

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

//go:embed politicas_chaincode.json
var politicasPorDefecto []byte

// Regla describe una invocación permitida (lista blanca).
type Regla struct {
	Canal            string   `json:"canal"`
	Contrato         string   `json:"contrato"`
	Funcion          string   `json:"funcion"`
	Modos            []string `json:"modos"`
	NumeroArgumentos int      `json:"numeroArgumentos"`
}

// DocumentoPoliticas agrupa reglas por audiencia.
type DocumentoPoliticas struct {
	Integrador     []Regla `json:"integrador"`
	Administracion []Regla `json:"administracion"`
}

// PoliticasCargadas contiene reglas efectivas tras la carga.
type PoliticasCargadas struct {
	Integrador     []Regla
	Administracion []Regla
}

// Cargar lee políticas desde archivo (CHAINCODE_POLITICAS_FILE) o embebidas.
func Cargar() (*PoliticasCargadas, error) {
	raw := politicasPorDefecto
	if p := strings.TrimSpace(os.Getenv("CHAINCODE_POLITICAS_FILE")); p != "" {
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("no se pudo leer CHAINCODE_POLITICAS_FILE: %w", err)
		}
		raw = b
	}
	var doc DocumentoPoliticas
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("políticas JSON inválidas: %w", err)
	}
	// La capa de administración incluye explícitamente todo lo del integrador más reglas extra.
	admin := append(append([]Regla{}, doc.Integrador...), doc.Administracion...)
	return &PoliticasCargadas{
		Integrador:     doc.Integrador,
		Administracion: admin,
	}, nil
}

// BuscarRegla devuelve la regla que coincide con canal, contrato, función, modo y número de argumentos.
func BuscarRegla(reglas []Regla, canal, contrato, funcion, modo string, nArgs int) (*Regla, error) {
	modo = strings.ToLower(strings.TrimSpace(modo))
	for i := range reglas {
		r := &reglas[i]
		if !strings.EqualFold(r.Canal, canal) {
			continue
		}
		if !strings.EqualFold(r.Contrato, contrato) {
			continue
		}
		if !strings.EqualFold(r.Funcion, funcion) {
			continue
		}
		if r.NumeroArgumentos != nArgs {
			continue
		}
		if !contieneModo(r.Modos, modo) {
			continue
		}
		return r, nil
	}
	return nil, fmt.Errorf("combinación no permitida por política de chaincode")
}

func contieneModo(modos []string, modo string) bool {
	for _, m := range modos {
		if strings.EqualFold(strings.TrimSpace(m), modo) {
			return true
		}
	}
	return false
}
