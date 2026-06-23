package handlers

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)
func extraerPayloadNegocio(raw json.RawMessage) (map[string]interface{}, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("payload vacío")
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	// Respuesta ReadDato: record con campo payload.
	if p, ok := root["payload"]; ok {
		return normalizarMapaPayload(p)
	}
	return normalizarMapaPayload(root)
}

func normalizarMapaPayload(v interface{}) (map[string]interface{}, error) {
	switch t := v.(type) {
	case map[string]interface{}:
		m := t
		if nested, ok := m["payload"]; ok {
			if inner, err := normalizarMapaPayload(nested); err == nil {
				m = inner
			}
		}
		delete(m, "_baasMeta")
		delete(m, "sincronizadoEn")
		delete(m, "revisionLocal")
		return m, nil
	case string:
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(strings.TrimSpace(t)), &m); err != nil {
			return nil, err
		}
		return normalizarMapaPayload(m)
	default:
		return nil, fmt.Errorf("payload no interpretable")
	}
}

func payloadNegocioDesdeReadDato(raw []byte) (map[string]interface{}, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("sin datos on-chain")
	}
	var record map[string]interface{}
	if err := json.Unmarshal(raw, &record); err != nil {
		return nil, err
	}
	payloadRaw, ok := record["payload"]
	if !ok {
		b, _ := json.Marshal(record)
		return extraerPayloadNegocio(b)
	}
	switch p := payloadRaw.(type) {
	case string:
		return extraerPayloadNegocio(json.RawMessage(p))
	default:
		b, err := json.Marshal(p)
		if err != nil {
			return nil, err
		}
		return extraerPayloadNegocio(b)
	}
}

// esAppendOnly indica si el payload nuevo solo agrega actividades/producciones
// sin modificar cabecera del lote ni editar/eliminar hijos existentes.
func esAppendOnly(actual, nuevo map[string]interface{}) bool {
	if actual == nil {
		return true
	}
	for _, k := range camposCabeceraLote() {
		if !valoresEquivalentes(actual[k], nuevo[k]) {
			return false
		}
	}
	if !hijosSoloAppend(actual["actividades"], nuevo["actividades"], "actividadid", camposActividad()) {
		return false
	}
	if !hijosSoloAppend(actual["producciones"], nuevo["producciones"], "produccionid", camposProduccion()) {
		return false
	}
	return true
}

func camposCabeceraLote() []string {
	return []string{
		"loteid", "codigo_trazabilidad", "nombre", "cultivo", "cultivoid",
		"agricultor", "usuarioid", "superficie", "unidad_superficie", "unidadsuperficieid",
		"ubicacion", "fechasiembra", "estado", "estadolotetipoid", "latitud", "longitud",
		"fechacreacion",
	}
}

func camposActividad() []string {
	return []string{
		"actividadid", "descripcion", "fechainicio", "fechafin",
		"tipo", "tipoactividadid", "prioridad", "prioridadid",
		"usuario", "usuarioid", "observaciones",
	}
}

func camposProduccion() []string {
	return []string{
		"produccionid", "cantidad", "unidad", "unidadmedidaid",
		"fechacosecha", "destino", "destinoproduccionid", "observaciones",
	}
}

func hijosSoloAppend(actualRaw, nuevoRaw interface{}, idKey string, campos []string) bool {
	actual := listaMapas(actualRaw)
	nuevo := listaMapas(nuevoRaw)
	if len(nuevo) < len(actual) {
		return false
	}
	actualPorID := map[string]map[string]interface{}{}
	for _, item := range actual {
		id := idComoString(item[idKey])
		if id == "" {
			return false
		}
		actualPorID[id] = item
	}
	vistos := map[string]bool{}
	for _, item := range nuevo {
		id := idComoString(item[idKey])
		if id == "" {
			continue
		}
		vistos[id] = true
		prev, ok := actualPorID[id]
		if ok {
			for _, c := range campos {
				if !valoresEquivalentes(prev[c], item[c]) {
					return false
				}
			}
		}
	}
	for id := range actualPorID {
		if !vistos[id] {
			return false
		}
	}
	return true
}

func listaMapas(v interface{}) []map[string]interface{} {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	out := make([]map[string]interface{}, 0, len(arr))
	for _, el := range arr {
		if m, ok := el.(map[string]interface{}); ok {
			out = append(out, m)
		}
	}
	return out
}

func idComoString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case float64:
		return fmt.Sprintf("%.0f", t)
	case json.Number:
		return t.String()
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func valoresEquivalentes(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	// Comparación numérica laxa (JSON unmarshals numbers as float64).
	if fa, ok := a.(float64); ok {
		if fb, ok := b.(float64); ok {
			return fa == fb
		}
		if sb, ok := b.(string); ok {
			return fmt.Sprintf("%v", fa) == strings.TrimSpace(sb)
		}
	}
	if sa, ok := a.(string); ok {
		if sb, ok := b.(string); ok {
			return strings.TrimSpace(sa) == strings.TrimSpace(sb)
		}
	}
	return reflect.DeepEqual(a, b)
}
