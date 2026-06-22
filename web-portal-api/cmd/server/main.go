package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"web-portal-api/internal/config"
	"web-portal-api/internal/db"
	"web-portal-api/internal/deepseek"
	"web-portal-api/internal/devportal"
	"web-portal-api/internal/handlers"
	"web-portal-api/internal/middleware"
	"web-portal-api/internal/platform"
	"web-portal-api/internal/usuariosadmin"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	conn, err := db.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("base de datos: %v", err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		log.Fatalf("migración: %v", err)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "servicio": "web-portal-api"})
	})

	// Consola BaaS (web-cliente-demo): login JWT + proxy genérico al middleware.
	registroAdmin := usuariosadmin.Nuevo()
	if err := registroAdmin.LoadFromFile(cfg.UsuariosAdminFile); err != nil {
		if errors.Is(err, usuariosadmin.ErrConfiguracionAusente) {
			log.Printf("usuariosadmin: %s no encontrado, /admin/* devolverá 503", cfg.UsuariosAdminFile)
		} else {
			log.Fatalf("usuariosadmin: %v", err)
		}
	} else {
		_, ruta, _, total := registroAdmin.Estado()
		log.Printf("usuariosadmin cargado: %d cuentas desde %s", total, ruta)
	}
	revocAdmin := handlers.NuevaRevocacionesPersistentes(conn)
	adminAuthH := &handlers.AdminAuthHandler{Cfg: cfg, Registro: registroAdmin, Revocador: revocAdmin}
	adminProxyH := &handlers.AdminProxyHandler{Cfg: cfg, Registro: registroAdmin}
	adminAuthMW := middleware.RequireAdminAuth(cfg, revocAdmin)

	r.POST("/admin/auth/login", adminAuthH.Login)
	r.GET("/admin/auth/me", adminAuthMW, adminAuthH.Me)
	r.POST("/admin/auth/logout", adminAuthMW, adminAuthH.Logout)
	r.Any("/admin/api/*proxyPath", adminAuthMW, adminProxyH.Proxy)

	// Dev portal + operador plataforma BaaS
	platformStore := platform.NewStore(conn)
	if err := platformStore.EnsurePlatformOperator(cfg.PlatformAdminUser, cfg.PlatformAdminPass, "Operador CampusChain"); err != nil {
		log.Fatalf("platform operator seed: %v", err)
	}
	exporter := platform.NewExporter(cfg.TenantsYAMLFile, cfg.UsuariosAdminFile)
	dsClient := deepseek.NewClient(cfg.DeepSeekAPIKey, cfg.DeepSeekAPIURL, cfg.DeepSeekModel)
	if dsClient.Configured() {
		log.Printf("deepseek chat habilitado (modelo=%s)", cfg.DeepSeekModel)
	} else {
		log.Printf("deepseek: sin DEEPSEEK_API_KEY, /dev/chat devolverá 503")
	}
	devH := &handlers.DevHandler{Cfg: cfg, Store: platformStore, Exporter: exporter, DeepSeek: dsClient}
	devStore := devportal.NewStore(conn)
	devRevoc := devportal.NewDevRevocador(conn)
	devAuthH := &handlers.DevAuthHandler{Cfg: cfg, DevStore: devStore, Platform: platformStore, Revocador: devRevoc}
	devAuthMW := middleware.RequireDevAuth(cfg, devRevoc)
	devOptionalMW := middleware.OptionalDevAuth(cfg, devRevoc)
	platformAuthH := &handlers.PlatformAuthHandler{Cfg: cfg, Store: platformStore, Revocador: revocAdmin}
	platformH := &handlers.PlatformHandler{Cfg: cfg, Store: platformStore, Exporter: exporter, Registro: registroAdmin}
	platformAuthMW := middleware.RequirePlatformAuth(cfg, revocAdmin)

	r.POST("/dev/auth/registro", devAuthH.Register)
	r.POST("/dev/auth/login", devAuthH.Login)
	r.GET("/dev/auth/me", devAuthMW, devAuthH.Me)
	r.POST("/dev/auth/logout", devAuthMW, devAuthH.Logout)
	r.GET("/dev/mis-solicitudes", devAuthMW, devAuthH.MisSolicitudes)

	r.POST("/dev/solicitudes", devOptionalMW, devH.UpsertSolicitud)
	r.GET("/dev/solicitudes/:id", devOptionalMW, devH.GetSolicitud)
	r.GET("/dev/solicitudes/:id/credenciales", devOptionalMW, devH.GetCredenciales)
	r.GET("/dev/chat/status", devH.ChatStatus)
	r.POST("/dev/chat", devH.Chat)

	r.POST("/platform/auth/login", platformAuthH.Login)
	r.GET("/platform/solicitudes", platformAuthMW, platformH.ListSolicitudes)
	r.GET("/platform/solicitudes/:id", platformAuthMW, platformH.GetSolicitud)
	r.POST("/platform/solicitudes/:id/marcar-provisioning", platformAuthMW, platformH.MarcarProvisioning)
	r.POST("/platform/solicitudes/:id/activar", platformAuthMW, platformH.Activar)
	r.POST("/platform/solicitudes/:id/rechazar", platformAuthMW, platformH.Rechazar)

	log.Printf("web-portal-api escuchando en :%s (middleware=%s)", cfg.Port, cfg.MiddlewareURL)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
