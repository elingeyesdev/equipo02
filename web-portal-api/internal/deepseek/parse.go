package deepseek

import (
	"encoding/json"
	"regexp"
	"strings"

	"web-portal-api/internal/platform"
)

var jsonFenceRE = regexp.MustCompile("(?s)`{3}(?:json|baas-draft)?\\s*([\\s\\S]*?)`{3}")

func pickString(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func pickBool(m map[string]interface{}, keys ...string) bool {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if b, ok := v.(bool); ok {
				return b
			}
		}
	}
	return false
}

// normalizeDraft acepta JSON del modelo con claves alternativas (español, snake_case).
func normalizeDraft(raw string) *Draft {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil
	}

	d := &Draft{
		Ready:        pickBool(m, "ready", "listo", "confirmado"),
		OrgName:      pickString(m, "orgName", "org_name", "nombre_empresa", "nombreEmpresa", "nombre_comercial", "empresa"),
		TenantID:     strings.ToLower(pickString(m, "tenantId", "tenant_id", "slug")),
		Domain:       pickString(m, "domain", "dominio", "dominio_web"),
		ContactEmail: pickString(m, "contactEmail", "contact_email", "email", "correo"),
	}

	if usersRaw, ok := m["users"].([]interface{}); ok {
		for _, item := range usersRaw {
			um, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			u := platform.RequestUser{
				Username:       pickString(um, "username", "usuario"),
				NombreCompleto: pickString(um, "nombreCompleto", "nombre_completo", "nombre"),
				Rol:            pickString(um, "rol", "role"),
			}
			if u.Rol == "" {
				u.Rol = "admin"
			}
			if u.Username != "" {
				d.Users = append(d.Users, u)
			}
		}
	}

	if integ, ok := m["integration"].(map[string]interface{}); ok {
		d.Integration = platform.IntegrationConfig{
			EntityName:      pickString(integ, "entityName", "entity_name", "entidad"),
			BusinessIdField: pickString(integ, "businessIdField", "business_id_field", "campo_id", "datoId"),
			EntityType:      pickString(integ, "entityType", "entity_type", "tipo"),
			SchemaVersion:   pickString(integ, "schemaVersion", "schema_version"),
			PayloadExample:  pickString(integ, "payloadExample", "payload_example", "payload"),
			Stack:           pickString(integ, "stack"),
		}
		if attrsRaw, ok := integ["attributes"].([]interface{}); ok {
			for _, item := range attrsRaw {
				am, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				key := pickString(am, "key", "nombre", "name")
				if key == "" {
					continue
				}
				d.Integration.Attributes = append(d.Integration.Attributes, platform.AttributeDraft{
					Key:      key,
					Label:    pickString(am, "label", "etiqueta"),
					Type:     pickString(am, "type", "tipo"),
					Required: pickBool(am, "required", "requerido", "obligatorio"),
				})
			}
		}
	}
	if d.Integration.SchemaVersion == "" {
		d.Integration.SchemaVersion = "v1"
	}
	if d.Integration.Stack == "" {
		d.Integration.Stack = "laravel"
	}
	if d.Integration.PayloadExample == "" {
		d.Integration.PayloadExample = "{}"
	}

	// Borrador vacío
	if d.OrgName == "" && d.TenantID == "" && d.ContactEmail == "" && len(d.Users) == 0 {
		return nil
	}
	return d
}

func extractDraftFromRaw(raw string) *Draft {
	raw = strings.TrimSpace(raw)
	// Preferir bloque baas-draft
	if m := draftBlockRE.FindStringSubmatch(raw); len(m) == 2 {
		if d := normalizeDraft(m[1]); d != nil {
			return d
		}
	}
	// Cualquier bloque ```json o ```baas-draft
	matches := jsonFenceRE.FindAllStringSubmatch(raw, -1)
	for i := len(matches) - 1; i >= 0; i-- {
		if d := normalizeDraft(matches[i][1]); d != nil {
			return d
		}
	}
	// JSON suelto al final
	if idx := strings.Index(raw, "{"); idx >= 0 {
		if d := normalizeDraft(raw[idx:]); d != nil {
			return d
		}
	}
	return nil
}

func UserConfirmedSend(text string) bool {
	t := strings.ToLower(strings.TrimSpace(text))
	phrases := []string{
		"sí", "si", "yes", "confirmo", "confirmar", "enviar", "adelante",
		"de acuerdo", "correcto", "ok", "vale", "listo", "envía", "envia",
		"procede", "hazlo", "acepto",
	}
	for _, p := range phrases {
		if t == p || strings.HasPrefix(t, p+" ") || strings.Contains(t, " "+p) {
			return true
		}
	}
	return false
}
