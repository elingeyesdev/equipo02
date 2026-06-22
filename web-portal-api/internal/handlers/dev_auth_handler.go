package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/devportal"
	"web-portal-api/internal/middleware"
	"web-portal-api/internal/models"
	"web-portal-api/internal/platform"
)

const ScopeDevPortal = "dev-portal"

type DevAuthHandler struct {
	Cfg       config.Config
	DevStore  *devportal.Store
	Platform  *platform.Store
	Revocador *devportal.DevRevocador
}

type devRegisterBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nombre   string `json:"nombre"`
}

type DevUserPublic struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Nombre string `json:"nombre"`
}

type DevAuthResponse struct {
	Ok      bool          `json:"ok"`
	Token   string        `json:"token"`
	Usuario DevUserPublic `json:"usuario"`
}

func (h *DevAuthHandler) issueToken(u *devportal.User) (string, time.Time, error) {
	jti := uuid.NewString()
	exp := h.Cfg.JWTExpiry
	if exp == 0 {
		exp = 8 * time.Hour
	}
	expiresAt := time.Now().Add(exp)
	token, err := auth.IssueTokenExt(
		h.Cfg.JWTSecret,
		u.ID, u.Email, u.Nombre, "dev-user",
		"", ScopeDevPortal, jti, exp,
	)
	if err != nil {
		return "", time.Time{}, err
	}
	if h.Revocador != nil {
		if err := h.Revocador.RegistrarSesion(u.ID, jti, expiresAt); err != nil {
			return "", time.Time{}, err
		}
	}
	return token, expiresAt, nil
}

func (h *DevAuthHandler) Register(c *gin.Context) {
	var body devRegisterBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Cuerpo inválido",
		})
		return
	}
	u, err := h.DevStore.Register(body.Email, body.Password, body.Nombre)
	if err != nil {
		if errors.Is(err, devportal.ErrEmailExists) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Ok: false, Codigo: "EMAIL_EXISTE", Mensaje: "Ese email ya está registrado",
			})
			return
		}
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: err.Error(),
		})
		return
	}
	token, _, err := h.issueToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo emitir el token",
		})
		return
	}
	c.JSON(http.StatusCreated, DevAuthResponse{
		Ok: true, Token: token,
		Usuario: DevUserPublic{ID: u.ID, Email: u.Email, Nombre: u.Nombre},
	})
}

func (h *DevAuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Email y contraseña son obligatorios",
		})
		return
	}
	u, err := h.DevStore.Authenticate(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "CREDENCIALES_INVALIDAS", Mensaje: "Email o contraseña incorrectos",
		})
		return
	}
	token, _, err := h.issueToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo emitir el token",
		})
		return
	}
	c.JSON(http.StatusOK, DevAuthResponse{
		Ok: true, Token: token,
		Usuario: DevUserPublic{ID: u.ID, Email: u.Email, Nombre: u.Nombre},
	})
}

func (h *DevAuthHandler) Me(c *gin.Context) {
	cl, ok := middleware.DevClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Sesión no válida",
		})
		return
	}
	u, err := h.DevStore.GetByID(cl.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Usuario no encontrado",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"usuario": DevUserPublic{ID: u.ID, Email: u.Email, Nombre: u.Nombre},
	})
}

func (h *DevAuthHandler) Logout(c *gin.Context) {
	cl, ok := middleware.DevClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}
	if h.Revocador != nil && cl.ID != "" {
		_ = h.Revocador.Revocar(cl.ID)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
}

func (h *DevAuthHandler) MisSolicitudes(c *gin.Context) {
	cl, ok := middleware.DevClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Inicia sesión",
		})
		return
	}
	list, err := h.Platform.ListRequestsByDevUser(cl.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitudes": list})
}
