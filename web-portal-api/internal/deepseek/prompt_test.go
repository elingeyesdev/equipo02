package deepseek

import (
	"encoding/json"
	"testing"

	"web-portal-api/internal/platform"
)

func TestSplitReplyBaasDraft(t *testing.T) {
	raw := "Hola, ¿cómo se llama tu empresa?\n\n```baas-draft\n{\"ready\":false,\"orgName\":\"Acme\",\"tenantId\":\"acme\"}\n```"
	visible, draft := SplitReply(raw)
	if visible == "" || draft == nil {
		t.Fatalf("visible=%q draft=%v", visible, draft)
	}
}

func TestMergeDraft(t *testing.T) {
	base := &Draft{OrgName: "Acme", TenantID: "acme"}
	merged := MergeDraft(base, &Draft{ContactEmail: "a@b.com", Domain: "https://acme.com"})
	if merged.ContactEmail != "a@b.com" || merged.OrgName != "Acme" {
		t.Fatalf("%+v", merged)
	}
}

func TestDraftJSONRoundtrip(t *testing.T) {
	d := Draft{Ready: true, TenantID: "demo", OrgName: "Demo", ContactEmail: "x@y.com",
		Users: []platform.RequestUser{{Username: "admin", NombreCompleto: "Admin", Rol: "admin"}}}
	b, _ := json.Marshal(d)
	var d2 Draft
	if err := json.Unmarshal(b, &d2); err != nil {
		t.Fatal(err)
	}
}
