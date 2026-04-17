package handlers

import (
	"api-middleware/pkg/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// Tipos de solicitud detectables
const (
	TipoTokenString = "TOKEN"
	TipoAssetString = "ASSET"
	TipoUnknown     = "DESCONOCIDO"
	TipoAmbiguo     = "AMBIGUO"
)

// detectRequestType analiza el cuerpo o los parámetros de consulta para clasificar la solicitud.
// Punto 1 "Premium": Detección por campos, prefijos, soporte GET y jerarquía.
func detectRequestType(body map[string]interface{}, queryParams map[string][]string) (string, string) {
	hasTokenFields := false
	hasAssetFields := false
	idPrefixMatch := false
	matchedKey := ""

	// 1. Revisar campos en el Body (POST)
	tokenKeys := []string{"monto", "codigoToken", "destinatario", "destino", "origen"}
	assetKeys := []string{"tipoDocumento", "numeroDocumento", "nombre", "clienteId"}

	for key, value := range body {
		k := strings.ToLower(key)

		for _, tk := range tokenKeys {
			if strings.ToLower(tk) == k {
				hasTokenFields = true
				matchedKey = key
			}
		}

		for _, ak := range assetKeys {
			if strings.ToLower(ak) == k {
				if k == "tipodocumento" || k == "numerodocumento" {
					hasAssetFields = true
					matchedKey = key
				}
				if strVal, ok := value.(string); ok {
					if strings.HasPrefix(strings.ToUpper(strVal), "CLI-") {
						idPrefixMatch = true
						matchedKey = key + "=" + strVal
					}
				}
			}
		}
	}

	// 2. Revisar parámetros en Query (GET)
	if len(queryParams) > 0 {
		if ids, ok := queryParams["clienteId"]; ok && len(ids) > 0 {
			if strings.HasPrefix(strings.ToUpper(ids[0]), "CLI-") {
				idPrefixMatch = true
				matchedKey = "query:clienteId"
			}
		}
		if _, ok := queryParams["codigoToken"]; ok {
			hasTokenFields = true
			matchedKey = "query:codigoToken"
		}
	}

	// 3. Lógica de Decisión con Jerarquía y Razón
	if hasTokenFields {
		razon := "Campo financiero detectado: " + matchedKey
		if hasAssetFields || idPrefixMatch {
			razon += " (Conflicto detectado, priorizando TOKEN)"
		}
		return TipoTokenString, razon
	}

	if idPrefixMatch {
		return TipoAssetString, "ID con prefijo CLI detectado: " + matchedKey
	}

	if hasAssetFields {
		return TipoAssetString, "Campo de identidad detectado: " + matchedKey
	}

	// Prioridad 3: Ambigüedad si no podemos decidir con las reglas anteriores
	if hasAssetFields && hasTokenFields {
		return TipoAmbiguo, "Conflicto directo de campos Asset/Token"
	}

	return TipoUnknown, "No se encontraron campos clave para clasificar"
}

// AutoRouteOperation es el endpoint unificado que detecta y enruta la operación.
// Punto 2 y 4 del hito 2.4.
func AutoRouteOperation(c *gin.Context) {
	var body map[string]interface{}
	queryParams := c.Request.URL.Query()

	// Intentamos leer el body si existe
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindBodyWith(&body, binding.JSON); err != nil {
			log.Printf("[GATEWAY] Aviso: Body no es JSON válido: %v", err)
		}
	}

	// 1 y 4. Clasificación con Justificación Técnica
	tipo, razon := detectRequestType(body, queryParams)

	// 4. Registro de decisión detallado (Logging para auditoría)
	log.Printf("[GATEWAY] >>> SOLICITUD RECIBIDA: %s %s", c.Request.Method, c.Request.URL.Path)
	log.Printf("[GATEWAY] Clasificacion: %s | Motivacion: %s", tipo, razon)

	// 2. Enrutamiento (Dispatcher)
	switch tipo {
	case TipoTokenString:
		log.Printf("[GATEWAY] Enrutando a módulo de TOKENS")
		// Dependiendo del método o campos, podríamos ser más específicos (Emitir vs Transferir)
		// Por ahora, asumimos que el handler de token sabrá que hacer con el body bindeado
		if _, ok := body["origen"]; ok || c.Request.URL.Path == "/tokens/transferir" {
			TransferirToken(c)
		} else {
			EmitirToken(c)
		}

	case TipoAssetString:
		log.Printf("[GATEWAY] Enrutando a módulo de ASSETS (Clientes)")
		if c.Request.Method == http.MethodPost {
			RegistrarCliente(c)
		} else {
			ConsultarCliente(c)
		}

	case TipoAmbiguo:
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_AMBIGUO",
			Mensaje: "No se puede determinar el tipo de operacion. Se detectaron campos de Token (monto/codigo) y Asset (documento) en la misma peticion. Por favor envíe solo uno de los dos tipos.",
		})

	default:
		// Caso de solicitud incompleta o desconocida
		detalles := "No se pudo identificar el tipo de operacion (Asset o Token)."
		sugerencia := "Asegúrese de enviar al menos 'monto' y 'codigoToken' para transacciones, o 'tipoDocumento' y 'numeroDocumento' para registros de clientes."
		
		if len(body) == 0 && len(queryParams) == 0 {
			detalles = "Peticion vacia."
		}

		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_SOLICITUD_INCOMPLETA",
			Mensaje: detalles + " " + sugerencia,
		})
	}
}
