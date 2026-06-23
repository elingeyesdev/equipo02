package platform

import "time"

const (
	StatusDraft         = "draft"
	StatusPending       = "pending"
	StatusProvisioning  = "provisioning"
	StatusActive        = "active"
	StatusRejected      = "rejected"
)

type IntegrationConfig struct {
	EntityName      string            `json:"entityName"`
	BusinessIdField string            `json:"businessIdField"`
	EntityType      string            `json:"entityType"`
	SchemaVersion   string            `json:"schemaVersion"`
	Attributes      []AttributeDraft  `json:"attributes"`
	PayloadExample  string            `json:"payloadExample"`
	Stack           string            `json:"stack"`
}

type AttributeDraft struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

type RequestUser struct {
	ID                string `json:"id"`
	Username          string `json:"username"`
	NombreCompleto    string `json:"nombreCompleto"`
	Rol               string `json:"rol"`
	PasswordPlainTemp string `json:"passwordPlainTemp,omitempty"`
}

type TenantRequest struct {
	ID              string             `json:"id"`
	Status          string             `json:"status"`
	TenantID        string             `json:"tenantId"`
	OrgName         string             `json:"orgName"`
	Domain          string             `json:"domain"`
	ContactEmail    string             `json:"contactEmail"`
	DevUserID       string             `json:"devUserId,omitempty"`
	Integration     IntegrationConfig  `json:"integration"`
	RejectReason    string             `json:"rejectReason,omitempty"`
	Users           []RequestUser      `json:"users"`
	CreatedAt       time.Time          `json:"createdAt"`
	UpdatedAt       time.Time          `json:"updatedAt"`
}

type TenantRecord struct {
	ID          string    `json:"id"`
	OrgName     string    `json:"orgName"`
	Domain      string    `json:"domain"`
	Canal       string    `json:"canal"`
	Chaincode   string    `json:"chaincode"`
	Status      string    `json:"status"`
	RequestID   string    `json:"requestId,omitempty"`
	ActivatedAt time.Time `json:"activatedAt,omitempty"`
}

type APIKeyRecord struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Rol      string `json:"rol"`
	KeyValue string `json:"keyValue"`
	Activo   bool   `json:"activo"`
}

type CredentialsResponse struct {
	MiddlewareURL string            `json:"middlewareUrl"`
	TenantID      string            `json:"tenantId"`
	Keys          map[string]string `json:"keys"`
	UserPasswords map[string]string `json:"userPasswords,omitempty"`
}

type ActivateResult struct {
	TenantID      string            `json:"tenantId"`
	MiddlewareURL string            `json:"middlewareUrl"`
	APIKeys       map[string]string `json:"apiKeys"`
	UserPasswords map[string]string `json:"userPasswords"`
}
