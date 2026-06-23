package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"api-middleware/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Un integrador escribe directo en la cadena al crear (POST /datos).
// Sin gateway Fabric en tests, la operación falla con 503.
func TestCrearDato_integrador_intentaEscrituraDirecta(t *testing.T) {
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

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("esperado 503 sin ledger, obtuvo %d: %s", w.Code, w.Body.String())
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
