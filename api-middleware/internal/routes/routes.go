package routes

import (
	"api-middleware/internal/handlers"
	"api-middleware/internal/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes configura todos los endpoints del API Middleware.
func SetupRoutes(router *gin.Engine) {
	// Grupo de Clientes
	clientes := router.Group("/clientes")
	{
		clientes.POST("", handlers.RegistrarCliente)
		clientes.GET("/:clienteId", handlers.ConsultarCliente)
	}

	// Grupo de Tokens
	tokens := router.Group("/tokens")
	{
		tokens.POST("/emitir", handlers.EmitirToken)
		tokens.POST("/transferir", handlers.TransferirToken)
		tokens.GET("/saldo/:clienteId", handlers.ConsultarSaldo)
		tokens.GET("/historial/:clienteId", handlers.ConsultarHistorial)
	}

	// Endpoint unificado (detección automática — hito 2.4)
	router.POST("/operar", handlers.AutoRouteOperation)
	router.GET("/operar", handlers.AutoRouteOperation)

	// Invocación controlada por lista blanca (hito 2.5) — integradores (contrato OpenAPI)
	chaincode := router.Group("/chaincode")
	{
		chaincode.POST("/invocar", handlers.InvocarChaincodeIntegrador)
	}

	// Rutas administrativas: fuera del OpenAPI público; validación omitida en middleware y API key obligatoria
	admin := router.Group("/admin")
	admin.Use(middleware.AdminAPIKey())
	{
		admin.POST("/chaincode/invocar", handlers.InvocarChaincodeAdmin)
	}
}
