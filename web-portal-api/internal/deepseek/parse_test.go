package deepseek

import (
	"testing"

	"web-portal-api/internal/platform"
)

func TestNormalizeDraftSpanishKeys(t *testing.T) {
	raw := `{
		"nombre_empresa": "TechInnovation",
		"tenant_id": "tech-innovation",
		"contact_email": "dev@tech.com",
		"users": [{"usuario": "admin", "nombre_completo": "Admin", "rol": "admin"}],
		"integration": {"entity_type": "empresa", "stack": "laravel"}
	}`
	d := normalizeDraft(raw)
	if d == nil || d.OrgName != "TechInnovation" || d.TenantID != "tech-innovation" {
		t.Fatalf("%+v", d)
	}
	if !d.FieldsComplete() {
		t.Fatal("expected complete")
	}
}

func TestUserConfirmedSend(t *testing.T) {
	if !UserConfirmedSend("sí, enviar") {
		t.Fatal("expected confirm")
	}
	if UserConfirmedSend("no gracias") {
		t.Fatal("expected false")
	}
}

func TestNormalizeDraftAttributes(t *testing.T) {
	raw := `{
		"orgName": "Acme",
		"tenantId": "acme",
		"contactEmail": "a@b.com",
		"integration": {
			"entityType": "lote",
			"stack": "laravel",
			"attributes": [
				{"key": "codigo", "label": "Código", "type": "texto", "required": true}
			]
		}
	}`
	d := normalizeDraft(raw)
	if d == nil || len(d.Integration.Attributes) != 1 {
		t.Fatalf("expected attributes, got %+v", d)
	}
	if d.Integration.Attributes[0].Key != "codigo" || !d.Integration.Attributes[0].Required {
		t.Fatalf("attribute parse failed: %+v", d.Integration.Attributes[0])
	}
}

func TestCanSubmitWithoutReadyFlag(t *testing.T) {
	d := &Draft{
		OrgName: "Acme", TenantID: "acme", ContactEmail: "a@b.com",
		Users: []platform.RequestUser{{Username: "admin", Rol: "admin"}},
	}
	if !d.CanSubmit(true) {
		t.Fatal("user confirm should allow submit")
	}
}
