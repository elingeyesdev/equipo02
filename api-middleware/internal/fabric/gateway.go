package fabric

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/hyperledger/fabric-gateway/pkg/client"
)

// SubmitResult contiene la información relevante de una escritura en Fabric.
type SubmitResult struct {
	Payload []byte
	TxID    string
}

func canalEfectivo(nombreCanal string) string {
	c := strings.TrimSpace(nombreCanal)
	if c != "" {
		return c
	}
	return strings.TrimSpace(os.Getenv("CHANNEL_NAME"))
}

// InvokeTransaction envía una transacción de escritura al ledger (canal desde CHANNEL_NAME).
func InvokeTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	return InvokeTransactionEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// InvokeTransactionEnCanal envía una transacción de escritura al canal indicado.
func InvokeTransactionEnCanal(channelName string, chaincodeName string, functionName string, args ...string) ([]byte, error) {
	if GlobalGateway == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}

	network := GlobalGateway.GetNetwork(canalEfectivo(channelName))
	contract := network.GetContract(chaincodeName)

	result, err := contract.SubmitTransaction(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("error al enviar transacción: %w", err)
	}

	return result, nil
}

// InvokeTransactionWithTxID envía una transacción de escritura y devuelve el txID real confirmado (canal CHANNEL_NAME).
func InvokeTransactionWithTxID(chaincodeName string, functionName string, args ...string) (*SubmitResult, error) {
	return InvokeTransactionWithTxIDEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// InvokeTransactionWithTxIDEnCanal igual que InvokeTransactionWithTxID pero sobre el canal dado.
func InvokeTransactionWithTxIDEnCanal(channelName string, chaincodeName string, functionName string, args ...string) (*SubmitResult, error) {
	if GlobalGateway == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}

	network := GlobalGateway.GetNetwork(canalEfectivo(channelName))
	contract := network.GetContract(chaincodeName)

	result, commit, err := contract.SubmitAsync(functionName, client.WithArguments(args...))
	if err != nil {
		return nil, fmt.Errorf("error al enviar transacción: %w", err)
	}

	status, err := commit.Status()
	if err != nil {
		return nil, fmt.Errorf("error al confirmar transacción: %w", err)
	}
	if !status.Successful {
		return nil, fmt.Errorf("la transacción %s fue rechazada con código de estado %d", commit.TransactionID(), int32(status.Code))
	}

	return &SubmitResult{
		Payload: result,
		TxID:    commit.TransactionID(),
	}, nil
}

// EvaluateTransaction realiza una consulta de solo lectura al ledger (canal CHANNEL_NAME).
func EvaluateTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	return EvaluateTransactionEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// EvaluateTransactionEnCanal realiza evaluate sobre el canal indicado.
func EvaluateTransactionEnCanal(channelName string, chaincodeName string, functionName string, args ...string) ([]byte, error) {
	if GlobalGateway == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}

	network := GlobalGateway.GetNetwork(canalEfectivo(channelName))
	contract := network.GetContract(chaincodeName)

	result, err := contract.EvaluateTransaction(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("error al evaluar transacción: %w", err)
	}

	return result, nil
}

// ToJSON helper para convertir resultados a estructuras.
func ToJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
