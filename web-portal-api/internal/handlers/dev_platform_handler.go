package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/deepseek"
	"web-portal-api/internal/middleware"
	"web-portal-api/internal/models"
	"web-portal-api/internal/platform"
)

const ScopePlatformAdmin = "platform-admin"

type PlatformAuthHandler struct {
	Cfg      config.Config
	Store    *platform.Store
	Revocador AdminRevocador
}

type PlatformLoginResponse struct {
	Ok    bool   `json:"ok"`
	Token string `json:"token"`
	User  struct {
		Username       string `json:"username"`
		NombreCompleto string `json:"nombreCompleto"`
	} `json:"usuario"`
}

func (h *PlatformAuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Usuario y contraseña son obligatorios",
		})
		return
	}
	_, nombre, err := h.Store.AuthenticateOperator(req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "CREDENCIALES_INVALIDAS", Mensaje: "Usuario o contraseña incorrectos",
		})
		return
	}
	jti := uuid.NewString()
	exp := h.Cfg.JWTExpiry
	if exp == 0 {
		exp = 8 * time.Hour
	}
	expiresAt := time.Now().Add(exp)
	token, err := auth.IssueTokenExt(
		h.Cfg.JWTSecret,
		req.Username, req.Username, nombre, "platform-admin",
		"", ScopePlatformAdmin, jti, exp,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo emitir el token",
		})
		return
	}
	if h.Revocador != nil {
		_ = h.Revocador.RegistrarSesion(req.Username, jti, expiresAt)
	}
	c.JSON(http.StatusOK, PlatformLoginResponse{
		Ok:    true,
		Token: token,
		User: struct {
			Username       string `json:"username"`
			NombreCompleto string `json:"nombreCompleto"`
		}{Username: req.Username, NombreCompleto: nombre},
	})
}

type DevHandler struct {
	Cfg      config.Config
	Store    *platform.Store
	Exporter *platform.Exporter
	DeepSeek *deepseek.Client
}

type devUpsertBody struct {
	ID           string                    `json:"id"`
	TenantID     string                    `json:"tenantId"`
	OrgName      string                    `json:"orgName"`
	Domain       string                    `json:"domain"`
	ContactEmail string                    `json:"contactEmail"`
	Integration  platform.IntegrationConfig `json:"integration"`
	Users        []platform.RequestUser    `json:"users"`
	Submit       bool                      `json:"submit"`
}

func (h *DevHandler) UpsertSolicitud(c *gin.Context) {
	var body devUpsertBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Cuerpo inválido",
		})
		return
	}
	if !platform.SlugValid(body.TenantID) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "TENANT_ID_INVALIDO",
			Mensaje: "tenant_id debe ser slug minúsculas (2-40 chars, a-z0-9-)",
		})
		return
	}
	if body.Submit {
		cl, authed := middleware.DevClaimsFromContext(c)
		if !authed {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO",
				Mensaje: "Debes iniciar sesión en el dev portal para enviar la solicitud",
			})
			return
		}
		if strings.TrimSpace(body.OrgName) == "" {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Ok: false, Codigo: "VALIDACION", Mensaje: "orgName es obligatorio al enviar",
			})
			return
		}
		if len(body.Users) == 0 {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Ok: false, Codigo: "VALIDACION", Mensaje: "Debe indicar al menos un usuario consola",
			})
			return
		}
		// Email de la cuenta dev como contacto canónico
		body.ContactEmail = cl.Username
	}
	devUserID := ""
	if cl, ok := middleware.DevClaimsFromContext(c); ok {
		devUserID = cl.UserID
		if body.Submit {
			body.ContactEmail = cl.Username
		}
	}
	if body.Submit && strings.TrimSpace(body.ContactEmail) == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "contactEmail es obligatorio al enviar",
		})
		return
	}
	req, err := h.Store.UpsertRequest(platform.UpsertRequestInput{
		ID: body.ID, TenantID: body.TenantID, OrgName: body.OrgName,
		Domain: body.Domain, ContactEmail: body.ContactEmail, DevUserID: devUserID,
		Integration: body.Integration, Users: body.Users, Submit: body.Submit,
	})
	if err != nil {
		if errors.Is(err, platform.ErrTenantExists) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Ok: false, Codigo: "TENANT_EXISTE", Mensaje: "Ese tenant_id ya está registrado",
			})
			return
		}
		if errors.Is(err, platform.ErrInvalidStatus) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Ok: false, Codigo: "ESTADO_INVALIDO", Mensaje: "La solicitud ya no admite cambios",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	if body.Submit {
		log.Printf("[dev-portal] Nueva solicitud pending: %s (%s) — %s", req.ID, req.TenantID, req.ContactEmail)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": req})
}

