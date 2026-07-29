/*
SPDX-License-Identifier: Apache-2.0
*/

// Package chaincode implementa dato_cc: un activo genérico para empresas
// integradoras del BaaS. El chaincode acepta cualquier estructura JSON como
// payload, indexada por una clave única (datoId) y categorizada por "tipo".
//
// Funciones expuestas:
//   - CreateDato(id, tipo, payloadJSON)
//   - ReadDato(id) → JSON Dato
//   - UpdateDato(id, tipo, payloadJSON)
//   - DeleteDato(id)
//   - DatoExists(id) → bool
//   - GetAllDatos() → []Dato
//   - GetDatoHistory(id) → []HistoryEntry  (orden cronológico descendente)
package chaincode

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// SmartContract expone el contrato dato_cc.
type SmartContract struct {
	contractapi.Contract
}

// Dato es el activo genérico persistido en el ledger.
//
// `Payload` se almacena como JSON serializado para preservar la estructura
// original tal cual la envió el integrador. El contrato verifica que sea JSON
// válido pero no impone un esquema.
type Dato struct {
	DatoID             string          `json:"datoId"`
	Tipo               string          `json:"tipo"`
	Payload            json.RawMessage `json:"payload"`
	FechaCreacion      string          `json:"fechaCreacion"`
	FechaActualizacion string          `json:"fechaActualizacion"`
	Revision           int             `json:"revision"`
}


// HistoryEntry es una entrada del historial inmutable de un Dato.
type HistoryEntry struct {
	TxID      string          `json:"txId"`
	Timestamp string          `json:"timestamp"`
	IsDelete  bool            `json:"isDelete"`
	Record    json.RawMessage `json:"record,omitempty"`
}

func nowISO(ctx contractapi.TransactionContextInterface) string {
	if ts, err := ctx.GetStub().GetTxTimestamp(); err == nil && ts != nil {
		return time.Unix(ts.Seconds, int64(ts.Nanos)).UTC().Format(time.RFC3339)
	}
	return time.Now().UTC().Format(time.RFC3339)
}

func validarEntradaCreacion(id, tipo, payload string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("datoId obligatorio")
	}
	if strings.TrimSpace(tipo) == "" {
		return fmt.Errorf("tipo obligatorio")
	}
	if !json.Valid([]byte(payload)) {
		return fmt.Errorf("payload no es JSON válido")
	}
	return nil
}

// InitLedger no carga datos por defecto (modelo genérico).
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return nil
}

// CreateDato crea un nuevo activo genérico.
func (s *SmartContract) CreateDato(ctx contractapi.TransactionContextInterface, datoID, tipo, payloadJSON string) error {
	if err := validarEntradaCreacion(datoID, tipo, payloadJSON); err != nil {
		return err
	}
	exists, err := s.DatoExists(ctx, datoID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("el dato %s ya existe", datoID)
	}
	now := nowISO(ctx)
	d := Dato{
		DatoID:             datoID,
		Tipo:               tipo,
		Payload:            json.RawMessage(payloadJSON),
		FechaCreacion:      now,
		FechaActualizacion: now,
		Revision:           1,
	}
	bytes, err := json.Marshal(d)
	if err != nil {
		return fmt.Errorf("marshal dato: %w", err)
	}
	return ctx.GetStub().PutState(datoID, bytes)
}

// ReadDato devuelve el dato indicado como JSON (string) para compatibilidad con evaluate/query.
func (s *SmartContract) ReadDato(ctx contractapi.TransactionContextInterface, datoID string) (string, error) {
	if strings.TrimSpace(datoID) == "" {
		return "", fmt.Errorf("datoId obligatorio")
	}
	bytes, err := ctx.GetStub().GetState(datoID)
	if err != nil {
		return "", fmt.Errorf("read state: %w", err)
	}
	if bytes == nil {
		return "", fmt.Errorf("el dato %s no existe", datoID)
	}
	return string(bytes), nil
}

