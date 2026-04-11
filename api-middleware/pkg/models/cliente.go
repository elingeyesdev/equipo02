package models

// Cliente representa el esquema del activo de cliente en el sistema.
type Cliente struct {
	ClienteId       string `json:"clienteId" binding:"required"`
	Nombre          string `json:"nombre" binding:"required"`
	TipoDocumento   string `json:"tipoDocumento" binding:"required,oneof=CI NIT PASAPORTE"`
	NumeroDocumento string `json:"numeroDocumento" binding:"required"`
	FechaAlta       string `json:"fechaAlta" binding:"required"`
	Estado          string `json:"estado" binding:"required,oneof=ACTIVO INACTIVO"`
	Telefono        string `json:"telefono,omitempty"`
	Email           string `json:"email,omitempty" binding:"omitempty,email"`
	Notas           string `json:"notas,omitempty"`
}
