package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func Open(path string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", filepath.ToSlash(path))
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

func Migrate(conn *sql.DB) error {
	_, err := conn.Exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','integrador','lectura')),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  jti TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(jti);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_username ON admin_sessions(username);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_jti ON admin_sessions(jti);

CREATE TABLE IF NOT EXISTS tenant_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','provisioning','active','rejected')),
  tenant_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
  org_name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  integration_json TEXT NOT NULL DEFAULT '{}',
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_request_users (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES tenant_requests(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','integrador','lectura')),
  password_plain_temp TEXT,
  UNIQUE(request_id, username COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  canal TEXT NOT NULL,
  chaincode TEXT NOT NULL DEFAULT 'dato_cc',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  request_id TEXT REFERENCES tenant_requests(id),
  activated_at TEXT
);

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin','integrador','lectura')),
  key_value TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS platform_operators (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL DEFAULT 'Operador BaaS',
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_requests_status ON tenant_requests(status);
CREATE INDEX IF NOT EXISTS idx_tenant_request_users_request ON tenant_request_users(request_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant ON tenant_api_keys(tenant_id);

CREATE TABLE IF NOT EXISTS dev_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dev_sessions (
  id TEXT PRIMARY KEY,
  dev_user_id TEXT NOT NULL,
  jti TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_user ON dev_sessions(dev_user_id);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_jti ON dev_sessions(jti);
`)
	if err != nil {
		return err
	}
	// Columna opcional en bases ya creadas
	_, err = conn.Exec(`ALTER TABLE tenant_requests ADD COLUMN dev_user_id TEXT REFERENCES dev_users(id)`)
	if err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
		return err
	}
	_, err = conn.Exec(`CREATE INDEX IF NOT EXISTS idx_tenant_requests_dev_user ON tenant_requests(dev_user_id)`)
	return err
}
