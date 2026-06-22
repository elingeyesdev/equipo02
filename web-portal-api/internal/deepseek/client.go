package deepseek

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultAPIURL = "https://api.deepseek.com/v1/chat/completions"
const defaultModel = "deepseek-chat"

var ErrNotConfigured = errors.New("deepseek no configurado")

type Client struct {
	APIKey  string
	APIURL  string
	Model   string
	HTTP    *http.Client
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func NewClient(apiKey, apiURL, model string) *Client {
	apiKey = strings.TrimSpace(apiKey)
	if apiURL == "" {
		apiURL = defaultAPIURL
	}
	if model == "" {
		model = defaultModel
	}
	return &Client{
		APIKey: apiKey,
		APIURL: apiURL,
		Model:  model,
		HTTP:   &http.Client{Timeout: 90 * time.Second},
	}
}

func (c *Client) Configured() bool {
	return c != nil && strings.TrimSpace(c.APIKey) != ""
}

func (c *Client) Complete(ctx context.Context, messages []Message) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	body, err := json.Marshal(chatRequest{
		Model:    c.Model,
		Messages: messages,
		Stream:   false,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.APIURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	res, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("respuesta deepseek inválida: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", errors.New(parsed.Error.Message)
	}
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("deepseek HTTP %d: %s", res.StatusCode, string(raw))
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("deepseek sin respuesta")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}
