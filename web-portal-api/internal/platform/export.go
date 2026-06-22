package platform

import (
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
	"web-portal-api/internal/usuariosadmin"
)

// Rutas Fabric por defecto (Org1) para nuevos tenants — el operador puede ajustar el yaml manualmente.
const (
	defaultMSPID        = "Org1MSP"
	defaultCertPath     = "../red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem"
	defaultKeyPathDir   = "../red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore"
	defaultTLSCertPath  = "../red-hyperledger/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/tlscacerts/tls-localhost-7054-ca-org1.pem"
	defaultPeerEndpoint = "localhost:7051"
	defaultPeerHost     = "peer0.org1.example.com"
)

type tenantsYAML struct {
	Default string                       `yaml:"default"`
	Tenants map[string]tenantYAMLBlock   `yaml:"tenants"`
}

type tenantYAMLBlock struct {
	Nombre        string            `yaml:"nombre"`
	Descripcion   string            `yaml:"descripcion"`
	MSPID         string            `yaml:"msp_id"`
	CertPath      string            `yaml:"cert_path"`
	KeyPathDir    string            `yaml:"key_path_dir"`
	TLSCertPath   string            `yaml:"tls_cert_path"`
	PeerEndpoint  string            `yaml:"peer_endpoint"`
	PeerHostAlias string            `yaml:"peer_host_alias"`
	Canal         string            `yaml:"canal"`
	Chaincode     string            `yaml:"chaincode"`
	APIKeys       map[string]string `yaml:"api_keys"`
	Notificaciones notifYAMLBlock   `yaml:"notificaciones"`
}

type notifYAMLBlock struct {
	Activado   bool     `yaml:"activado"`
	Eventos    []string `yaml:"eventos"`
	RolesActor []string `yaml:"roles_actor"`
	Destinos   []map[string]interface{} `yaml:"destinos"`
}

type Exporter struct {
	TenantsYAMLPath     string
	UsuariosAdminPath   string
}

func NewExporter(tenantsPath, usuariosPath string) *Exporter {
	return &Exporter{TenantsYAMLPath: tenantsPath, UsuariosAdminPath: usuariosPath}
}

func middlewareRole(rol string) string {
	if rol == "lectura" {
		return "solo_lectura"
	}
	return rol
}

func (e *Exporter) ActivateTenant(req *TenantRequest, keys map[string]string) (map[string]string, error) {
	userPasswords := make(map[string]string)
	for _, u := range req.Users {
		pwd, err := GeneratePassword()
		if err != nil {
			return nil, err
		}
		userPasswords[u.Username] = pwd
	}

	if err := e.mergeTenantsYAML(req, keys); err != nil {
		return nil, fmt.Errorf("export tenants.yaml: %w", err)
	}
	if err := e.mergeUsuariosYAML(req, keys, userPasswords); err != nil {
		return nil, fmt.Errorf("export usuarios-admin.yaml: %w", err)
	}
	return userPasswords, nil
}

func (e *Exporter) mergeTenantsYAML(req *TenantRequest, keys map[string]string) error {
	var doc tenantsYAML
	raw, err := os.ReadFile(e.TenantsYAMLPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return err
		}
		doc = tenantsYAML{Default: "agricultura", Tenants: map[string]tenantYAMLBlock{}}
	} else {
		if err := yaml.Unmarshal(raw, &doc); err != nil {
			return err
		}
		if doc.Tenants == nil {
			doc.Tenants = map[string]tenantYAMLBlock{}
		}
	}

	apiKeys := map[string]string{}
	for rol, keyVal := range keys {
		apiKeys[keyVal] = middlewareRole(rol)
	}

	email := req.ContactEmail
	if email == "" {
		email = fmt.Sprintf("admin-%s@example.com", req.TenantID)
	}

	doc.Tenants[req.TenantID] = tenantYAMLBlock{
		Nombre:        req.OrgName,
		Descripcion:   fmt.Sprintf("Tenant %s provisionado desde dev portal.", req.TenantID),
		MSPID:         defaultMSPID,
		CertPath:      defaultCertPath,
		KeyPathDir:    defaultKeyPathDir,
		TLSCertPath:   defaultTLSCertPath,
		PeerEndpoint:  defaultPeerEndpoint,
		PeerHostAlias: defaultPeerHost,
		Canal:         req.TenantID,
		Chaincode:     "dato_cc",
		APIKeys:       apiKeys,
		Notificaciones: notifYAMLBlock{
			Activado: true,
			Eventos: []string{
				"dato.creado", "dato.editado", "dato.eliminado", "dato.restaurado", "solicitud.creada",
			},
			RolesActor: []string{"integrador"},
			Destinos: []map[string]interface{}{
				{
					"tipo": "email",
					"asunto": fmt.Sprintf("[%s] {tipo} → {recurso}", req.OrgName),
					"destinatarios": []string{email},
				},
			},
		},
	}

	out, err := yaml.Marshal(&doc)
	if err != nil {
		return err
	}
	header := "# tenants.yaml — actualizado por web-portal-api (dev portal)\n# Reiniciar api-middleware tras cambios.\n\n"
	return os.WriteFile(e.TenantsYAMLPath, append([]byte(header), out...), 0o644)
}

func (e *Exporter) mergeUsuariosYAML(req *TenantRequest, keys map[string]string, passwords map[string]string) error {
	var doc usuariosadmin.Configuracion
	raw, err := os.ReadFile(e.UsuariosAdminPath)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return err
	}
	if doc.Tenants == nil {
		doc.Tenants = map[string]usuariosadmin.TenantConfig{}
	}

	doc.Tenants[req.TenantID] = usuariosadmin.TenantConfig{
		Nombre: req.OrgName,
		APIKeys: map[string]string{
			"admin":       keys["admin"],
			"integrador":  keys["integrador"],
			"lectura":     keys["lectura"],
		},
	}

	for _, u := range req.Users {
		pwd := passwords[u.Username]
		hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		doc.Usuarios = append(doc.Usuarios, usuariosadmin.Usuario{
			Usuario:        u.Username,
			ContrasenaHash: string(hash),
			NombreCompleto: u.NombreCompleto,
			Rol:            u.Rol,
			Tenant:         req.TenantID,
		})
	}

	out, err := yaml.Marshal(&doc)
	if err != nil {
		return err
	}
	header := "# usuarios-admin.yaml — actualizado por web-portal-api (dev portal)\n\n"
	return os.WriteFile(e.UsuariosAdminPath, append([]byte(header), out...), 0o644)
}

func SlugValid(slug string) bool {
	slug = strings.TrimSpace(strings.ToLower(slug))
	if len(slug) < 2 || len(slug) > 40 {
		return false
	}
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			continue
		}
		return false
	}
	return !strings.HasPrefix(slug, "-") && !strings.HasSuffix(slug, "-")
}
