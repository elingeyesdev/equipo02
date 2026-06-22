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
	TenantsYAMLFile   string
	PlatformAdminUser string
	PlatformAdminPass string
	DeepSeekAPIKey    string
	DeepSeekAPIURL    string
	DeepSeekModel     string
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
		TenantsYAMLFile:   envOr("TENANTS_YAML_FILE", "../api-middleware/config/tenants.yaml"),
		PlatformAdminUser: envOr("PLATFORM_ADMIN_USER", "platform-admin"),
		PlatformAdminPass: envOr("PLATFORM_ADMIN_PASS", "platform-admin-2026"),
		DeepSeekAPIKey:    envOr("DEEPSEEK_API_KEY", ""),
		DeepSeekAPIURL:    envOr("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions"),
		DeepSeekModel:     envOr("DEEPSEEK_MODEL", "deepseek-chat"),
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
