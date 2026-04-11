package routes

import (
	"api-middleware/internal/handlers"
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
}
