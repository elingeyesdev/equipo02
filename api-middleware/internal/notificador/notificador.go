// Package notificador centraliza el envío de notificaciones a administradores
// cuando ocurre una mutación en el ledger. Funciona como un bus en memoria con
// múltiples canales de salida (correo SMTP, webhook HTTP, SSE para el portal
// admin). Los hooks en los handlers llaman Publicar(...) tras una mutación
// exitosa y el notificador resuelve qué destinos aplican según la config del
// tenant.
//
// Diseño:
//
//  1. Una única instancia global (Default) protege el orden y los recursos.
//  2. Publicar(...) es no-bloqueante: encola el evento en un canal con buffer.
//     Si el buffer está lleno, el evento se pierde y se registra en bitácora;
//     esto evita que el handler HTTP quede atrapado por un SMTP lento.
//  3. Un worker fan-out lee del bus, evalúa filtros (tenant.Notificaciones)
//     y dispara las entregas en goroutines con timeout corto.
//  4. SSE es siempre un destino implícito: los clientes admin del tenant
//     reciben todos los eventos del tenant, sin filtros adicionales.
package notificador

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"api-middleware/internal/bitacora"
	"api-middleware/internal/tenants"
)

// Tipos de evento conocidos. No es una lista cerrada; cualquier string puede
// llegar a Publicar, pero estas constantes ayudan a evitar typos en los hooks.
const (
	EventoDatoCreado     = "dato.creado"
	EventoDatoEditado    = "dato.editado"
	EventoDatoEliminado  = "dato.eliminado"
	EventoDatoRestaurado = "dato.restaurado"
	// Flujo de aprobación: un integrador propone un cambio (pendiente) o un
	// admin lo resuelve.
	EventoSolicitudCreada   = "solicitud.creada"
	EventoSolicitudResuelta = "solicitud.resuelta"
)

