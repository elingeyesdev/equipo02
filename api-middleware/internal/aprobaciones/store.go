// Package aprobaciones implementa la cola de solicitudes de cambio del flujo
// de aprobación del BaaS.
//
// Decisión de diseño (defendible ante el jurado): las solicitudes PENDIENTES
// viven FUERA de la cadena (en memoria del middleware). Solo cuando un admin
// APRUEBA una solicitud, el cambio se escribe en Hyperledger Fabric. Así el
// ledger queda limpio de propuestas descartadas y conserva su inmutabilidad
// para lo que realmente importa: los hechos confirmados.
//
// El almacén es seguro para concurrencia y está segmentado por tenant, igual
// que el resto de estructuras en memoria del middleware (bitácora, eventos).
package aprobaciones

import (
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Operacion identifica el tipo de cambio propuesto.
type Operacion string

const (
	OpCrear     Operacion = "crear"
	OpActualizar Operacion = "actualizar"
	OpEliminar  Operacion = "eliminar"
	OpRestaurar Operacion = "restaurar"
)

// Estado del ciclo de vida de una solicitud.
type Estado string

const (
	Pendiente Estado = "pendiente"
	Aprobada  Estado = "aprobada"
	Rechazada Estado = "rechazada"
)

// Solicitud es una propuesta de cambio creada por un integrador, pendiente de
// la decisión de un admin del mismo tenant.
type Solicitud struct {
	ID                string          `json:"id"`
	Tenant            string          `json:"tenant"`
	Operacion         Operacion       `json:"operacion"`
	DatoID            string          `json:"datoId"`
	TipoDato          string          `json:"tipoDato,omitempty"`
	Payload           json.RawMessage `json:"payload,omitempty"`
	TxIDOrigen        string          `json:"txIdOrigen,omitempty"` // solo restaurar
	Solicitante       string          `json:"solicitante"`
	SolicitanteNombre string          `json:"solicitanteNombre,omitempty"`
	Estado            Estado          `json:"estado"`
	CreadaEn          time.Time       `json:"creadaEn"`
	ResueltaEn        *time.Time      `json:"resueltaEn,omitempty"`
	ResueltaPor       string          `json:"resueltaPor,omitempty"`
	Motivo            string          `json:"motivo,omitempty"`        // motivo de rechazo
	TxIDResultado     string          `json:"txIdResultado,omitempty"` // tx confirmada al aprobar
}

// Store mantiene las solicitudes en memoria, segmentadas por tenant.
type Store struct {
	mu    sync.RWMutex
	porID map[string]*Solicitud // id -> solicitud (id es global y único)
	seq   uint64
}

// Default es el almacén global usado por los handlers.
var Default = NewStore()

// NewStore crea un almacén vacío.
func NewStore() *Store {
	return &Store{porID: map[string]*Solicitud{}}
}

// Crear registra una nueva solicitud pendiente y devuelve una copia.
func (s *Store) Crear(in Solicitud) Solicitud {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.seq++
	in.ID = fmt.Sprintf("SOL-%d-%d", time.Now().UnixNano(), s.seq)
	in.Estado = Pendiente
	in.CreadaEn = time.Now().UTC()
	in.ResueltaEn = nil
	cp := in
	s.porID[in.ID] = &cp
	out := cp
	return out
}

// Listar devuelve las solicitudes de un tenant, opcionalmente filtradas por
// estado, ordenadas de más reciente a más antigua.
func (s *Store) Listar(tenant string, estado Estado) []Solicitud {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Solicitud, 0)
	for _, sol := range s.porID {
		if sol.Tenant != tenant {
			continue
		}
		if estado != "" && sol.Estado != estado {
			continue
		}
		out = append(out, *sol)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreadaEn.After(out[j].CreadaEn)
	})
	return out
}

// Obtener devuelve una solicitud por id, verificando el tenant.
func (s *Store) Obtener(tenant, id string) (Solicitud, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sol, ok := s.porID[id]
	if !ok || sol.Tenant != tenant {
		return Solicitud{}, false
	}
	return *sol, true
}

// Resolver marca una solicitud como aprobada o rechazada. Solo transiciona si
// está pendiente. Devuelve la solicitud actualizada.
func (s *Store) Resolver(tenant, id string, nuevoEstado Estado, resueltaPor, motivo, txResultado string) (Solicitud, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sol, ok := s.porID[id]
	if !ok || sol.Tenant != tenant {
		return Solicitud{}, fmt.Errorf("solicitud no encontrada")
	}
	if sol.Estado != Pendiente {
		return *sol, fmt.Errorf("la solicitud ya fue resuelta (estado=%s)", sol.Estado)
	}
	now := time.Now().UTC()
	sol.Estado = nuevoEstado
	sol.ResueltaEn = &now
	sol.ResueltaPor = resueltaPor
	sol.Motivo = motivo
	sol.TxIDResultado = txResultado
	return *sol, nil
}
