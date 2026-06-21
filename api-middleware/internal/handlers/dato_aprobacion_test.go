package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"api-middleware/internal/aprobaciones"
	"api-middleware/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Un integrador NO escribe directo en la cadena: su POST /datos genera una
// solicitud PENDIENTE y responde 202, sin tocar Fabric.
func TestCrearDato_integrador_generaSolicitudPendiente(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	const tenant = "tenant-test-integrador"
	c.Set(middleware.ContextAPIRole, middleware.RoleIntegrador)
	c.Set(middleware.ContextAPITenant, tenant)

	body := `{"datoId":"DATO-1","tipo":"expediente","payload":{"campo":"valor"}}`
	c.Request, _ = http.NewRequest(http.MethodPost, "/datos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("X-Actor-Username", "integrador-ana")

	CrearDato(c)

	if w.Code != http.StatusAccepted {
		t.Fatalf("esperado 202 (pendiente), obtuvo %d: %s", w.Code, w.Body.String())
	}
	pend := aprobaciones.Default.Listar(tenant, aprobaciones.Pendiente)
	if len(pend) != 1 {
		t.Fatalf("esperaba 1 solicitud pendiente, got %d", len(pend))
	}
	if pend[0].Operacion != aprobaciones.OpCrear || pend[0].DatoID != "DATO-1" || pend[0].Solicitante != "integrador-ana" {
		t.Fatalf("solicitud mal formada: %+v", pend[0])
	}
}

// Validación: payload obligatorio (no se crea solicitud si la entrada es inválida).
func TestCrearDato_integrador_validacion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.Set(middleware.ContextAPIRole, middleware.RoleIntegrador)
	c.Set(middleware.ContextAPITenant, "tenant-test-validacion")

	body := `{"datoId":"DATO-2","tipo":"expediente"}` // falta payload
	c.Request, _ = http.NewRequest(http.MethodPost, "/datos", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	CrearDato(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400 por validación, obtuvo %d: %s", w.Code, w.Body.String())
	}
}
