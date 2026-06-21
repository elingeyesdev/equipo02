// Package tenants gestiona la configuración multi-tenant del middleware (BaaS).
//
// Cada tenant representa una empresa con su propia cadena (canal Fabric),
// su MSP/identidad y un conjunto de API keys vinculadas a roles.
//
// Si la variable de entorno TENANTS_FILE está definida y el archivo existe,
// la configuración se carga desde YAML. En caso contrario, se construye un
// registro single-tenant a partir de las variables clásicas (compat legacy),
// donde el único tenant se llama "clientes".
package tenants

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	// DefaultTenantID es el id del tenant legacy (compat single-tenant).
	DefaultTenantID = "clientes"

	// Roles canónicos (mismos que internal/middleware.api_key_roles.go).
	RoleAdmin       = "admin"
	RoleIntegrador  = "integrador"
	RoleSoloLectura = "solo_lectura"

	// Env var con la ruta del archivo de tenants.
	EnvTenantsFile = "TENANTS_FILE"
)

// Tenant describe una empresa cliente con su identidad Fabric y sus keys.
type Tenant struct {
	ID              string                 `yaml:"-"`
	Nombre          string                 `yaml:"nombre"`
	Descripcion     string                 `yaml:"descripcion"`
	MSPID           string                 `yaml:"msp_id"`
	CertPath        string                 `yaml:"cert_path"`
	KeyPathDir      string                 `yaml:"key_path_dir"`
	TLSCertPath     string                 `yaml:"tls_cert_path"`
	PeerEndpoint    string                 `yaml:"peer_endpoint"`
	PeerHostAlias   string                 `yaml:"peer_host_alias"`
	Canal           string                 `yaml:"canal"`
	Chaincode       string                 `yaml:"chaincode"`
	APIKeys         map[string]string      `yaml:"api_keys"`
	Notificaciones  *NotificacionesTenant  `yaml:"notificaciones,omitempty"`
}

// NotificacionesTenant define a quién avisar y bajo qué condiciones cuando
// un actor produce un cambio en este tenant. Se evalúa en el middleware
// después de cada mutación con respuesta 2xx.
type NotificacionesTenant struct {
	// Activado controla si el tenant emite notificaciones. Si es false,
	// los hooks ni siquiera evalúan los destinos.
	Activado bool `yaml:"activado"`

	// Eventos restringe los tipos de evento que disparan notificaciones.
	// Si está vacío, se notifican todos los tipos conocidos.
	// Ejemplos: "cliente.creado", "cliente.editado", "cliente.dado_de_baja",
	//           "dato.creado", "dato.editado", "dato.eliminado".
	Eventos []string `yaml:"eventos,omitempty"`

	// RolesActor filtra por el rol del actor que ejecutó la mutación.
	// Si está vacío se notifican mutaciones de cualquier rol.
	// Caso típico: ["integrador"] para avisar solo cuando un usuario no
	// administrador hizo el cambio.
	RolesActor []string `yaml:"roles_actor,omitempty"`

	// Destinos a los que se entrega cada notificación que pasa los filtros.
	Destinos []DestinoNotificacion `yaml:"destinos,omitempty"`
}

// DestinoNotificacion describe un canal de salida concreto.
type DestinoNotificacion struct {
	// Tipo: "email" | "webhook" | "sse". El destino "sse" está siempre
	// activo a nivel global porque el portal admin se conecta dinámicamente;
	// listarlo aquí es solo para hacerlo explícito en YAML.
	Tipo string `yaml:"tipo"`

	// Email
	Destinatarios []string `yaml:"destinatarios,omitempty"`
	Asunto        string   `yaml:"asunto,omitempty"`

	// Webhook
	URL    string `yaml:"url,omitempty"`
	Metodo string `yaml:"metodo,omitempty"` // POST por defecto

	// Encabezado opcional para firmar el webhook (HMAC o token estático).
	// Si se define, el valor se envía como `Authorization: Bearer <ese valor>`.
	Token string `yaml:"token,omitempty"`

	// Overrides locales (si no se rellenan, se heredan los del tenant).
	Eventos    []string `yaml:"eventos,omitempty"`
	RolesActor []string `yaml:"roles_actor,omitempty"`
}

// Match identifica una API key resuelta.
type Match struct {
	TenantID string
	Rol      string
}

// Registry contiene todos los tenants y un índice global de API key → (tenant, rol).
type Registry struct {
	Default  string
	Tenants  map[string]*Tenant
	keyIndex map[string]Match // apiKey → match
}

// archivoYAML refleja la estructura del archivo tenants.yaml.
type archivoYAML struct {
	Default string             `yaml:"default"`
	Tenants map[string]*Tenant `yaml:"tenants"`
}

// LoadFromFile carga el registro desde un YAML.
func LoadFromFile(path string) (*Registry, error) {
	abs := strings.TrimSpace(path)
	if abs == "" {
		return nil, errors.New("ruta de tenants vacía")
	}
	if !filepath.IsAbs(abs) {
		if a, err := filepath.Abs(abs); err == nil {
			abs = a
		}
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		return nil, fmt.Errorf("leer %s: %w", abs, err)
	}
	var doc archivoYAML
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("parsear %s: %w", abs, err)
	}
	if len(doc.Tenants) == 0 {
		return nil, fmt.Errorf("%s no define ningún tenant", abs)
	}
	for id, t := range doc.Tenants {
		if t == nil {
			return nil, fmt.Errorf("tenant %q vacío", id)
		}
		t.ID = id
	}
	if strings.TrimSpace(doc.Default) == "" {
		doc.Default = DefaultTenantID
	}
	if _, ok := doc.Tenants[doc.Default]; !ok {
		// si el default declarado no existe, tomar el primero por orden alfabético estable
		var first string
		for id := range doc.Tenants {
			if first == "" || id < first {
				first = id
			}
		}
		doc.Default = first
	}
	reg := &Registry{
		Default: doc.Default,
		Tenants: doc.Tenants,
	}
	if err := reg.buildIndex(); err != nil {
		return nil, err
	}
	return reg, nil
}

