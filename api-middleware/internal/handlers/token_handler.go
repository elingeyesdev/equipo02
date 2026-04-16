package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// EmitirToken ejecuta Mint (fondos en cuenta del minter/gateway) y Transfer al destinatario.
// El contrato token_erc20 (sample) no usa codigoToken: hay un único activo; el campo se mantiene por contrato de API.
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

	if err := validarEmitirToken(s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	chaincode, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}

	// 1) Mint al minter (identidad Admin del gateway en .env)
	mintRes, err := fabric.InvokeTransactionWithTxID(chaincode, "Mint", fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al acuñar fondos (Mint): " + err.Error(),
		})
		return
	}

	// 2) Transfer del minter al destinatario (recipient debe ser ClientAccountID / cuenta válida en el contrato)
	transRes, err := fabric.InvokeTransactionWithTxID(chaincode, "Transfer", strings.TrimSpace(s.Destinatario), fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: fmt.Sprintf("Mint confirmado (txId %s) pero falló Transfer al destinatario: %s", mintRes.TxID, err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:       true,
		TxId:     transRes.TxID,
		TxIdMint: mintRes.TxID,
		Mensaje:  "Tokens emitidos: Mint y Transfer confirmados en la red",
	})
}

// TransferirToken ejecuta Transfer: el origen en ledger es la identidad que firma (gateway), no el campo JSON `origen`.
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

	if err := validarTransferirToken(s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	chaincode, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}

	transRes, err := fabric.InvokeTransactionWithTxID(
		chaincode,
		"Transfer",
		strings.TrimSpace(s.Destino),
		fmt.Sprintf("%d", s.Monto),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al transferir tokens: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:   true,
		TxId: transRes.TxID,
		Mensaje: "Transferencia realizada con éxito desde la identidad del gateway. " +
			"El contrato ERC-20 no usa el campo origen del JSON; el cargo es a la cuenta del firmante.",
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

func tokenChaincodeNombre() (string, *models.RespuestaError) {
	n := strings.TrimSpace(os.Getenv("TOKEN_CHAINCODE_NAME"))
	if n == "" {
		return "", &models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró TOKEN_CHAINCODE_NAME en variables de entorno",
		}
	}
	return n, nil
}

func validarEmitirToken(s models.EmitirToken) error {
	if strings.TrimSpace(s.Destinatario) == "" {
		return fmt.Errorf("destinatario es obligatorio")
	}
	if s.Monto <= 0 {
		return fmt.Errorf("monto debe ser mayor que cero")
	}
	if strings.TrimSpace(s.CodigoToken) == "" {
		return fmt.Errorf("codigoToken es obligatorio")
	}
	return nil
}

func validarTransferirToken(s models.TransferirToken) error {
	if strings.TrimSpace(s.Destino) == "" {
		return fmt.Errorf("destino es obligatorio")
	}
	if s.Monto <= 0 {
		return fmt.Errorf("monto debe ser mayor que cero")
	}
	if strings.TrimSpace(s.CodigoToken) == "" {
		return fmt.Errorf("codigoToken es obligatorio")
	}
	// origen es obligatorio en el JSON por compatibilidad de API; el contrato no lo usa (origen = identidad del gateway).
	if strings.TrimSpace(s.Origen) == "" {
		return fmt.Errorf("origen es obligatorio en la solicitud (informativo; el ledger usa la identidad del gateway)")
	}
	return nil
}
