package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"

	"github.com/gin-gonic/gin"
)

// StreamEventos (GET /eventos/stream)
// Expone los eventos de la Blockchain en tiempo real mediante Server-Sent Events (SSE).
func StreamEventos(c *gin.Context) {
	// Establecer cabeceras necesarias para SSE
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	// 1. Registrar cliente en el Broker global
	ch := fabric.GlobalEventBroker.AddClient()
	
	// 2. Asegurar que nos desconectamos al salir
	defer fabric.GlobalEventBroker.RemoveClient(ch)

	// 3. Notificar conexión exitosa (Heartbeat inicial)
	c.Writer.Write([]byte("event: status\ndata: Conectado al flujo de eventos de Blockchain\n\n"))
	c.Writer.Flush()

	// 4. Bucle para enviar eventos en vivo (con Keep-Alive)
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			// El cliente cerró la conexión
			return false
		case <-ticker.C:
			// Enviar un comentario vacío como Keep-Alive para proxies (ej. Nginx)
			c.Writer.Write([]byte(":\n\n"))
			c.Writer.Flush()
			return true
		case evento, ok := <-ch:
			if !ok {
				return false
			}
			data, err := json.Marshal(evento)
			if err != nil {
				return true
			}
			c.Writer.Write([]byte("data: "))
			c.Writer.Write(data)
			c.Writer.Write([]byte("\n\n"))
			c.Writer.Flush()
			return true
		}
	})
}

// ObtenerUltimosEventos (GET /eventos/historial)
// Devuelve un JSON tradicional con el historial reciente almacenado en memoria.
func ObtenerUltimosEventos(c *gin.Context) {
	historial := fabric.GlobalEventBroker.GetHistorial()
	
	// Reutilizamos la estructura de respuesta estándar del proyecto
	c.JSON(http.StatusOK, models.RespuestaLectura{
		Ok:      true,
		Codigo:  "EVENTOS_HISTORIAL",
		Mensaje: "Historial de eventos recientes obtenido exitosamente",
		Datos:   historial,
	})
}
