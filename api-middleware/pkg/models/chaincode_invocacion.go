package models

// SolicitudInvocacionChaincode es el cuerpo JSON único para invocar chaincode vía middleware (lista blanca).
//
// Canal es opcional: si se omite, el middleware usa el canal por defecto del
// tenant resuelto desde la X-API-Key (modelo multi-tenant universal).
type SolicitudInvocacionChaincode struct {
	Canal      string   `json:"canal"`
	Contrato   string   `json:"contrato" binding:"required"`
	Funcion    string   `json:"funcion" binding:"required"`
	Parametros []string `json:"parametros"`
	Modo       string   `json:"modo" binding:"required"`
}
