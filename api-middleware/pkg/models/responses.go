package models

// RespuestaExitoTx representa una respuesta exitosa tras una transacción de escritura.
type RespuestaExitoTx struct {
	Ok       bool   `json:"ok"`
	TxId     string `json:"txId"`
	Mensaje  string `json:"mensaje"`
	TxIdMint string `json:"txIdMint,omitempty"` // solo emisión compuesta Mint+Transfer
}

// RespuestaError representa una respuesta de error estructurada.
type RespuestaError struct {
	Ok      bool   `json:"ok"`
	Codigo  string `json:"codigo"`
	Mensaje string `json:"mensaje"`
}
