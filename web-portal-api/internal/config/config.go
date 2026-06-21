package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port              string
	JWTSecret         string
	DatabasePath      string
	MiddlewareURL     string
	JWTExpiry         time.Duration
	// UsuariosAdminFile apunta al YAML con las cuentas humanas de la
	// consola del puente (web-cliente-demo). Si está vacío o no existe,
	// los endpoints /admin/* responderán 503 hasta que se configure.
	UsuariosAdminFile string
}

func Load() Config {
	_ = os.Setenv("GIN_MODE", ginMode())
	expHours := 8
	if v := strings.TrimSpace(os.Getenv("JWT_EXPIRY_HOURS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			expHours = n
		}
	}
	return Config{
		Port:              envOr("PORT", "3001"),
		JWTSecret:         envOr("JWT_SECRET", "dev-secret-cambiar-en-produccion"),
		DatabasePath:      envOr("DATABASE_PATH", "./data/portal.db"),
		MiddlewareURL:     strings.TrimRight(envOr("API_MIDDLEWARE_URL", "http://127.0.0.1:3000"), "/"),
		JWTExpiry:         time.Duration(expHours) * time.Hour,
		UsuariosAdminFile: envOr("USUARIOS_ADMIN_FILE", "./config/usuarios-admin.yaml"),
	}
}

func ginMode() string {
	if strings.EqualFold(os.Getenv("GIN_MODE"), "debug") {
		return "debug"
	}
	return "release"
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}
