package aprobaciones

import "testing"

func TestCrearListarAislaPorTenant(t *testing.T) {
	s := NewStore()
	s.Crear(Solicitud{Tenant: "agricultura", Operacion: OpCrear, DatoID: "P-1", Solicitante: "ana"})
	s.Crear(Solicitud{Tenant: "salud", Operacion: OpCrear, DatoID: "H-1", Solicitante: "beto"})

	agro := s.Listar("agricultura", "")
	if len(agro) != 1 || agro[0].DatoID != "P-1" {
		t.Fatalf("agricultura debe ver solo su solicitud, got %+v", agro)
	}
	salud := s.Listar("salud", "")
	if len(salud) != 1 || salud[0].DatoID != "H-1" {
		t.Fatalf("salud debe ver solo su solicitud, got %+v", salud)
	}
}

func TestResolverSoloUnaVez(t *testing.T) {
	s := NewStore()
	sol := s.Crear(Solicitud{Tenant: "agricultura", Operacion: OpActualizar, DatoID: "P-1", Solicitante: "ana"})
	if sol.Estado != Pendiente {
		t.Fatalf("una solicitud nueva debe quedar pendiente, got %s", sol.Estado)
	}

	aprobada, err := s.Resolver("agricultura", sol.ID, Aprobada, "admin", "", "tx-123")
	if err != nil {
		t.Fatalf("primera resolución no debe fallar: %v", err)
	}
	if aprobada.Estado != Aprobada || aprobada.TxIDResultado != "tx-123" {
		t.Fatalf("estado/tx incorrectos: %+v", aprobada)
	}

	if _, err := s.Resolver("agricultura", sol.ID, Rechazada, "admin", "tarde", ""); err == nil {
		t.Fatalf("no se debe poder resolver dos veces")
	}
}

func TestResolverRespetaTenant(t *testing.T) {
	s := NewStore()
	sol := s.Crear(Solicitud{Tenant: "agricultura", Operacion: OpEliminar, DatoID: "P-9", Solicitante: "ana"})
	if _, err := s.Resolver("salud", sol.ID, Aprobada, "admin-salud", "", "tx"); err == nil {
		t.Fatalf("un tenant no debe poder resolver solicitudes de otro")
	}
}

func TestListarFiltraPorEstado(t *testing.T) {
	s := NewStore()
	a := s.Crear(Solicitud{Tenant: "t", Operacion: OpCrear, DatoID: "1"})
	s.Crear(Solicitud{Tenant: "t", Operacion: OpCrear, DatoID: "2"})
	if _, err := s.Resolver("t", a.ID, Aprobada, "admin", "", "tx"); err != nil {
		t.Fatal(err)
	}
	if got := s.Listar("t", Pendiente); len(got) != 1 {
		t.Fatalf("esperaba 1 pendiente, got %d", len(got))
	}
	if got := s.Listar("t", Aprobada); len(got) != 1 {
		t.Fatalf("esperaba 1 aprobada, got %d", len(got))
	}
}
