package chaincodepolicy

import "testing"

func TestCargarPoliticasPorDefecto(t *testing.T) {
	p, err := Cargar()
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Integrador) < 1 {
		t.Fatal("se esperaban reglas de integrador")
	}
	if len(p.Administracion) < len(p.Integrador) {
		t.Fatal("administracion debe incluir al menos las reglas del integrador")
	}
}
