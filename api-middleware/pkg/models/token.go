package models

// EmitirToken representa la solicitud para emitir valor a un cliente.
// CodigoToken es etiqueta de API; token_erc20 no recibe este campo en Mint/Transfer.
type EmitirToken struct {
	Destinatario string `json:"destinatario" binding:"required"`
	Monto        int64  `json:"monto" binding:"required,gt=0"`
	CodigoToken  string `json:"codigoToken" binding:"required"`
}

// TransferirToken representa la solicitud de transferencia entre clientes.
// Origen es informativo; en ERC-20 el origen del ledger es la identidad que firma la transacción.
type TransferirToken struct {
	Origen      string `json:"origen" binding:"required"`
	Destino     string `json:"destino" binding:"required"`
	Monto       int64  `json:"monto" binding:"required,gt=0"`
	CodigoToken string `json:"codigoToken" binding:"required"`
}

// SaldoToken representa la respuesta de consulta de saldo.
type SaldoToken struct {
	ClienteId   string `json:"clienteId"`
	CodigoToken string `json:"codigoToken"`
	Saldo       int64  `json:"saldo"`
}

// OperacionHistorial representa una entrada en el historial de transacciones.
type OperacionHistorial struct {
	TxId        string `json:"txId"`
	Tipo        string `json:"tipo"`
	Monto       int64  `json:"monto"`
	CodigoToken string `json:"codigoToken"`
}

// HistorialToken representa la lista de operaciones de un cliente.
type HistorialToken struct {
	ClienteId   string               `json:"clienteId"`
	CodigoToken string               `json:"codigoToken"`
	Operaciones []OperacionHistorial `json:"operaciones"`
}
