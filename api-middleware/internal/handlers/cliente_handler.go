package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// RegistrarCliente maneja la creación de un nuevo asset de cliente en Fabric.
func RegistrarCliente(c *gin.Context) {
	var n models.Cliente
	if err := c.ShouldBindJSON(&n); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	// 1. Invocar el Chaincode (Fase 4)
	// Función: CreateAsset(clienteId, nombre, tipoDoc, numeroDoc, fechaAlta, estado, telefono, email, notas)
	chaincode := os.Getenv("CHAINCODE_NAME")
	result, err := fabric.InvokeTransaction(chaincode, "CreateAsset",
		n.ClienteId, n.Nombre, n.TipoDocumento, n.NumeroDocumento,
		n.FechaAlta, n.Estado, n.Telefono, n.Email, n.Notas,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al registrar en Blockchain: " + err.Error(),
		})
		return
	}

	// 2. Responder con el éxito
	c.JSON(http.StatusCreated, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    string(result), // El SDK de Gateway a menudo devuelve el ID de TX o el resultado
		Mensaje: "Cliente registrado correctamente en la Blockchain",
	})
}

// ConsultarCliente obtiene los datos de un cliente desde el ledger.
func ConsultarCliente(c *gin.Context) {
	clienteId := c.Param("clienteId")
	chaincode := os.Getenv("CHAINCODE_NAME")

	// 1. Evaluar el Chaincode (Consulta)
	result, err := fabric.EvaluateTransaction(chaincode, "ReadAsset", clienteId)
	if err != nil {
		c.JSON(http.StatusNotFound, models.RespuestaError{
			Ok:      false,
			Codigo:  "NO_ENCONTRADO",
			Mensaje: "Cliente no encontrado en la Blockchain: " + err.Error(),
		})
		return
	}

	// 2. Parsear el resultado JSON del Chaincode
	var cliente models.Cliente
	if err := json.Unmarshal(result, &cliente); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar los datos de la Blockchain",
		})
		return
	}

	c.JSON(http.StatusOK, cliente)
}