// LoadFromEnvLegacy construye un registro single-tenant a partir de las
// variables MSPID/CERT_PATH/... y de las API keys legacy.
// Se mantiene como fallback cuando TENANTS_FILE no está definido.
func LoadFromEnvLegacy() (*Registry, error) {
	t := &Tenant{
		ID:             DefaultTenantID,
		Nombre:         envOr("LEGACY_TENANT_NAME", "Sistema base"),
		MSPID:          os.Getenv("MSPID"),
		CertPath:       os.Getenv("CERT_PATH"),
		KeyPathDir:     os.Getenv("KEY_PATH_DIR"),
		TLSCertPath:    os.Getenv("TLS_CERT_PATH"),
		PeerEndpoint:   os.Getenv("PEER_ENDPOINT"),
		PeerHostAlias:  os.Getenv("PEER_HOST_ALIAS"),
		Canal:          envOr("CHANNEL_NAME", "datos"),
		Chaincode:      envOr("CHAINCODE_NAME", "dato_cc"),
		APIKeys:        map[string]string{},
	}
	addLegacyKey(t.APIKeys, "API_KEY_ADMIN", RoleAdmin)
	addLegacyKey(t.APIKeys, "API_KEY_INTEGRADOR", RoleIntegrador)
	addLegacyKey(t.APIKeys, "API_KEY_SOLO_LECTURA", RoleSoloLectura)
	reg := &Registry{
		Default: DefaultTenantID,
		Tenants: map[string]*Tenant{t.ID: t},
	}
	if err := reg.buildIndex(); err != nil {
		return nil, err
	}
	return reg, nil
}

// Load decide la fuente de configuración basada en TENANTS_FILE.
// Si TENANTS_FILE apunta a un archivo existente: carga ese YAML.
// En cualquier otro caso: legacy desde variables de entorno.
func Load() (*Registry, string, error) {
	path := strings.TrimSpace(os.Getenv(EnvTenantsFile))
	if path != "" {
		if _, err := os.Stat(path); err == nil {
			reg, err := LoadFromFile(path)
			if err != nil {
				return nil, path, err
			}
			return reg, path, nil
		}
	}
	reg, err := LoadFromEnvLegacy()
	return reg, "", err
}

// Get devuelve el tenant por id o nil.
func (r *Registry) Get(id string) *Tenant {
	if r == nil {
		return nil
	}
	return r.Tenants[strings.TrimSpace(id)]
}

// Lookup busca la API key en el índice global.
func (r *Registry) Lookup(apiKey string) (Match, bool) {
	if r == nil {
		return Match{}, false
	}
	m, ok := r.keyIndex[strings.TrimSpace(apiKey)]
	return m, ok
}

// IDs devuelve los identificadores de tenant ordenados.
func (r *Registry) IDs() []string {
	if r == nil {
		return nil
	}
	ids := make([]string, 0, len(r.Tenants))
	for id := range r.Tenants {
		ids = append(ids, id)
	}
	return ids
}

// MaxKeyLength se usa para reservar el comparador constant-time.
func (r *Registry) MaxKeyLength() int {
	max := 0
	for k := range r.keyIndex {
		if len(k) > max {
			max = len(k)
		}
	}
	return max
}

// Keys devuelve solo las claves indexadas (sin valor) para iteración en
// comparaciones constant-time.
func (r *Registry) Keys() []string {
	out := make([]string, 0, len(r.keyIndex))
	for k := range r.keyIndex {
		out = append(out, k)
	}
	return out
}

// buildIndex pobla keyIndex y valida que las keys sean únicas en el registro.
func (r *Registry) buildIndex() error {
	r.keyIndex = map[string]Match{}
	for _, t := range r.Tenants {
		for key, rol := range t.APIKeys {
			k := strings.TrimSpace(key)
			if k == "" {
				continue
			}
			rolNorm := normalizeRole(rol)
			if rolNorm == "" {
				return fmt.Errorf("tenant %s: rol inválido %q para api_key", t.ID, rol)
			}
			if prev, exists := r.keyIndex[k]; exists {
				return fmt.Errorf("api_key duplicada entre tenants %s y %s", prev.TenantID, t.ID)
			}
			r.keyIndex[k] = Match{TenantID: t.ID, Rol: rolNorm}
		}
	}
	return nil
}

func normalizeRole(r string) string {
	switch strings.TrimSpace(strings.ToLower(r)) {
	case "admin":
		return RoleAdmin
	case "integrador":
		return RoleIntegrador
	case "solo_lectura", "lectura", "solo-lectura":
		return RoleSoloLectura
	default:
		return ""
	}
}

func envOr(k, def string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	return v
}

func addLegacyKey(m map[string]string, env, rol string) {
	v := strings.TrimSpace(os.Getenv(env))
	if v == "" {
		return
	}
	m[v] = rol
}
