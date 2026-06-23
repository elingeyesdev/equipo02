package handlers

import (
	"encoding/json"
	"testing"
)

func TestEsAppendOnly_soloAgregaActividad(t *testing.T) {
	actual := map[string]interface{}{
		"nombre":            "Lote A",
		"codigo_trazabilidad": "LOTE-1",
		"superficie":        10.0,
		"actividades": []interface{}{
			map[string]interface{}{
				"actividadid": 1.0, "descripcion": "Riego", "fechainicio": "2026-01-01T00:00:00Z",
			},
		},
		"producciones": []interface{}{},
	}
	nuevo := map[string]interface{}{
		"nombre":            "Lote A",
		"codigo_trazabilidad": "LOTE-1",
		"superficie":        10.0,
		"actividades": []interface{}{
			map[string]interface{}{
				"actividadid": 1.0, "descripcion": "Riego", "fechainicio": "2026-01-01T00:00:00Z",
			},
			map[string]interface{}{
				"actividadid": 2.0, "descripcion": "Siembra", "fechainicio": "2026-01-02T00:00:00Z",
			},
		},
		"producciones": []interface{}{},
	}
	if !esAppendOnly(actual, nuevo) {
		t.Fatal("se esperaba append-only")
	}
}

func TestEsAppendOnly_cambiaCabecera(t *testing.T) {
	actual := map[string]interface{}{"nombre": "Lote A", "actividades": []interface{}{}, "producciones": []interface{}{}}
	nuevo := map[string]interface{}{"nombre": "Lote B", "actividades": []interface{}{}, "producciones": []interface{}{}}
	if esAppendOnly(actual, nuevo) {
		t.Fatal("no debe ser append-only si cambia la cabecera")
	}
}

func TestEsAppendOnly_modificaActividadExistente(t *testing.T) {
	actual := map[string]interface{}{
		"nombre": "Lote A",
		"actividades": []interface{}{
			map[string]interface{}{"actividadid": 1.0, "descripcion": "Riego"},
		},
		"producciones": []interface{}{},
	}
	nuevo := map[string]interface{}{
		"nombre": "Lote A",
		"actividades": []interface{}{
			map[string]interface{}{"actividadid": 1.0, "descripcion": "Riego modificado"},
		},
		"producciones": []interface{}{},
	}
	if esAppendOnly(actual, nuevo) {
		t.Fatal("no debe ser append-only si edita actividad existente")
	}
}

func TestExtraerPayloadNegocio_desdeRaw(t *testing.T) {
	raw := json.RawMessage(`{"nombre":"X","actividades":[],"revisionLocal":3}`)
	m, err := extraerPayloadNegocio(raw)
	if err != nil {
		t.Fatal(err)
	}
	if m["nombre"] != "X" {
		t.Fatalf("nombre=%v", m["nombre"])
	}
	if _, ok := m["revisionLocal"]; ok {
		t.Fatal("revisionLocal debe eliminarse")
	}
}
