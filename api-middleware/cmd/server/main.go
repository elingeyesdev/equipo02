package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"api-middleware/internal/bitacora"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/routes"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Cargar variables de entorno
	// El .env está en la carpeta raíz del middleware
	err := godotenv.Load(".env")
	if err != nil {
		log.Println("Aviso: No se encontró el archivo .env, usando variables del sistema")
	}
	
	// 1.1 Configurar Bitácora (ahora que el .env ya está cargado)
	bitacora.ConfigurarBitacora()

	// 2. Conectar a la Blockchain (Fase 4)
	fmt.Println("Conectando a Hyperledger Fabric...")
	if err := fabric.Connect(); err != nil {
		log.Printf("ADVERTENCIA: No se pudo conectar a Fabric: %v\n", err)
		log.Println("El API correrá en modo desconectado (las llamadas a Fabric fallarán)")
	} else {
		fmt.Println("¡Conexión exitosa con Hyperledger Fabric!")

		// PASO 2: Iniciar suscripción/escucha de eventos desde el middleware
		ctx := context.Background()
		
		// Leemos los chaincodes configurados
		ccCliente := os.Getenv("CHAINCODE_NAME")
		ccToken := os.Getenv("TOKEN_CHAINCODE_NAME")

		if ccCliente != "" {
			go fabric.StartEventListening(ctx, ccCliente)
		}
		if ccToken != "" && ccToken != ccCliente {
			go fabric.StartEventListening(ctx, ccToken)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// 3. Inicializar Gin
	router := gin.Default()

	// 3. Registrar Middleware de Validación OpenAPI
	// El archivo openapi.yaml está en la carpeta raíz del middleware (api-middleware/)
	router.Use(middleware.OapiValidator("openapi.yaml"))

	// 4. Configurar Rutas
	routes.SetupRoutes(router)

	// 5. Iniciar servidor
	fmt.Printf("API Puente arrancada en puerto %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Error al iniciar el servidor: ", err)
	}
}
