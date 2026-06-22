package platform

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotFound       = errors.New("solicitud no encontrada")
	ErrTenantExists   = errors.New("tenant_id ya registrado")
	ErrInvalidStatus  = errors.New("estado no permite la operación")
	ErrEmailMismatch  = errors.New("email no coincide con la solicitud")
	ErrAccessDenied   = errors.New("acceso denegado")
)

type Store struct {
	DB *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

func (s *Store) EnsurePlatformOperator(username, password, nombre string) error {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return nil
	}
	var n int
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM platform_operators`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.DB.Exec(
		`INSERT INTO platform_operators (id, username, password_hash, nombre_completo) VALUES (?, ?, ?, ?)`,
		uuid.NewString(), username, string(hash), nombre,
	)
	return err
}

func (s *Store) AuthenticateOperator(username, password string) (string, string, error) {
	var id, hash, nombre string
	var activo int
	err := s.DB.QueryRow(
		`SELECT id, password_hash, nombre_completo, activo FROM platform_operators WHERE username = ? COLLATE NOCASE`,
		strings.TrimSpace(username),
	).Scan(&id, &hash, &nombre, &activo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", errors.New("credenciales inválidas")
		}
		return "", "", err
	}
	if activo != 1 {
		return "", "", errors.New("operador inactivo")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return "", "", errors.New("credenciales inválidas")
	}
	return id, nombre, nil
}

type UpsertRequestInput struct {
	ID           string
	TenantID     string
	OrgName      string
	Domain       string
	ContactEmail string
	DevUserID    string
	Integration  IntegrationConfig
	Users        []RequestUser
	Submit       bool
}

func (s *Store) UpsertRequest(in UpsertRequestInput) (*TenantRequest, error) {
	tenantID := strings.TrimSpace(strings.ToLower(in.TenantID))
	if tenantID == "" {
		return nil, errors.New("tenant_id requerido")
	}
	status := StatusDraft
	if in.Submit {
		status = StatusPending
	}
	now := time.Now().UTC().Format(time.RFC3339)
	integrationJSON, _ := json.Marshal(in.Integration)

	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	reqID := strings.TrimSpace(in.ID)
	if reqID == "" {
		reqID = uuid.NewString()
	}

	var curStatus string
	err = s.DB.QueryRow(`SELECT status FROM tenant_requests WHERE id = ?`, reqID).Scan(&curStatus)
	if errors.Is(err, sql.ErrNoRows) {
		_, err = tx.Exec(`
			INSERT INTO tenant_requests (id, status, tenant_id, org_name, domain, contact_email, integration_json, dev_user_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, reqID, status, tenantID, in.OrgName, in.Domain, in.ContactEmail, string(integrationJSON), nullIfEmpty(in.DevUserID), now, now)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				return nil, ErrTenantExists
			}
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		if curStatus == StatusActive || curStatus == StatusRejected {
			return nil, ErrInvalidStatus
		}
		newStatus := curStatus
		if in.Submit && (curStatus == StatusDraft || curStatus == StatusPending) {
			newStatus = StatusPending
		}
		_, err = tx.Exec(`
			UPDATE tenant_requests SET tenant_id=?, org_name=?, domain=?, contact_email=?, integration_json=?, status=?, dev_user_id=COALESCE(?, dev_user_id), updated_at=?
			WHERE id=?
		`, tenantID, in.OrgName, in.Domain, in.ContactEmail, string(integrationJSON), newStatus, nullIfEmpty(in.DevUserID), now, reqID)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				return nil, ErrTenantExists
			}
			return nil, err
		}
	}

	if len(in.Users) > 0 {
		_, _ = tx.Exec(`DELETE FROM tenant_request_users WHERE request_id = ?`, reqID)
		for _, u := range in.Users {
			uid := u.ID
			if uid == "" {
				uid = uuid.NewString()
			}
			_, err = tx.Exec(`
				INSERT INTO tenant_request_users (id, request_id, username, nombre_completo, rol, password_plain_temp)
				VALUES (?, ?, ?, ?, ?, ?)
			`, uid, reqID, u.Username, u.NombreCompleto, u.Rol, nullIfEmpty(u.PasswordPlainTemp))
			if err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.GetRequestByID(reqID)
}

func nullIfEmpty(s string) interface{} {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (s *Store) ListRequests(statusFilter string) ([]TenantRequest, error) {
	return s.listRequestsWhere(`1=1`, statusFilter, nil)
}

func (s *Store) ListRequestsByDevUser(devUserID string) ([]TenantRequest, error) {
	return s.listRequestsWhere(`dev_user_id = ?`, "", []interface{}{devUserID})
}

func (s *Store) listRequestsWhere(baseWhere, statusFilter string, extraArgs []interface{}) ([]TenantRequest, error) {
	q := `SELECT id, status, tenant_id, org_name, domain, contact_email, integration_json,
		COALESCE(reject_reason,''), COALESCE(dev_user_id,''), created_at, updated_at FROM tenant_requests WHERE ` + baseWhere
	args := append([]interface{}{}, extraArgs...)
	if statusFilter != "" {
		q += ` AND status = ?`
		args = append(args, statusFilter)
	}
	q += ` ORDER BY created_at DESC`
	rows, err := s.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TenantRequest
	for rows.Next() {
		tr, err := scanRequestRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *tr)
	}
	for i := range out {
		users, err := s.listUsers(out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Users = users
	}
	return out, nil
}

func (s *Store) GetRequestByID(id string) (*TenantRequest, error) {
	row := s.DB.QueryRow(`SELECT id, status, tenant_id, org_name, domain, contact_email, integration_json,
		COALESCE(reject_reason,''), COALESCE(dev_user_id,''), created_at, updated_at FROM tenant_requests WHERE id = ?`, id)
	tr, err := scanRequestRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	users, err := s.listUsers(tr.ID)
	if err != nil {
		return nil, err
	}
	tr.Users = users
	return tr, nil
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanRequestRow(row rowScanner) (*TenantRequest, error) {
	var tr TenantRequest
	var integrationJSON, createdAt, updatedAt string
	if err := row.Scan(&tr.ID, &tr.Status, &tr.TenantID, &tr.OrgName, &tr.Domain, &tr.ContactEmail,
		&integrationJSON, &tr.RejectReason, &tr.DevUserID, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(integrationJSON), &tr.Integration)
	tr.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	tr.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &tr, nil
}

func (s *Store) listUsers(requestID string) ([]RequestUser, error) {
	rows, err := s.DB.Query(`
		SELECT id, username, nombre_completo, rol, COALESCE(password_plain_temp,'')
		FROM tenant_request_users WHERE request_id = ? ORDER BY username
	`, requestID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []RequestUser
	for rows.Next() {
		var u RequestUser
		if err := rows.Scan(&u.ID, &u.Username, &u.NombreCompleto, &u.Rol, &u.PasswordPlainTemp); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// CanAccessRequest permite acceso público a solicitudes anónimas legacy; las vinculadas exigen dueño.
func CanAccessRequest(req *TenantRequest, devUserID string) bool {
	if req == nil {
		return false
	}
	if strings.TrimSpace(req.DevUserID) == "" {
		return true
	}
	return strings.TrimSpace(devUserID) != "" && req.DevUserID == devUserID
}

func (s *Store) MarkProvisioning(id string) error {
	res, err := s.DB.Exec(`UPDATE tenant_requests SET status=?, updated_at=? WHERE id=? AND status=?`,
		StatusProvisioning, time.Now().UTC().Format(time.RFC3339), id, StatusPending)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrInvalidStatus
	}
	return nil
}

func (s *Store) Reject(id, reason string) error {
	res, err := s.DB.Exec(`UPDATE tenant_requests SET status=?, reject_reason=?, updated_at=? WHERE id=? AND status IN (?,?)`,
		StatusRejected, reason, time.Now().UTC().Format(time.RFC3339), id, StatusPending, StatusProvisioning)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrInvalidStatus
	}
	return nil
}

func (s *Store) GetAPIKeysForTenant(tenantID string) (map[string]string, error) {
	rows, err := s.DB.Query(`SELECT rol, key_value FROM tenant_api_keys WHERE tenant_id=? AND activo=1`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make(map[string]string)
	for rows.Next() {
		var rol, key string
		if err := rows.Scan(&rol, &key); err != nil {
			return nil, err
		}
		keys[rol] = key
	}
	return keys, nil
}

func (s *Store) Activate(id string, activateFn func(*TenantRequest) (*ActivateResult, error)) (*ActivateResult, error) {
	req, err := s.GetRequestByID(id)
	if err != nil {
		return nil, err
	}
	if req.Status != StatusPending && req.Status != StatusProvisioning {
		return nil, ErrInvalidStatus
	}
	return activateFn(req)
}

func (s *Store) CompleteActivation(req *TenantRequest, keys map[string]string, userPasswords map[string]string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	_, err = tx.Exec(`
		INSERT INTO tenants (id, org_name, domain, canal, chaincode, status, request_id, activated_at)
		VALUES (?, ?, ?, ?, 'dato_cc', 'active', ?, ?)
	`, req.TenantID, req.OrgName, req.Domain, req.TenantID, req.ID, now)
	if err != nil {
		return err
	}

	for rol, key := range keys {
		_, err = tx.Exec(`INSERT INTO tenant_api_keys (id, tenant_id, rol, key_value, activo) VALUES (?, ?, ?, ?, 1)`,
			uuid.NewString(), req.TenantID, rol, key)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(`UPDATE tenant_requests SET status=?, updated_at=? WHERE id=?`, StatusActive, now, req.ID)
	if err != nil {
		return err
	}

	for username, pwd := range userPasswords {
		_, _ = tx.Exec(`UPDATE tenant_request_users SET password_plain_temp=? WHERE request_id=? AND username=?`,
			pwd, req.ID, username)
	}

	return tx.Commit()
}
