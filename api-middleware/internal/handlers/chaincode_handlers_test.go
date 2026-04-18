package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"api-middleware/internal/middleware"

	"github.com/gin-gonic/gin"
)

func TestInvocarChaincodeIntegrador_modoInvalido(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"canal":"clientes","contrato":"cliente_cc","funcion":"ReadAsset","parametros":["x"],"modo":"lectura"}`
	c.Request, _ = http.NewRequest(http.MethodPost, "/chaincode/invocar", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	InvocarChaincodeIntegrador(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400, obtuvo %d: %s", w.Code, w.Body.String())
	}
}

func TestInvocarChaincodeIntegrador_politicaNoPermitida(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"canal":"clientes","contrato":"token_erc20","funcion":"Mint","parametros":["1"],"modo":"submit"}`
	c.Request, _ = http.NewRequest(http.MethodPost, "/chaincode/invocar", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	InvocarChaincodeIntegrador(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("esperado 403, obtuvo %d: %s", w.Code, w.Body.String())
	}
}

func TestInvocarChaincodeIntegrador_argsIncorrectos(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"canal":"clientes","contrato":"cliente_cc","funcion":"ReadAsset","parametros":[],"modo":"evaluate"}`
	c.Request, _ = http.NewRequest(http.MethodPost, "/chaincode/invocar", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	InvocarChaincodeIntegrador(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("esperado 403 por política/args, obtuvo %d: %s", w.Code, w.Body.String())
	}
}

func TestInvocarChaincodeIntegrador_gatewayNoDisponible(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"canal":"clientes","contrato":"cliente_cc","funcion":"ReadAsset","parametros":["CLI001"],"modo":"evaluate"}`
	c.Request, _ = http.NewRequest(http.MethodPost, "/chaincode/invocar", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	InvocarChaincodeIntegrador(c)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("esperado 503 sin gateway, obtuvo %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminChaincode_sinApiKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_API_KEY", "clave-secreta-prueba")

	r := gin.New()
	r.Use(middleware.AdminAPIKey())
	r.POST("/admin/chaincode/invocar", InvocarChaincodeAdmin)

	w := httptest.NewRecorder()
	body := `{"canal":"clientes","contrato":"cliente_cc","funcion":"ReadAsset","parametros":["CLI001"],"modo":"evaluate"}`
	req, _ := http.NewRequest(http.MethodPost, "/admin/chaincode/invocar", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("esperado 403 sin cabecera admin, obtuvo %d: %s", w.Code, w.Body.String())
	}
}

func TestAdminChaincode_conApiKey_sinFabric(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_API_KEY", "clave-secreta-prueba-2")

	r := gin.New()
	r.Use(middleware.AdminAPIKey())
	r.POST("/admin/chaincode/invocar", InvocarChaincodeAdmin)

	w := httptest.NewRecorder()
	body := `{"canal":"clientes","contrato":"cliente_cc","funcion":"ReadAsset","parametros":["CLI001"],"modo":"evaluate"}`
	req, _ := http.NewRequest(http.MethodPost, "/admin/chaincode/invocar", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Api-Key", "clave-secreta-prueba-2")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("esperado 503 sin gateway, obtuvo %d: %s", w.Code, w.Body.String())
	}
}
