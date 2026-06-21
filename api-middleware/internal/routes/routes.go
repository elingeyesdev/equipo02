package routes

import (
	"api-middleware/internal/handlers"
	"api-middleware/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes configura todos los endpoints del API Middleware.
//
// El BaaS expone un modelo de datos UNIVERSAL (dato_cc): cualquier empresa
// (tenant) registra activos genéricos {datoId, tipo, payload JSON} en su
// propio canal Fabric. El rol y el tenant se deducen de la X-API-Key.
func SetupRoutes(router *gin.Engine) {
	// --- API pública del contrato OpenAPI: X-API-Key + rol ---
	authCualquierRol := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin, middleware.RoleIntegrador, middleware.RoleSoloLectura),
	}
	authIntegradorOAdmin := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin, middleware.RoleIntegrador),
	}
	authSoloAdmin := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin),
	}

	// =========================================================================
	// Endpoints genéricos multi-tenant (modelo de datos universal dato_cc)
	// =========================================================================
	// Modelo genérico: clave libre + payload JSON. Cualquier sistema externo
	// puede persistir cualquier estructura de negocio de forma inmutable.
	//
	// Escritura (POST/PUT/DELETE/restaurar): el integrador NO confirma en la
	// cadena; crea una solicitud pendiente que el admin aprueba. El admin
	// escribe directamente. La cola de aprobación vive en internal/aprobaciones.
	router.GET("/datos", append(authCualquierRol, handlers.ListarDatos)...)
	router.POST("/datos", append(authIntegradorOAdmin, handlers.CrearDato)...)
	router.GET("/datos/:datoId", append(authCualquierRol, handlers.ConsultarDato)...)
	router.PUT("/datos/:datoId", append(authIntegradorOAdmin, handlers.ActualizarDato)...)
	router.DELETE("/datos/:datoId", append(authIntegradorOAdmin, handlers.EliminarDato)...)
	router.GET("/datos/:datoId/historial", append(authCualquierRol, handlers.ConsultarHistorialDato)...)
	router.POST("/datos/:datoId/restaurar", append(authIntegradorOAdmin, handlers.RestaurarDato)...)

	// Flujo de aprobación: solicitudes de cambio de los integradores.
	// Cualquier rol consulta; solo admin aprueba/rechaza.
	router.GET("/solicitudes", append(authCualquierRol, handlers.ListarSolicitudes)...)
	router.GET("/solicitudes/:solicitudId", append(authCualquierRol, handlers.ConsultarSolicitud)...)
	router.POST("/solicitudes/:solicitudId/aprobar", append(authSoloAdmin, handlers.AprobarSolicitud)...)
	router.POST("/solicitudes/:solicitudId/rechazar", append(authSoloAdmin, handlers.RechazarSolicitud)...)

	// Invocación controlada por lista blanca (hito 2.5) — integradores (contrato OpenAPI)
	router.POST("/chaincode/invocar", append(authIntegradorOAdmin, handlers.InvocarChaincodeIntegrador)...)

	// Monitoreo de eventos de chaincode (hito 2.7): SSE + historial en memoria
	router.GET("/eventos/stream", append(authIntegradorOAdmin, handlers.StreamEventos)...)
	router.GET("/eventos/historial", append(authCualquierRol, handlers.ObtenerUltimosEventos)...)

	// Notificaciones de auditoría para administradores del tenant
	// (mutaciones hechas por integradores u otros roles).
	router.GET("/admin/notificaciones/stream", append(authSoloAdmin, handlers.StreamNotificacionesAdmin)...)
	router.GET("/admin/notificaciones", append(authSoloAdmin, handlers.HistorialNotificacionesAdmin)...)
	router.DELETE("/admin/notificaciones", append(authSoloAdmin, handlers.PurgarNotificacionesAdmin)...)

	// Auditoría del puente (bitácora en memoria + vista combinada con eventos de cadena)
	router.GET("/auditoria/http", append(authCualquierRol, handlers.ListarAuditoriaHTTP)...)
	router.GET("/auditoria/combinada", append(authCualquierRol, handlers.ListarAuditoriaCombinada)...)
	// Alias: peticiones al :3000 con prefijo /api (p. ej. proxy sin rewrite)
	router.GET("/api/auditoria/http", append(authCualquierRol, handlers.ListarAuditoriaHTTP)...)
	router.GET("/api/auditoria/combinada", append(authCualquierRol, handlers.ListarAuditoriaCombinada)...)

	// Rutas administrativas: fuera del OpenAPI público; validación omitida en middleware y API key obligatoria
	admin := router.Group("/admin")
	admin.Use(middleware.AdminAPIKey())
	{
		admin.POST("/chaincode/invocar", handlers.InvocarChaincodeAdmin)
	}
}
