package deepseek

import (
	"regexp"
	"strings"

	"web-portal-api/internal/platform"
)

// Draft es el borrador estructurado que el asistente va completando.
type Draft struct {
	Ready         bool                      `json:"ready"`
	OrgName       string                    `json:"orgName"`
	TenantID      string                    `json:"tenantId"`
	Domain        string                    `json:"domain"`
	ContactEmail  string                    `json:"contactEmail"`
	Users         []platform.RequestUser    `json:"users"`
	Integration   platform.IntegrationConfig `json:"integration"`
}

const systemPrompt = `Eres el asistente del Dev Portal de Nexum (BaaS sobre Hyperledger Fabric).
Ayudas a empresas nuevas a solicitar alta: organización, tenant_id, contacto, usuarios consola e integración API.

Modelo BaaS universal:
- POST/PUT /datos con datoId, tipo y payload JSON libre.
- El cliente NO toca Fabric ni yaml; el operador provisiona el canal.

Fases (una a la vez, en español, tono claro):
1) Nombre comercial y tenant_id (slug minúsculas a-z0-9-, 2-40 chars).
2) Dominio web y email de contacto.
3) Usuarios consola (username, nombre completo, rol: admin|integrador|lectura). Mínimo 1 admin.
4) Integración: qué entidad registran (agro, salud, ERP…), campo único → datoId, tipo, payload JSON ejemplo, stack (laravel|nodejs|curl).
5) Resumen y confirmación antes de marcar ready=true.

REGLAS:
- Pregunta de a una cosa si falta información.
- Explica sin jerga Hyperledger innecesaria.
- Al final de CADA respuesta incluye un bloque oculto para la UI (el usuario no debe depender de leerlo):

` + "```baas-draft\n{...json...}\n```" + `

El JSON del bloque baas-draft debe tener esta forma:
{
  "ready": false,
  "orgName": "",
  "tenantId": "",
  "domain": "",
  "contactEmail": "",
  "users": [{"username":"","nombreCompleto":"","rol":"admin"}],
  "integration": {
    "entityName": "",
    "businessIdField": "",
    "entityType": "",
    "schemaVersion": "v1",
    "attributes": [],
    "payloadExample": "{}",
    "stack": "laravel"
  }
}

Actualiza el borrador con todo lo recopilado hasta ahora en CADA respuesta (nunca omitas el bloque).
Usa EXACTAMENTE las claves en inglés camelCase del ejemplo (orgName, tenantId, contactEmail…).
Pon ready=true cuando hayas mostrado el resumen final Y el usuario diga que sí, confirmar, enviar, adelante o similar.
Si el usuario confirma el resumen, ready DEBE ser true en ese mismo turno.
El texto visible para el usuario debe ser conversacional; el bloque baas-draft es solo para el sistema.`

var draftBlockRE = regexp.MustCompile("(?s)`{3}baas-draft\\s*([\\s\\S]*?)`{3}")

func SystemPrompt() string { return systemPrompt }

// SplitReply separa el mensaje visible del borrador estructurado.
func SplitReply(raw string) (visible string, draft *Draft) {
	raw = strings.TrimSpace(raw)
	draft = extractDraftFromRaw(raw)
	visible = strings.TrimSpace(jsonFenceRE.ReplaceAllString(raw, ""))
	visible = strings.TrimSpace(draftBlockRE.ReplaceAllString(visible, ""))
	if visible == "" {
		visible = raw
		if draft != nil {
			// Quitar JSON suelto del final si quedó en visible
			if idx := strings.LastIndex(visible, "{"); idx > 0 {
				tail := strings.TrimSpace(visible[idx:])
				if normalizeDraft(tail) != nil {
					visible = strings.TrimSpace(visible[:idx])
				}
			}
		}
	}
	return visible, draft
}

func MergeDraft(base, update *Draft) *Draft {
	if update == nil {
		return base
	}
	out := Draft{}
	if base != nil {
		out = *base
	}
	if update.OrgName != "" {
		out.OrgName = update.OrgName
	}
	if update.TenantID != "" {
		out.TenantID = strings.ToLower(update.TenantID)
	}
	if update.Domain != "" {
		out.Domain = update.Domain
	}
	if update.ContactEmail != "" {
		out.ContactEmail = update.ContactEmail
	}
	if len(update.Users) > 0 {
		out.Users = update.Users
	}
	if update.Integration.EntityName != "" || update.Integration.EntityType != "" || update.Integration.PayloadExample != "" {
		mergeIntegration(&out.Integration, update.Integration)
	}
	if update.Ready {
		out.Ready = true
	}
	return &out
}

func mergeIntegration(dst *platform.IntegrationConfig, src platform.IntegrationConfig) {
	if src.EntityName != "" {
		dst.EntityName = src.EntityName
	}
	if src.BusinessIdField != "" {
		dst.BusinessIdField = src.BusinessIdField
	}
	if src.EntityType != "" {
		dst.EntityType = src.EntityType
	}
	if src.SchemaVersion != "" {
		dst.SchemaVersion = src.SchemaVersion
	}
	if len(src.Attributes) > 0 {
		dst.Attributes = src.Attributes
	}
	if strings.TrimSpace(src.PayloadExample) != "" && src.PayloadExample != "{}" {
		dst.PayloadExample = src.PayloadExample
	}
	if src.Stack != "" {
		dst.Stack = src.Stack
	}
}

// FieldsComplete indica si el borrador tiene los campos mínimos para enviar.
func (d *Draft) FieldsComplete() bool {
	if d == nil {
		return false
	}
	hasUser := false
	for _, u := range d.Users {
		if strings.TrimSpace(u.Username) != "" {
			hasUser = true
			break
		}
	}
	return strings.TrimSpace(d.OrgName) != "" &&
		platform.SlugValid(d.TenantID) &&
		strings.TrimSpace(d.ContactEmail) != "" &&
		hasUser
}

// CanSubmit permite enviar si hay datos completos (ready del LLM o confirmación del usuario).
func (d *Draft) CanSubmit(userConfirmed bool) bool {
	if !d.FieldsComplete() {
		return false
	}
	return d.Ready || userConfirmed
}
