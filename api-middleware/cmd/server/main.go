package main

import (
	"fmt"
	"log"
	"os"

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

	// 2. Conectar a la Blockchain (Fase 4)
	fmt.Println("Conectando a Hyperledger Fabric...")
	if err := fabric.Connect(); err != nil {
		log.Printf("ADVERTENCIA: No se pudo conectar a Fabric: %v\n", err)
		log.Println("El API correrá en modo desconectado (las llamadas a Fabric fallarán)")
	} else {
		fmt.Println("¡Conexión exitosa con Hyperledger Fabric!")
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
