package fabric

import (
	"encoding/json"
	"fmt"
	"os"
)

// InvokeTransaction envía una transacción de escritura al ledger.
func InvokeTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	if GlobalGateway == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}

	networkName := os.Getenv("CHANNEL_NAME")
	network := GlobalGateway.GetNetwork(networkName)
	contract := network.GetContract(chaincodeName)

	result, err := contract.SubmitTransaction(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("error al enviar transacción: %w", err)
	}

	return result, nil
}

// EvaluateTransaction realiza una consulta de solo lectura al ledger.
func EvaluateTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	if GlobalGateway == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}

	networkName := os.Getenv("CHANNEL_NAME")
	network := GlobalGateway.GetNetwork(networkName)
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
