package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"os"
)

// EmitirToken invoca la función 'Mint' en el chaincode de tokens.
func EmitirToken(c *gin.Context) {
	var s models.EmitirToken
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	// 1. Invocar Chaincode para crear el dinero en la cuenta del Banco (Org1)
	chaincode := os.Getenv("TOKEN_CHAINCODE_NAME")
	_, err := fabric.InvokeTransaction(chaincode, "Mint", fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al inicializar fondos (Mint): " + err.Error(),
		})
		return
	}

	// 2. Transferir ese dinero de la cuenta del Banco al Destinatario final
	result, err := fabric.InvokeTransaction(chaincode, "Transfer", s.Destinatario, fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al enviar los fondos al cliente (Transfer): " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    string(result),
		Mensaje: "Tokens emitidos correctamente",
	})
}

// TransferirToken invoca la función 'Transfer' en el chaincode de tokens.
func TransferirToken(c *gin.Context) {
	var s models.TransferirToken
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	// 1. Invocar Chaincode (Transfer)
	chaincode := os.Getenv("TOKEN_CHAINCODE_NAME")
	result, err := fabric.InvokeTransaction(chaincode, "Transfer", s.Destino, fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al transferir tokens: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    string(result),
		Mensaje: "Transferencia realizada con éxito",
	})
}

// ConsultarSaldo obtiene el balance usando 'BalanceOf'.
func ConsultarSaldo(c *gin.Context) {
	clienteId := c.Param("clienteId")
	chaincode := os.Getenv("TOKEN_CHAINCODE_NAME")

	result, err := fabric.EvaluateTransaction(chaincode, "BalanceOf", clienteId)
	if err != nil {
		c.JSON(http.StatusNotFound, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al consultar saldo: " + err.Error(),
		})
		return
	}

	var saldo int64
	json.Unmarshal(result, &saldo)

	c.JSON(http.StatusOK, models.SaldoToken{
		ClienteId:   clienteId,
		CodigoToken: "TOK",
		Saldo:       saldo,
	})
}

// ConsultarHistorial obtiene la lista de operaciones desde el ledger.
func ConsultarHistorial(c *gin.Context) {
	clienteId := c.Param("clienteId")
	chaincode := os.Getenv("TOKEN_CHAINCODE_NAME")

	// 1. Evaluar transacción de historial (Debe existir en el Chaincode)
	result, err := fabric.EvaluateTransaction(chaincode, "GetHistory", clienteId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al consultar historial: " + err.Error(),
		})
		return
	}

	// 2. Parsear el resultado
	var operaciones []models.OperacionHistorial
	if err := json.Unmarshal(result, &operaciones); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar el historial de la Blockchain",
		})
		return
	}

	c.JSON(http.StatusOK, models.HistorialToken{
		ClienteId:   clienteId,
		CodigoToken: "TOK",
		Operaciones: operaciones,
	})
}
