package platform_test

import (
	"path/filepath"
	"testing"

	"web-portal-api/internal/db"
	"web-portal-api/internal/platform"
)

func TestStoreUpsertAndList(t *testing.T) {
	dir := t.TempDir()
	conn, err := db.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		t.Fatal(err)
	}
	store := platform.NewStore(conn)

	req, err := store.UpsertRequest(platform.UpsertRequestInput{
		TenantID:     "uc-demo",
		OrgName:      "Universidad Central",
		Domain:       "https://uc.edu",
		ContactEmail: "dev@uc.edu",
		Users: []platform.RequestUser{
			{Username: "olga", NombreCompleto: "Olga", Rol: "admin"},
		},
		Integration: platform.IntegrationConfig{EntityType: "alumno", Stack: "laravel"},
		Submit:      true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if req.Status != platform.StatusPending {
		t.Fatalf("status=%s", req.Status)
	}

	list, err := store.ListRequests(platform.StatusPending)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("list len=%d", len(list))
	}

	if err := store.MarkProvisioning(req.ID); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetRequestByID(req.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != platform.StatusProvisioning {
		t.Fatalf("status=%s", got.Status)
	}
}

func TestSlugValid(t *testing.T) {
	if !platform.SlugValid("uc-demo") {
		t.Fatal("expected valid")
	}
	if platform.SlugValid("-bad") {
		t.Fatal("expected invalid")
	}
}
