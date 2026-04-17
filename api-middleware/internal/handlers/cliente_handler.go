package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// RegistrarCliente maneja la creación de un nuevo asset de cliente en Fabric.
func RegistrarCliente(c *gin.Context) {
	var n models.Cliente
	if err := c.ShouldBindBodyWith(&n, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	if err := validarRegistroCliente(n); err != nil {
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
	if strings.TrimSpace(chaincode) == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}

	result, err := fabric.InvokeTransactionWithTxID(chaincode, "CreateAsset",
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
		TxId:    result.TxID,
		Mensaje: "Cliente registrado correctamente en la Blockchain",
	})
}

// ConsultarCliente obtiene los datos de un cliente desde el ledger.
func ConsultarCliente(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}

	// 1. Evaluar el Chaincode (Consulta)
	result, err := fabric.EvaluateTransaction(chaincode, "ReadAsset", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok:      false,
				Codigo:  "NO_ENCONTRADO",
				Mensaje: "Cliente no encontrado en la Blockchain",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error interno al consultar cliente en Blockchain",
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

	c.JSON(http.StatusOK, models.RespuestaLectura{
		Ok:      true,
		Codigo:  "CONSULTA_EXITOSA",
		Mensaje: "Cliente consultado correctamente",
		Datos:   cliente,
	})
}

func validarRegistroCliente(cliente models.Cliente) error {
	if strings.TrimSpace(cliente.ClienteId) == "" {
		return fmt.Errorf("clienteId es obligatorio")
	}
	if strings.TrimSpace(cliente.Nombre) == "" {
		return fmt.Errorf("nombre es obligatorio")
	}
	if strings.TrimSpace(cliente.NumeroDocumento) == "" {
		return fmt.Errorf("numeroDocumento es obligatorio")
	}
	if strings.TrimSpace(cliente.FechaAlta) == "" {
		return fmt.Errorf("fechaAlta es obligatoria")
	}
	if _, err := time.Parse("2006-01-02", cliente.FechaAlta); err != nil {
		return fmt.Errorf("fechaAlta debe tener formato YYYY-MM-DD")
	}

	return nil
}

func esErrorNoEncontrado(err error) bool {
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "does not exist") ||
		strings.Contains(m, "not found") ||
		strings.Contains(m, "no existe") ||
		strings.Contains(m, "cannot read world state pair with key")
}