func (h *DevHandler) GetSolicitud(c *gin.Context) {
	id := c.Param("id")
	req, err := h.Store.GetRequestByID(id)
	if err != nil {
		if errors.Is(err, platform.ErrNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	devUserID := ""
	if cl, ok := middleware.DevClaimsFromContext(c); ok {
		devUserID = cl.UserID
	}
	if !platform.CanAccessRequest(req, devUserID) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Ok: false, Codigo: "ACCESO_DENEGADO", Mensaje: "No tienes acceso a esta solicitud",
		})
		return
	}
	// No exponer contraseñas temporales al cliente
	safe := *req
	for i := range safe.Users {
		safe.Users[i].PasswordPlainTemp = ""
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": safe})
}

func (h *DevHandler) GetCredenciales(c *gin.Context) {
	id := c.Param("id")
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	req, err := h.Store.GetRequestByID(id)
	if err != nil {
		if errors.Is(err, platform.ErrNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	if req.Status != platform.StatusActive {
		c.JSON(http.StatusConflict, models.ErrorResponse{
			Ok: false, Codigo: "NO_ACTIVO", Mensaje: "Las credenciales estarán disponibles cuando el tenant esté activo",
		})
		return
	}

	authorized := false
	if cl, ok := middleware.DevClaimsFromContext(c); ok && req.DevUserID != "" && req.DevUserID == cl.UserID {
		authorized = true
	}
	if !authorized && req.DevUserID == "" && email != "" && strings.EqualFold(email, req.ContactEmail) {
		authorized = true
	}
	if !authorized {
		if req.DevUserID != "" {
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "ACCESO_DENEGADO", Mensaje: "Inicia sesión con la cuenta que creó esta solicitud",
			})
			return
		}
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Ok: false, Codigo: "EMAIL_NO_COINCIDE", Mensaje: "Indique el email de contacto correcto (?email=)",
		})
		return
	}
	keys, err := h.Store.GetAPIKeysForTenant(req.TenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	users, err := h.Store.GetRequestUsers(req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	userPasswords := map[string]string{}
	for _, u := range users {
		if u.PasswordPlainTemp != "" {
			userPasswords[u.Username] = u.PasswordPlainTemp
		}
	}
	// Cliente ve integrador y lectura; admin solo en panel operador
	clientKeys := map[string]string{}
	if k, ok := keys["integrador"]; ok {
		clientKeys["integrador"] = k
	}
	if k, ok := keys["lectura"]; ok {
		clientKeys["lectura"] = k
	}
	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"credenciales": platform.CredentialsResponse{
			MiddlewareURL: h.Cfg.MiddlewareURL,
			TenantID:      req.TenantID,
			Keys:          clientKeys,
			UserPasswords: userPasswords,
		},
	})
}

type devChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type devChatBody struct {
	Messages []devChatMessage `json:"messages"`
	Draft    *deepseek.Draft  `json:"draft"`
}

func (h *DevHandler) Chat(c *gin.Context) {
	if h.DeepSeek == nil || !h.DeepSeek.Configured() {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Ok: false, Codigo: "CHAT_NO_CONFIGURADO",
			Mensaje: "Configure DEEPSEEK_API_KEY en el BFF y reinicie web-portal-api",
		})
		return
	}
	var body devChatBody
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Messages) == 0 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Se requiere al menos un mensaje",
		})
		return
	}

	msgs := []deepseek.Message{{Role: "system", Content: deepseek.SystemPrompt()}}
	if body.Draft != nil {
		draftJSON, _ := json.Marshal(body.Draft)
		msgs = append(msgs, deepseek.Message{
			Role:    "system",
			Content: "Borrador actual del formulario (JSON): " + string(draftJSON),
		})
	}
	for _, m := range body.Messages {
		role := strings.TrimSpace(m.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		msgs = append(msgs, deepseek.Message{Role: role, Content: content})
	}

	raw, err := h.DeepSeek.Complete(c.Request.Context(), msgs)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			c.JSON(http.StatusGatewayTimeout, models.ErrorResponse{
				Ok: false, Codigo: "CHAT_TIMEOUT", Mensaje: "DeepSeek tardó demasiado",
			})
			return
		}
		log.Printf("[dev-chat] deepseek error: %v", err)
		c.JSON(http.StatusBadGateway, models.ErrorResponse{
			Ok: false, Codigo: "CHAT_ERROR", Mensaje: err.Error(),
		})
		return
	}

	visible, parsed := deepseek.SplitReply(raw)
	merged := deepseek.MergeDraft(body.Draft, parsed)

	lastUser := ""
	for i := len(body.Messages) - 1; i >= 0; i-- {
		if strings.EqualFold(body.Messages[i].Role, "user") {
			lastUser = body.Messages[i].Content
			break
		}
	}
	confirmed := deepseek.UserConfirmedSend(lastUser)
	if merged != nil && confirmed && merged.FieldsComplete() {
		merged.Ready = true
	}

	canSubmit := merged != nil && merged.CanSubmit(confirmed)

	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"reply":      visible,
		"draft":      merged,
		"ready":      canSubmit,
		"complete":   merged != nil && merged.FieldsComplete(),
		"model":      h.Cfg.DeepSeekModel,
	})
}