// EventoNotificacion representa un cambio detectado que debe avisarse a los
// administradores configurados. Se publica desde los hooks de los handlers
// HTTP, justo después de un Submit exitoso al ledger.
type EventoNotificacion struct {
	ID          string         `json:"id"`
	Timestamp   time.Time      `json:"timestamp"`
	Tenant      string         `json:"tenant"`
	Tipo        string         `json:"tipo"`
	Recurso     string         `json:"recurso,omitempty"`
	ActorRol    string         `json:"actorRol,omitempty"`
	ActorID     string         `json:"actorId,omitempty"`
	ActorNombre string         `json:"actorNombre,omitempty"`
	TxID        string         `json:"txId,omitempty"`
	Resumen     string         `json:"resumen"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

// CanalSalida es la abstracción que implementan email/webhook/sse.
// Entregar recibe el evento ya filtrado por las reglas del tenant y debe
// devolver un error solo si la entrega falló.
type CanalSalida interface {
	Nombre() string
	Entregar(ctx context.Context, ev EventoNotificacion, destino tenants.DestinoNotificacion) error
}

// Notificador es el bus de notificaciones. Es seguro para uso concurrente.
type Notificador struct {
	registro *tenants.Registry

	bus    chan EventoNotificacion
	wg     sync.WaitGroup
	cancel context.CancelFunc

	muCanales sync.RWMutex
	canales   map[string]CanalSalida // tipo → canal (email, webhook, sse)

	// Broker SSE específico para notificaciones (separado de fabric.GlobalEventBroker
	// para no mezclar eventos de chaincode con notificaciones de auditoría).
	sse *BrokerSSE
}

// Default es la instancia global. Se crea y arranca desde cmd/server/main.go.
var Default *Notificador

// Nuevo crea un notificador con su bus listo para arrancar.
func Nuevo(reg *tenants.Registry, buffer int) *Notificador {
	if buffer <= 0 {
		buffer = 256
	}
	return &Notificador{
		registro: reg,
		bus:      make(chan EventoNotificacion, buffer),
		canales:  map[string]CanalSalida{},
		sse:      NuevoBrokerSSE(),
	}
}

// RegistrarCanal añade o reemplaza un canal de salida por tipo.
func (n *Notificador) RegistrarCanal(c CanalSalida) {
	if n == nil || c == nil {
		return
	}
	n.muCanales.Lock()
	n.canales[strings.ToLower(strings.TrimSpace(c.Nombre()))] = c
	n.muCanales.Unlock()
}

// BrokerSSE expone el broker para que el handler HTTP cree clientes.
func (n *Notificador) BrokerSSE() *BrokerSSE {
	if n == nil {
		return nil
	}
	return n.sse
}

// Iniciar arranca el worker fan-out. Para tests, usar el contexto cancelable.
func (n *Notificador) Iniciar(parent context.Context) {
	if n == nil {
		return
	}
	ctx, cancel := context.WithCancel(parent)
	n.cancel = cancel
	n.wg.Add(1)
	go n.loop(ctx)
}

// Detener cierra el worker de forma ordenada (espera a que drene el bus).
func (n *Notificador) Detener() {
	if n == nil {
		return
	}
	if n.cancel != nil {
		n.cancel()
	}
	n.wg.Wait()
}

// Publicar encola un evento sin bloquear el llamador. Si el bus está lleno,
// se descarta y se registra en bitácora. Devuelve true si entró al bus.
func (n *Notificador) Publicar(ev EventoNotificacion) bool {
	if n == nil {
		return false
	}
	if strings.TrimSpace(ev.ID) == "" {
		ev.ID = nuevoEventoID()
	}
	if ev.Timestamp.IsZero() {
		ev.Timestamp = time.Now().UTC()
	}
	select {
	case n.bus <- ev:
		return true
	default:
		bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
			Categoria: "NOTIFICACION_DESCARTADA",
			Contrato:  ev.Tenant,
			Mensaje: fmt.Sprintf(
				"bus de notificaciones lleno: se descarta evento %s sobre %s",
				ev.Tipo, ev.Recurso,
			),
		})
		return false
	}
}

func (n *Notificador) loop(ctx context.Context) {
	defer n.wg.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-n.bus:
			n.entregar(ctx, ev)
		}
	}
}

// entregar evalúa las reglas del tenant y dispara una goroutine por destino.
func (n *Notificador) entregar(ctx context.Context, ev EventoNotificacion) {
	// SSE primero: siempre se intenta, sin pasar filtros del tenant. El portal
	// admin se conecta con su X-API-Key y el broker hace de filtro implícito
	// por tenant al construir el cliente.
	if n.sse != nil {
		n.sse.Broadcast(ev)
	}

	if n.registro == nil {
		return
	}
	t := n.registro.Get(ev.Tenant)
	if t == nil || t.Notificaciones == nil || !t.Notificaciones.Activado {
		return
	}
	cfg := t.Notificaciones
	if !tipoPermitido(cfg.Eventos, ev.Tipo) {
		return
	}
	if !rolActorPermitido(cfg.RolesActor, ev.ActorRol) {
		return
	}

	for _, d := range cfg.Destinos {
		dest := d
		// Overrides locales del destino.
		if !tipoPermitido(dest.Eventos, ev.Tipo) {
			continue
		}
		if !rolActorPermitido(dest.RolesActor, ev.ActorRol) {
			continue
		}
		canal := n.canalPara(dest.Tipo)
		if canal == nil {
			continue
		}
		go func() {
			ctxD, cancel := context.WithTimeout(ctx, 8*time.Second)
			defer cancel()
			if err := canal.Entregar(ctxD, ev, dest); err != nil {
				log.Printf("[NOTIFICADOR] entrega %s falló: %v", canal.Nombre(), err)
				bitacora.RegistrarFalloEvento(bitacora.EntradaBitacoraEvento{
					Categoria: "NOTIFICACION_FALLIDA",
					Contrato:  ev.Tenant,
					Mensaje:   fmt.Sprintf("canal=%s tipo=%s recurso=%s", canal.Nombre(), ev.Tipo, ev.Recurso),
					Error:     err.Error(),
				})
			}
		}()
	}
}

func (n *Notificador) canalPara(tipo string) CanalSalida {
	n.muCanales.RLock()
	defer n.muCanales.RUnlock()
	return n.canales[strings.ToLower(strings.TrimSpace(tipo))]
}

func tipoPermitido(permitidos []string, tipo string) bool {
	if len(permitidos) == 0 {
		return true
	}
	t := strings.ToLower(strings.TrimSpace(tipo))
	for _, p := range permitidos {
		if strings.ToLower(strings.TrimSpace(p)) == t {
			return true
		}
	}
	return false
}

func rolActorPermitido(roles []string, rol string) bool {
	if len(roles) == 0 {
		return true
	}
	r := strings.ToLower(strings.TrimSpace(rol))
	for _, p := range roles {
		if strings.ToLower(strings.TrimSpace(p)) == r {
			return true
		}
	}
	return false
}

func nuevoEventoID() string {
	return fmt.Sprintf("evt-%d", time.Now().UnixNano())
}
