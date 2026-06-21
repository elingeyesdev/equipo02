package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"web-portal-api/internal/config"
	"web-portal-api/internal/db"
	"web-portal-api/internal/handlers"
	"web-portal-api/internal/middleware"
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
	// El frontend llama /admin/api/datos, /admin/api/solicitudes, /admin/api/auditoria/…
	// El BFF inyecta X-API-Key real según tenant/rol (usuarios-admin.yaml).
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

	log.Printf("web-portal-api escuchando en :%s (middleware=%s)", cfg.Port, cfg.MiddlewareURL)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
