package devportal

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailExists    = errors.New("email ya registrado")
	ErrUserNotFound   = errors.New("usuario no encontrado")
	ErrInvalidCreds   = errors.New("credenciales inválidas")
	ErrUserInactive   = errors.New("usuario inactivo")
	ErrAccessDenied   = errors.New("acceso denegado")
)

type User struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Nombre string `json:"nombre"`
}

type Store struct {
	DB *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

func (s *Store) Register(email, password, nombre string) (*User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	nombre = strings.TrimSpace(nombre)
	if email == "" || password == "" || nombre == "" {
		return nil, errors.New("email, contraseña y nombre son obligatorios")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	_, err = s.DB.Exec(
		`INSERT INTO dev_users (id, email, password_hash, nombre) VALUES (?, ?, ?, ?)`,
		id, email, string(hash), nombre,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, ErrEmailExists
		}
		return nil, err
	}
	return &User{ID: id, Email: email, Nombre: nombre}, nil
}

func (s *Store) Authenticate(email, password string) (*User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var u User
	var hash string
	var activo int
	err := s.DB.QueryRow(
		`SELECT id, email, nombre, password_hash, activo FROM dev_users WHERE email = ?`,
		email,
	).Scan(&u.ID, &u.Email, &u.Nombre, &hash, &activo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidCreds
		}
		return nil, err
	}
	if activo != 1 {
		return nil, ErrUserInactive
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}
	return &u, nil
}

func (s *Store) GetByID(id string) (*User, error) {
	var u User
	var activo int
	err := s.DB.QueryRow(`SELECT id, email, nombre, activo FROM dev_users WHERE id = ?`, id).
		Scan(&u.ID, &u.Email, &u.Nombre, &activo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	if activo != 1 {
		return nil, ErrUserInactive
	}
	return &u, nil
}

type DevRevocador struct {
	DB *sql.DB
}

func NewDevRevocador(db *sql.DB) *DevRevocador {
	return &DevRevocador{DB: db}
}

func (r *DevRevocador) RegistrarSesion(userID, jti string, exp time.Time) error {
	_, err := r.DB.Exec(
		`INSERT INTO dev_sessions (id, dev_user_id, jti, expires_at) VALUES (?, ?, ?, ?)`,
		uuid.NewString(), userID, jti, exp.UTC().Format(time.RFC3339),
	)
	return err
}

func (r *DevRevocador) Revocar(jti string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := r.DB.Exec(`UPDATE dev_sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL`, now, jti)
	return err
}

func (r *DevRevocador) Revocado(jti string) bool {
	var revoked sql.NullString
	var expires string
	err := r.DB.QueryRow(`SELECT revoked_at, expires_at FROM dev_sessions WHERE jti = ?`, jti).Scan(&revoked, &expires)
	if err != nil {
		return true
	}
	if revoked.Valid && strings.TrimSpace(revoked.String) != "" {
		return true
	}
	exp, err := time.Parse(time.RFC3339, expires)
	if err != nil {
		return true
	}
	return !time.Now().UTC().Before(exp)
}
