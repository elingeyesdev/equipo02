package models

// SolicitudInvocacionChaincode es el cuerpo JSON único para invocar chaincode vía middleware (lista blanca).
type SolicitudInvocacionChaincode struct {
	Canal      string   `json:"canal" binding:"required"`
	Contrato   string   `json:"contrato" binding:"required"`
	Funcion    string   `json:"funcion" binding:"required"`
	Parametros []string `json:"parametros"`
	Modo       string   `json:"modo" binding:"required"`
}