func (h *DevHandler) ChatStatus(c *gin.Context) {
	configured := h.DeepSeek != nil && h.DeepSeek.Configured()
	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"configured": configured,
		"model":      h.Cfg.DeepSeekModel,
	})
}

type PlatformHandler struct {
	Cfg      config.Config
	Store    *platform.Store
	Exporter *platform.Exporter
	Registro interface {
		LoadFromFile(string) error
	}
}

func (h *PlatformHandler) ListSolicitudes(c *gin.Context) {
	status := c.Query("status")
	list, err := h.Store.ListRequests(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitudes": list})
}

func (h *PlatformHandler) GetSolicitud(c *gin.Context) {
	id := c.Param("id")
	req, err := h.Store.GetRequestByID(id)
	if err != nil {
		if errors.Is(err, platform.ErrNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": req})
}

func (h *PlatformHandler) MarcarProvisioning(c *gin.Context) {
	id := c.Param("id")
	if err := h.Store.MarkProvisioning(id); err != nil {
		if errors.Is(err, platform.ErrInvalidStatus) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Ok: false, Codigo: "ESTADO_INVALIDO", Mensaje: "Solo solicitudes pending pueden pasar a provisioning",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	req, _ := h.Store.GetRequestByID(id)
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": req})
}

type rejectBody struct {
	Motivo string `json:"motivo"`
}

func (h *PlatformHandler) Rechazar(c *gin.Context) {
	id := c.Param("id")
	var body rejectBody
	_ = c.ShouldBindJSON(&body)
	if err := h.Store.Reject(id, body.Motivo); err != nil {
		if errors.Is(err, platform.ErrInvalidStatus) {
			c.JSON(http.StatusConflict, models.ErrorResponse{
				Ok: false, Codigo: "ESTADO_INVALIDO", Mensaje: "No se puede rechazar en el estado actual",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	req, _ := h.Store.GetRequestByID(id)
	c.JSON(http.StatusOK, gin.H{"ok": true, "solicitud": req})
}

func (h *PlatformHandler) Activar(c *gin.Context) {
	id := c.Param("id")
	req, err := h.Store.GetRequestByID(id)
	if err != nil {
		if errors.Is(err, platform.ErrNotFound) {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Solicitud no encontrada",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}
	if req.Status != platform.StatusPending && req.Status != platform.StatusProvisioning {
		c.JSON(http.StatusConflict, models.ErrorResponse{
			Ok: false, Codigo: "ESTADO_INVALIDO", Mensaje: "Solo pending/provisioning pueden activarse",
		})
		return
	}

	keys := map[string]string{}
	for _, rol := range []string{"admin", "integrador", "lectura"} {
		k, err := platform.GenerateAPIKey(req.TenantID, rol)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{
				Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudieron generar API keys",
			})
			return
		}
		keys[rol] = k
	}

	userPasswords, err := h.Exporter.ActivateTenant(req, keys)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "EXPORT_ERROR", Mensaje: err.Error(),
		})
		return
	}

	if err := h.Store.CompleteActivation(req, keys, userPasswords); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO", Mensaje: err.Error(),
		})
		return
	}

	if h.Registro != nil {
		if err := h.Registro.LoadFromFile(h.Cfg.UsuariosAdminFile); err != nil {
			log.Printf("[platform] advertencia: no se pudo recargar usuarios-admin: %v", err)
		} else {
			log.Printf("[platform] usuarios-admin recargado tras activar %s", req.TenantID)
		}
	}

	log.Printf("[dev-portal] Tenant activado: %s — reiniciar api-middleware para cargar tenants.yaml", req.TenantID)

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"resultado": platform.ActivateResult{
			TenantID:      req.TenantID,
			MiddlewareURL: h.Cfg.MiddlewareURL,
			APIKeys:       keys,
			UserPasswords: userPasswords,
		},
	})
}
