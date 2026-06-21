package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"api-middleware/internal/bitacora"
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/internal/routes"
	"api-middleware/internal/tenants"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Cargar variables de entorno
	if err := godotenv.Load(".env"); err != nil {
		log.Println("Aviso: No se encontró el archivo .env, usando variables del sistema")
	}

	// 1.1 Configurar bitácora
	bitacora.ConfigurarBitacora()

	// 2. Cargar configuración de tenants (multi-tenant o legacy single-tenant)
	reg, srcPath, err := tenants.Load()
	if err != nil {
		log.Printf("ERROR cargando tenants: %v", err)
		bitacora.RegistrarFalloConexionFabric(err)
	} else {
		if srcPath != "" {
			fmt.Printf("Configuración multi-tenant cargada desde %s (%d tenants: %v)\n", srcPath, len(reg.Tenants), reg.IDs())
		} else {
			fmt.Printf("Configuración legacy single-tenant (tenant=%s)\n", reg.Default)
		}
	}

	// 3. Conectar a Hyperledger Fabric (todos los tenants)
	fmt.Println("Conectando a Hyperledger Fabric...")
	if reg != nil {
		if err := fabric.ConnectAll(reg); err != nil {
			log.Printf("ADVERTENCIA: conexión Fabric parcial o fallida: %v", err)
			bitacora.RegistrarFalloConexionFabric(err)
		} else {
			fmt.Println("¡Conexión exitosa con Hyperledger Fabric para todos los tenants!")
		}

		// 3.1 Suscripción a eventos: una por (tenant, chaincode)
		ctx := context.Background()
		for _, t := range reg.Tenants {
			if t == nil {
				continue
			}
			if cc := strings.TrimSpace(t.Chaincode); cc != "" {
				go fabric.StartEventListeningTenant(ctx, t.ID, t.Canal, cc)
			}
		}
	} else {
		log.Println("Sin configuración de tenants; el API correrá en modo degradado.")
	}

	// 3.2 Notificador a administradores: bus en memoria + canales SMTP/webhook/SSE.
	notificador.Default = notificador.Nuevo(reg, 256)
	notificador.Default.RegistrarCanal(notificador.NuevoCanalEmail(notificador.ConfigSMTPDesdeEnv()))
	notificador.Default.RegistrarCanal(notificador.NuevoCanalWebhook())
	notificador.Default.Iniciar(context.Background())
	fmt.Println("Notificador iniciado (canales registrados: email, webhook, sse)")

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// 4. Inicializar Gin
	router := gin.Default()

	// CORS (configurable vía CORS_ORIGINS; en dev se acepta * para que las webs externas
	// como la de Agricultura puedan integrar contra el middleware sin fricción)
	router.Use(corsMiddleware())

	// Auditoría HTTP (hito 2.8): id de operación + bitácora solicitud/resultado
	router.Use(middleware.AuditOperaciones())

	// Contrato OpenAPI
	specPath := os.Getenv("OPENAPI_SPEC")
	if specPath == "" {
		specPath = "openapi.yaml"
	}
	router.Use(middleware.OapiValidator(specPath))

	// 5. Rutas
	routes.SetupRoutes(router)

	// 6. Arrancar
	fmt.Printf("API Puente arrancada en puerto %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Error al iniciar el servidor: ", err)
	}
}

// corsMiddleware implementa una política CORS mínima configurable por variable
// de entorno CORS_ORIGINS. En desarrollo CORS_ORIGINS=* permite integrar webs
// de terceros (p. ej. la administradora de Agricultura).
func corsMiddleware() gin.HandlerFunc {
	rawOrigins := strings.TrimSpace(os.Getenv("CORS_ORIGINS"))
	if rawOrigins == "" {
		rawOrigins = "*"
	}
	allowAll := rawOrigins == "*"
	var allowed map[string]struct{}
	if !allowAll {
		allowed = map[string]struct{}{}
		for _, o := range strings.Split(rawOrigins, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				allowed[o] = struct{}{}
			}
		}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if allowAll {
				c.Header("Access-Control-Allow-Origin", "*")
			} else if _, ok := allowed[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-Admin-Api-Key, X-Actor-Name, X-Actor-Role, X-Actor-Username, X-Actor-Id, X-Correlation-Id")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Expose-Headers", "X-Operacion-Id")
		c.Header("Access-Control-Max-Age", "600")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
