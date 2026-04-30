package fabric

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"api-middleware/internal/bitacora"
)

// EventoNormalizado es la estructura estandarizada que se entregará a la API (Paso 3)
type EventoNormalizado struct {
	Timestamp    time.Time       `json:"timestamp"`
	Contrato     string          `json:"contrato"`
	NombreEvento string          `json:"nombreEvento"`
	TxID         string          `json:"txId"`
	BlockNumber  uint64          `json:"blockNumber"`
	Payload      json.RawMessage `json:"payload"`
}

// HistorialMaximo define cuántos eventos retenemos en memoria para consultas tradicionales.
const HistorialMaximo = 100

// EventBroker administra los clientes conectados vía SSE y el historial en memoria.
type EventBroker struct {
	mu        sync.RWMutex
	historial []EventoNormalizado
	clients   map[chan EventoNormalizado]bool
}

// GlobalEventBroker es la instancia global para manejar la distribución de eventos.
var GlobalEventBroker = &EventBroker{
	historial: make([]EventoNormalizado, 0, HistorialMaximo),
	clients:   make(map[chan EventoNormalizado]bool),
}

// AddClient registra un nuevo canal para recibir eventos en vivo (para SSE).
func (b *EventBroker) AddClient() chan EventoNormalizado {
	ch := make(chan EventoNormalizado, 10)
	b.mu.Lock()
	b.clients[ch] = true
	b.mu.Unlock()
	return ch
}

// RemoveClient remueve un canal cuando el cliente SSE se desconecta.
func (b *EventBroker) RemoveClient(ch chan EventoNormalizado) {
	b.mu.Lock()
	delete(b.clients, ch)
	close(ch)
	b.mu.Unlock()
}

// Broadcast distribuye el evento a todos los clientes SSE y lo guarda en el historial.
func (b *EventBroker) Broadcast(evento EventoNormalizado) {
	b.mu.Lock()
	b.historial = append(b.historial, evento)
	if len(b.historial) > HistorialMaximo {
		b.historial = b.historial[1:]
	}
	dropped := 0
	for ch := range b.clients {
		select {
		case ch <- evento:
		default:
			dropped++
		}
	}
	b.mu.Unlock()

	if dropped > 0 {
		bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
			Categoria: "EVENT_DELIVERY_SKIPPED",
			Contrato:  evento.Contrato,
			Mensaje: fmt.Sprintf(
				"cola SSE llena: %d suscriptor(es) no recibieron el evento %s (txId=%s)",
				dropped, evento.NombreEvento, evento.TxID,
			),
		})
	}
}

// GetHistorial retorna una copia de los últimos eventos (Paso 4 - consulta tradicional).
func (b *EventBroker) GetHistorial() []EventoNormalizado {
	b.mu.RLock()
	defer b.mu.RUnlock()

	copia := make([]EventoNormalizado, len(b.historial))
	copy(copia, b.historial)
	return copia
}

// StartEventListening inicia la escucha (Paso 2) y aplica el filtrado de eventos relevantes (Paso 1).
// También maneja la resiliencia (Paso 5) con reconexión exponencial y protección contra pánicos.
func StartEventListening(ctx context.Context, chaincodeName string) {
	// Protección contra pánicos inesperados para no tumbar el API
	defer func() {
		if r := recover(); r != nil {
			msg := fmt.Sprintf("Pánico recuperado: %v", r)
			log.Printf("[EVENTOS-CRÍTICO] %s en '%s'", msg, chaincodeName)
			bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
				Categoria: "EVENT_CRITICAL",
				Contrato:  chaincodeName,
				Mensaje:   msg,
			})
		}
	}()

	backoff := 5 * time.Second
	maxBackoff := 60 * time.Second

	// Fase 5: Manejo de reconexión o pérdida temporal de eventos (loop infinito)
	for {
		err := listenLoop(ctx, chaincodeName)
		
		// Si se canceló el contexto desde arriba, nos detenemos limpiamente.
		if ctx.Err() != nil {
			log.Printf("[EVENTOS] Listener para '%s' detenido por cancelación de contexto.", chaincodeName)
			return
		}

		if err != nil {
			// Si falló, lo anunciamos y aplicamos un backoff exponencial
			log.Printf("[EVENTOS] Error de escucha en '%s': %v. Reconectando en %v...", chaincodeName, err, backoff)
			
			bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
				Categoria: "EVENT_ERROR",
				Contrato:  chaincodeName,
				Mensaje:   "Fallo en el loop de escucha de eventos",
				Error:     err.Error(),
			})

			time.Sleep(backoff)
			
			// Incrementar el tiempo de espera (exponencial) hasta el máximo
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
		} else {
			// Si salió sin error o por un cierre natural, reiniciamos el backoff
			backoff = 5 * time.Second
		}
	}
}

// listenLoop maneja una sesión individual de conexión.
func listenLoop(ctx context.Context, chaincodeName string) error {
	if GlobalGateway == nil {
		return fmt.Errorf("el gateway no está inicializado")
	}

	network := GlobalGateway.GetNetwork(canalEfectivo(""))

	log.Printf("[EVENTOS] Iniciando suscripción a eventos de chaincode: %s", chaincodeName)
	eventIter, err := network.ChaincodeEvents(ctx, chaincodeName)
	if err != nil {
		return fmt.Errorf("fallo al suscribirse a eventos del chaincode %s: %w", chaincodeName, err)
	}

	// Loop bloqueante para procesar eventos según llegan
	for eventoBlockchain := range eventIter {
		// PASO 1: Definir eventos relevantes. 
		// Descartamos aquellos eventos vacíos que no traigan un payload.
		if len(eventoBlockchain.Payload) == 0 {
			continue // Evento basura/sistémico, lo ignoramos.
		}

		// Validamos si el payload es JSON, si no, intentamos pasarlo como texto
		var payloadData json.RawMessage
		if json.Valid(eventoBlockchain.Payload) {
			payloadData = json.RawMessage(eventoBlockchain.Payload)
		} else {
			// Lo forzamos a JSON String para normalizarlo correctamente
			b, _ := json.Marshal(string(eventoBlockchain.Payload))
			payloadData = json.RawMessage(b)
		}

		// PASO 3: Normalización de la estructura
		evNorm := EventoNormalizado{
			Timestamp:    time.Now().UTC(),
			Contrato:     chaincodeName,
			NombreEvento: eventoBlockchain.EventName,
			TxID:         eventoBlockchain.TransactionID,
			BlockNumber:  eventoBlockchain.BlockNumber,
			Payload:      payloadData,
		}

		// Emitimos al Broker global
		GlobalEventBroker.Broadcast(evNorm)
	}

	return fmt.Errorf("el canal de eventos fue cerrado abruptamente")
}
