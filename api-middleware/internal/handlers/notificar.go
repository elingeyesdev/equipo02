package handlers

import (
	"strings"

	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"

	"github.com/gin-gonic/gin"
)

// publicarNotificacion encola un evento al notificador global con los datos
// del actor extraídos del contexto Gin. Es seguro llamarla aunque el
// notificador no esté inicializado (no-op).
func publicarNotificacion(c *gin.Context, tipo, recurso, txID, resumen string) {
	publicarNotificacionConMetadata(c, tipo, recurso, txID, resumen, nil)
}

func publicarNotificacionConMetadata(c *gin.Context, tipo, recurso, txID, resumen string, metadata map[string]any) {
	if notificador.Default == nil {
		return
	}
	tenant := middleware.TenantFromContext(c)

	var rolStr string
	if v, ok := c.Get(middleware.ContextAPIRole); ok {
		rolStr, _ = v.(string)
	}

	actorID := strings.TrimSpace(c.GetHeader("X-Actor-Id"))
	actorNombre := strings.TrimSpace(c.GetHeader("X-Actor-Name"))

	notificador.Default.Publicar(notificador.EventoNotificacion{
		Tenant:      tenant,
		Tipo:        tipo,
		Recurso:     recurso,
		ActorRol:    rolStr,
		ActorID:     actorID,
		ActorNombre: actorNombre,
		TxID:        txID,
		Resumen:     resumen,
		Metadata:    metadata,
	})
}