// UpdateDato modifica un dato existente conservando su fecha de creación.
func (s *SmartContract) UpdateDato(ctx contractapi.TransactionContextInterface, datoID, tipo, payloadJSON string) error {
	if err := validarEntradaCreacion(datoID, tipo, payloadJSON); err != nil {
		return err
	}
	raw, err := ctx.GetStub().GetState(datoID)
	if err != nil {
		return fmt.Errorf("read state: %w", err)
	}
	if raw == nil {
		return fmt.Errorf("el dato %s no existe", datoID)
	}
	var prev Dato
	if err := json.Unmarshal(raw, &prev); err != nil {
		return fmt.Errorf("decode dato: %w", err)
	}
	prev.Tipo = tipo
	prev.Payload = json.RawMessage(payloadJSON)
	prev.FechaActualizacion = nowISO(ctx)
	prev.Revision++
	bytes, err := json.Marshal(prev)
	if err != nil {
		return fmt.Errorf("marshal dato: %w", err)
	}
	return ctx.GetStub().PutState(datoID, bytes)
}

// DeleteDato elimina el dato del world state (su historial queda inmutable).
func (s *SmartContract) DeleteDato(ctx contractapi.TransactionContextInterface, datoID string) error {
	exists, err := s.DatoExists(ctx, datoID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("el dato %s no existe", datoID)
	}
	return ctx.GetStub().DelState(datoID)
}

// DatoExists verifica si la clave existe en world state.
func (s *SmartContract) DatoExists(ctx contractapi.TransactionContextInterface, datoID string) (bool, error) {
	bytes, err := ctx.GetStub().GetState(datoID)
	if err != nil {
		return false, fmt.Errorf("read state: %w", err)
	}
	return bytes != nil, nil
}

// GetAllDatos recorre el world state y devuelve todos los datos como JSON array (string).
// Recomendado solo para canales pequeños o paginar en el futuro.
func (s *SmartContract) GetAllDatos(ctx contractapi.TransactionContextInterface) (string, error) {
	it, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return "", fmt.Errorf("iterar world state: %w", err)
	}
	defer it.Close()
	var datos []*Dato
	for it.HasNext() {
		kv, err := it.Next()
		if err != nil {
			return "", err
		}
		var d Dato
		if err := json.Unmarshal(kv.Value, &d); err != nil {
			continue
		}
		datos = append(datos, &d)
	}
	sort.Slice(datos, func(i, j int) bool { return datos[i].DatoID < datos[j].DatoID })
	bytes, err := json.Marshal(datos)
	if err != nil {
		return "", fmt.Errorf("marshal datos: %w", err)
	}
	return string(bytes), nil
}

// GetDatoHistory devuelve el historial inmutable del dato (más reciente primero) como JSON (string).
func (s *SmartContract) GetDatoHistory(ctx contractapi.TransactionContextInterface, datoID string) (string, error) {
	if strings.TrimSpace(datoID) == "" {
		return "", fmt.Errorf("datoId obligatorio")
	}
	it, err := ctx.GetStub().GetHistoryForKey(datoID)
	if err != nil {
		return "", fmt.Errorf("history for key: %w", err)
	}
	defer it.Close()
	var out []HistoryEntry
	for it.HasNext() {
		mod, err := it.Next()
		if err != nil {
			return "", err
		}
		entry := HistoryEntry{
			TxID:     mod.TxId,
			IsDelete: mod.IsDelete,
		}
		if mod.Timestamp != nil {
			entry.Timestamp = time.Unix(mod.Timestamp.Seconds, int64(mod.Timestamp.Nanos)).UTC().Format(time.RFC3339)
		}
		if !mod.IsDelete && len(mod.Value) > 0 {
			entry.Record = json.RawMessage(mod.Value)
		}
		out = append(out, entry)
	}
	// Invertimos para entregar más reciente primero.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	bytes, err := json.Marshal(out)
	if err != nil {
		return "", fmt.Errorf("marshal history: %w", err)
	}
	return string(bytes), nil
}
